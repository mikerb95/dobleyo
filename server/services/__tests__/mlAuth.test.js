// Tests de la conexión OAuth con MercadoLibre: cifrado de tokens, renovación
// automática (con refresh token de un solo uso), respaldo con ML_ACCESS_TOKEN y
// reintento del cliente ante 401. SQLite real en un archivo temporal; fetch
// mockeado, sin red.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dbFile = join(mkdtempSync(join(tmpdir(), 'dobleyo-mlauth-')), 'test.db');
process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.ML_TOKEN_SECRET = 'x'.repeat(40);
process.env.ML_CLIENT_ID = '123456';
process.env.ML_CLIENT_SECRET = 'secret_test';
process.env.SITE_BASE_URL = 'https://dobleyo.cafe';

let db, mlAuth;

const sqliteUtc = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function seedConnection({ expiresInMs, access = 'ACCESS_OLD', refresh = 'REFRESH_OLD' }) {
  await db.query('DELETE FROM ml_oauth');
  await db.query(
    `INSERT INTO ml_oauth (id, ml_user_id, nickname, access_token_enc, refresh_token_enc, expires_at)
     VALUES (1, '999', 'DOBLEYO', ?, ?, ?)`,
    [mlAuth.encryptToken(access), mlAuth.encryptToken(refresh), sqliteUtc(new Date(Date.now() + expiresInMs))],
  );
}

beforeAll(async () => {
  db = await import('../../db.js');
  const { createMlStockSync } = await import('../../migrations/create_ml_stock_sync.js');
  await createMlStockSync();
  mlAuth = await import('../mlAuth.js');
});

beforeEach(async () => {
  vi.restoreAllMocks();
  delete process.env.ML_ACCESS_TOKEN;
  await db.query('DELETE FROM ml_oauth');
});

describe('cifrado de tokens', () => {
  it('should round-trip a token and never store it in clear text', () => {
    const enc = mlAuth.encryptToken('APP_USR-123');
    expect(enc).not.toContain('APP_USR');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(mlAuth.decryptToken(enc)).toBe('APP_USR-123');
  });

  it('should reject a tampered payload', () => {
    const enc = mlAuth.encryptToken('APP_USR-123');
    const parts = enc.split(':');
    parts[3] = Buffer.from('otra-cosa').toString('base64url');
    expect(() => mlAuth.decryptToken(parts.join(':'))).toThrow();
  });
});

describe('URL de autorización', () => {
  it('should point to the Colombian auth host with state, redirect and PKCE', () => {
    const url = new URL(mlAuth.buildAuthorizationUrl({ state: 'abc', codeChallenge: 'xyz' }));
    expect(url.origin).toBe('https://auth.mercadolibre.com.co');
    expect(url.searchParams.get('client_id')).toBe('123456');
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://dobleyo.cafe/api/mercadolibre/oauth/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
});

describe('getAccessToken', () => {
  it('should return the stored token without calling ML while it is valid', async () => {
    await seedConnection({ expiresInMs: 3 * 60 * 60 * 1000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { token, source } = await mlAuth.getAccessToken();
    expect(token).toBe('ACCESS_OLD');
    expect(source).toBe('oauth');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should refresh when close to expiry and persist the new single-use refresh token', async () => {
    await seedConnection({ expiresInMs: 2 * 60 * 1000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {
      access_token: 'ACCESS_NEW', refresh_token: 'REFRESH_NEW', expires_in: 21600, user_id: 999,
    }));

    const { token } = await mlAuth.getAccessToken();
    expect(token).toBe('ACCESS_NEW');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.mercadolibre.com/oauth/token');
    const sent = new URLSearchParams(init.body.toString());
    expect(sent.get('grant_type')).toBe('refresh_token');
    expect(sent.get('refresh_token')).toBe('REFRESH_OLD');

    const row = (await db.query('SELECT * FROM ml_oauth WHERE id = 1')).rows[0];
    expect(mlAuth.decryptToken(row.refresh_token_enc)).toBe('REFRESH_NEW');
    expect(mlAuth.decryptToken(row.access_token_enc)).toBe('ACCESS_NEW');
    expect(row.last_error).toBeNull();
  });

  it('should ask to reconnect when ML rejects the refresh token', async () => {
    await seedConnection({ expiresInMs: -60 * 1000 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { error: 'invalid_grant', message: 'invalid_grant' }));

    await expect(mlAuth.getAccessToken()).rejects.toMatchObject({ code: 'ML_RECONNECT_REQUIRED' });
    const row = (await db.query('SELECT last_error FROM ml_oauth WHERE id = 1')).rows[0];
    expect(row.last_error).toMatch(/invalid_grant/);
  });

  it('should fall back to ML_ACCESS_TOKEN when there is no OAuth connection', async () => {
    process.env.ML_ACCESS_TOKEN = 'APP_USR-ENV';
    await expect(mlAuth.getAccessToken()).resolves.toEqual({ token: 'APP_USR-ENV', source: 'env' });
  });

  it('should fail with ML_NOT_CONNECTED when nothing is configured', async () => {
    await expect(mlAuth.getAccessToken()).rejects.toMatchObject({ code: 'ML_NOT_CONNECTED' });
  });
});

describe('mlApi', () => {
  it('should refresh once and retry when ML answers 401', async () => {
    await seedConnection({ expiresInMs: 3 * 60 * 60 * 1000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(401, { message: 'invalid access token' }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'ACCESS_NEW', refresh_token: 'REFRESH_NEW', expires_in: 21600 }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 999, nickname: 'DOBLEYO' }));

    const me = await mlApi('/users/me');
    expect(me.nickname).toBe('DOBLEYO');
    expect(fetchSpy.mock.calls[2][1].headers.Authorization).toBe('Bearer ACCESS_NEW');
  });

  it('should surface ML error causes in the message', async () => {
    await seedConnection({ expiresInMs: 3 * 60 * 60 * 1000 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, {
      message: 'Validation error', cause: [{ code: 'item.available_quantity.invalid', message: 'Quantity must be lower' }],
    }));
    await expect(mlApi('/items/MCO1', { method: 'PUT', body: { available_quantity: 1 } }))
      .rejects.toThrow('Validation error (Quantity must be lower)');
  });
});

// Atajo para los tests de mlApi.
function mlApi(...args) { return mlAuth.mlApi(...args); }

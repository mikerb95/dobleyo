/**
 * Autenticación con MercadoLibre (OAuth 2.0) y cliente HTTP de su API.
 *
 * Por qué existe: el access token de ML dura 6 horas. Un token fijo en una
 * variable de entorno deja de servir el mismo día, y con él se caen el sync de
 * órdenes, el webhook y la actualización de stock. Aquí la conexión se hace una
 * vez desde el panel (/admin/mercadolibre → "Conectar") y el servidor renueva el
 * token solo, antes de que venza.
 *
 * Reglas que este módulo garantiza:
 * - Los tokens viven cifrados en `ml_oauth` (AES-256-GCM). La llave sale de
 *   ML_TOKEN_SECRET o, si no existe, de JWT_SECRET. Nunca se devuelven al cliente.
 * - El refresh token de ML es de UN SOLO USO: cada renovación entrega uno nuevo
 *   y el anterior queda inválido. Por eso la escritura es condicional (solo si
 *   el refresh token guardado sigue siendo el que se usó) y, si otra instancia
 *   ganó la carrera, se relee la fila en vez de fallar.
 * - ML_ACCESS_TOKEN (variable fija) sigue funcionando como respaldo mientras no
 *   haya conexión OAuth, para no romper instalaciones existentes.
 */

import crypto from 'crypto';
import * as db from '../db.js';
import { logger } from '../logger.js';

export const ML_API_BASE = 'https://api.mercadolibre.com';
const DEFAULT_AUTH_HOST = 'https://auth.mercadolibre.com.co';
/** Margen antes del vencimiento para renovar (el token dura 21600 s). */
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

/** Error de negocio de la integración. `code` lo usa el panel para orientar al admin. */
export class MlAuthError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'MlAuthError';
    this.code = code;
    this.status = status;
  }
}

/** Error de la API de ML con el detalle que ML devuelve (message, error, cause). */
export class MlApiError extends Error {
  constructor(message, { status, path, body } = {}) {
    super(message);
    this.name = 'MlApiError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

// ── Cifrado de tokens en reposo ────────────────────────────────────────────

function encryptionKey() {
  const secret = process.env.ML_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new MlAuthError(
      'Falta ML_TOKEN_SECRET (o JWT_SECRET) de al menos 32 caracteres para cifrar los tokens de MercadoLibre',
      'ML_TOKEN_SECRET_MISSING',
      500,
    );
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/** Cifra un texto: `v1:<iv>:<tag>:<cifrado>` en base64url. */
export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

/** Descifra lo producido por encryptToken. Lanza si la llave cambió o el dato fue alterado. */
export function decryptToken(payload) {
  const [version, ivB64, tagB64, encB64] = String(payload || '').split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !encB64) {
    throw new MlAuthError('Token de MercadoLibre guardado con un formato desconocido', 'ML_TOKEN_CORRUPT', 500);
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64url')), decipher.final()]).toString('utf8');
}

// ── Configuración ──────────────────────────────────────────────────────────

/** ¿Están las credenciales de la app de ML para hacer OAuth? */
export function isOAuthConfigured() {
  return Boolean(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
}

/** URL de regreso registrada en la app de ML. Debe coincidir exactamente. */
export function redirectUri() {
  if (process.env.ML_REDIRECT_URI) return process.env.ML_REDIRECT_URI;
  const base = (process.env.SITE_BASE_URL || 'https://dobleyo.cafe').replace(/\/+$/, '');
  return `${base}/api/mercadolibre/oauth/callback`;
}

/** Par PKCE (S256). El verifier se guarda en cookie HttpOnly hasta el regreso. */
export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** URL de autorización de ML (Colombia por defecto; ML_AUTH_HOST la cambia). */
export function buildAuthorizationUrl({ state, codeChallenge }) {
  if (!isOAuthConfigured()) {
    throw new MlAuthError('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET', 'ML_OAUTH_NOT_CONFIGURED');
  }
  const host = (process.env.ML_AUTH_HOST || DEFAULT_AUTH_HOST).replace(/\/+$/, '');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ML_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${host}/authorization?${params}`;
}

// ── Persistencia ───────────────────────────────────────────────────────────

/** 'YYYY-MM-DD HH:MM:SS' en UTC, el formato de datetime('now'). */
function sqliteUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseSqliteUtc(value) {
  if (!value) return null;
  const d = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function readOAuthRow() {
  try {
    const r = await db.query('SELECT * FROM ml_oauth WHERE id = 1');
    return r.rows[0] || null;
  } catch (err) {
    // La tabla no existe hasta correr la migración: se trata como "sin conexión".
    if (/no such table/i.test(err.message)) return null;
    throw err;
  }
}

async function postToken(params) {
  const body = new URLSearchParams({
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    ...params,
  });
  const resp = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.access_token) {
    const detail = json.message || json.error_description || json.error || `HTTP ${resp.status}`;
    throw new MlApiError(`MercadoLibre rechazó la solicitud de token: ${detail}`, {
      status: resp.status, path: '/oauth/token', body: json,
    });
  }
  return json;
}

/**
 * Cambia el `code` del regreso de OAuth por tokens y guarda la conexión.
 * @returns {Promise<{ ml_user_id: string, nickname: string|null }>}
 */
export async function exchangeCodeAndSave({ code, codeVerifier, connectedBy = null }) {
  if (!isOAuthConfigured()) {
    throw new MlAuthError('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET', 'ML_OAUTH_NOT_CONFIGURED');
  }
  const params = { grant_type: 'authorization_code', code, redirect_uri: redirectUri() };
  if (codeVerifier) params.code_verifier = codeVerifier;
  const tokens = await postToken(params);
  if (!tokens.refresh_token) {
    // Sin refresh token la conexión moriría en 6 h: la app de ML debe tener el scope offline_access.
    throw new MlAuthError(
      'MercadoLibre no entregó refresh token. Active "offline_access" en los permisos de la aplicación.',
      'ML_NO_REFRESH_TOKEN',
    );
  }

  let nickname = null;
  try {
    const me = await fetch(`${ML_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (me.ok) nickname = (await me.json()).nickname || null;
  } catch { /* el apodo es cosmético */ }

  const mlUserId = String(tokens.user_id);
  const expiresAt = sqliteUtc(new Date(Date.now() + Number(tokens.expires_in || 21600) * 1000));
  await db.query(
    `INSERT INTO ml_oauth (id, ml_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, scope,
                           connected_by, connected_at, refreshed_at, last_error, last_error_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL, NULL)
     ON CONFLICT(id) DO UPDATE SET
       ml_user_id = excluded.ml_user_id, nickname = excluded.nickname,
       access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc,
       expires_at = excluded.expires_at, scope = excluded.scope, connected_by = excluded.connected_by,
       connected_at = excluded.connected_at, refreshed_at = excluded.refreshed_at,
       last_error = NULL, last_error_at = NULL`,
    [mlUserId, nickname, encryptToken(tokens.access_token), encryptToken(tokens.refresh_token),
      expiresAt, tokens.scope || null, connectedBy],
  );

  // Si había un vendedor configurado por variable y no coincide, se avisa en el log:
  // el webhook filtra por vendedor y descartaría las notificaciones.
  if (process.env.ML_SELLER_ID && String(process.env.ML_SELLER_ID) !== mlUserId) {
    logger.warn({ envSeller: process.env.ML_SELLER_ID, oauthSeller: mlUserId },
      '[mlAuth] ML_SELLER_ID no coincide con la cuenta conectada; se usa la cuenta conectada');
  }
  return { ml_user_id: mlUserId, nickname };
}

let refreshInFlight = null;

/** Renueva el token. Una sola renovación a la vez por instancia. */
async function refreshAccessToken(row) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const oldRefreshEnc = row.refresh_token_enc;
    try {
      if (!isOAuthConfigured()) {
        throw new MlAuthError('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET para renovar el token', 'ML_OAUTH_NOT_CONFIGURED');
      }
      const tokens = await postToken({ grant_type: 'refresh_token', refresh_token: decryptToken(oldRefreshEnc) });
      const expiresAt = sqliteUtc(new Date(Date.now() + Number(tokens.expires_in || 21600) * 1000));
      const upd = await db.query(
        `UPDATE ml_oauth
            SET access_token_enc = ?, refresh_token_enc = ?, expires_at = ?, scope = COALESCE(?, scope),
                refreshed_at = datetime('now'), last_error = NULL, last_error_at = NULL
          WHERE id = 1 AND refresh_token_enc = ?`,
        [encryptToken(tokens.access_token), encryptToken(tokens.refresh_token || decryptToken(oldRefreshEnc)),
          expiresAt, tokens.scope || null, oldRefreshEnc],
      );
      if (!upd.rowCount) {
        // Otra instancia renovó primero; su token es el vigente.
        const fresh = await readOAuthRow();
        if (fresh) return decryptToken(fresh.access_token_enc);
      }
      logger.info('[mlAuth] token de MercadoLibre renovado');
      return tokens.access_token;
    } catch (err) {
      // ¿La renovó otra instancia mientras tanto? Entonces el error es solo nuestro.
      const fresh = await readOAuthRow().catch(() => null);
      if (fresh && fresh.refresh_token_enc !== oldRefreshEnc) {
        const exp = parseSqliteUtc(fresh.expires_at);
        if (exp && exp.getTime() > Date.now()) return decryptToken(fresh.access_token_enc);
      }
      await db.query(
        `UPDATE ml_oauth SET last_error = ?, last_error_at = datetime('now') WHERE id = 1`,
        [String(err.message).slice(0, 500)],
      ).catch(() => {});
      logger.error({ err: err.message }, '[mlAuth] no se pudo renovar el token de MercadoLibre');
      if (err instanceof MlApiError && (err.status === 400 || err.status === 401)) {
        throw new MlAuthError(
          'La conexión con MercadoLibre expiró o fue revocada. Vuelva a conectar la cuenta desde el panel.',
          'ML_RECONNECT_REQUIRED',
          401,
        );
      }
      throw err;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Devuelve un access token válido, renovándolo si está por vencer.
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<{ token: string, source: 'oauth'|'env' }>}
 */
export async function getAccessToken({ forceRefresh = false } = {}) {
  const row = await readOAuthRow();
  if (row) {
    const exp = parseSqliteUtc(row.expires_at);
    const stillValid = exp && exp.getTime() - Date.now() > REFRESH_MARGIN_MS;
    if (stillValid && !forceRefresh) return { token: decryptToken(row.access_token_enc), source: 'oauth' };
    return { token: await refreshAccessToken(row), source: 'oauth' };
  }
  if (process.env.ML_ACCESS_TOKEN) return { token: process.env.ML_ACCESS_TOKEN, source: 'env' };
  throw new MlAuthError(
    'MercadoLibre no está conectado. Conecte la cuenta desde /admin/mercadolibre.',
    'ML_NOT_CONNECTED',
    409,
  );
}

/** ID del vendedor: el de la cuenta conectada o, de respaldo, ML_SELLER_ID. */
export async function getSellerId() {
  const row = await readOAuthRow();
  return row?.ml_user_id || process.env.ML_SELLER_ID || null;
}

/** Estado de la conexión para el panel. No incluye tokens. */
export async function getConnectionStatus() {
  const row = await readOAuthRow();
  return {
    oauth_configured: isOAuthConfigured(),
    redirect_uri: redirectUri(),
    connected: Boolean(row) || Boolean(process.env.ML_ACCESS_TOKEN),
    source: row ? 'oauth' : (process.env.ML_ACCESS_TOKEN ? 'env' : null),
    ml_user_id: row?.ml_user_id || process.env.ML_SELLER_ID || null,
    nickname: row?.nickname || null,
    expires_at: row?.expires_at || null,
    connected_at: row?.connected_at || null,
    refreshed_at: row?.refreshed_at || null,
    last_error: row?.last_error || null,
    last_error_at: row?.last_error_at || null,
  };
}

/** Borra la conexión OAuth (los vínculos de publicaciones se conservan). */
export async function disconnect() {
  await db.query('DELETE FROM ml_oauth WHERE id = 1');
}

// ── Cliente de la API ──────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mensaje legible a partir del cuerpo de error de ML. */
export function describeMlError(body, status) {
  if (!body || typeof body !== 'object') return `HTTP ${status}`;
  const causes = Array.isArray(body.cause)
    ? body.cause.map((c) => c?.message || c?.code).filter(Boolean)
    : [];
  const base = body.message || body.error || `HTTP ${status}`;
  return causes.length ? `${base} (${causes.join('; ')})` : base;
}

/**
 * Llama a la API de ML con el token vigente.
 * - 401: renueva el token una vez y reintenta.
 * - 429 y 5xx: hasta 2 reintentos con espera creciente.
 * @param {string} path  Ruta que empieza con "/" (p. ej. "/items/MCO123").
 * @param {{ method?: string, body?: any, headers?: object }} [opts]
 */
export async function mlApi(path, { method = 'GET', body, headers = {} } = {}) {
  let { token } = await getAccessToken();
  let refreshed = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    let resp;
    try {
      resp = await fetch(`${ML_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt < 2) { await sleep(400 * (attempt + 1)); continue; }
      throw new MlApiError(`No se pudo contactar a MercadoLibre: ${err.message}`, { path });
    }

    if (resp.status === 401 && !refreshed) {
      refreshed = true;
      try {
        ({ token } = await getAccessToken({ forceRefresh: true }));
        continue;
      } catch (err) {
        // Token fijo de variable de entorno: no hay cómo renovarlo.
        if (err instanceof MlAuthError && err.code === 'ML_OAUTH_NOT_CONFIGURED') {
          throw new MlAuthError('El token de MercadoLibre venció. Conecte la cuenta con OAuth desde el panel.', 'ML_RECONNECT_REQUIRED', 401);
        }
        throw err;
      }
    }
    if ((resp.status === 429 || resp.status >= 500) && attempt < 2) {
      await sleep(600 * (attempt + 1));
      continue;
    }

    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!resp.ok) {
      if (resp.status === 401) {
        throw new MlAuthError('MercadoLibre rechazó el token. Vuelva a conectar la cuenta desde el panel.', 'ML_RECONNECT_REQUIRED', 401);
      }
      throw new MlApiError(describeMlError(json, resp.status), { status: resp.status, path, body: json });
    }
    return json;
  }
  throw new MlApiError('MercadoLibre no respondió después de varios intentos', { path });
}

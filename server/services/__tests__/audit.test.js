// Tests unitarios para server/services/audit.js
// Ejecutar con: npm test

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de la base de datos — debe declararse antes de importar el módulo a testear
vi.mock('../../db.js', () => ({
  query: vi.fn(),
}));

import { logAudit, getAuditLogs } from '../audit.js';
import { query } from '../../db.js';

describe('logAudit()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silenciar logs de consola en tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('debería insertar un registro en audit_logs con los parámetros correctos', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const result = await logAudit(42, 'create', 'product', '123', { name: 'Café Sierra' });

    expect(query).toHaveBeenCalledOnce();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(params[0]).toBe(42);       // userId
    expect(params[1]).toBe('create'); // action
    expect(params[2]).toBe('product');// entityType
    expect(params[3]).toBe('123');    // entityId
    expect(JSON.parse(params[4])).toEqual({ name: 'Café Sierra' }); // details como JSON
  });

  it('debería usar {} como details por defecto si no se proporciona', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

    await logAudit(1, 'delete', 'user', '5');

    const [, params] = query.mock.calls[0];
    expect(JSON.parse(params[4])).toEqual({});
  });

  it('debería retornar null y NO llamar a query si faltan parámetros requeridos', async () => {
    const result = await logAudit(null, 'create', 'product', '1');
    expect(query).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('debería retornar null si falta entityId', async () => {
    const result = await logAudit(1, 'create', 'product', undefined);
    expect(query).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('debería retornar null (sin lanzar error) si la BD falla', async () => {
    query.mockRejectedValueOnce(new Error('BD no disponible'));

    const result = await logAudit(1, 'create', 'product', '1', {});

    expect(result).toBeNull();
    // No debe propagar el error
  });
});

describe('getAuditLogs()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('debería retornar filas de audit_logs sin filtros', async () => {
    const mockRows = [
      { id: 1, action: 'create', entity_type: 'product', user_email: 'admin@test.com' },
    ];
    query.mockResolvedValueOnce({ rows: mockRows });

    const result = await getAuditLogs({});

    expect(query).toHaveBeenCalledOnce();
    expect(result).toEqual(mockRows);
  });

  it('debería incluir filtro de action en el SQL cuando se proporciona', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getAuditLogs({ action: 'delete' });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('al.action = $1');
    expect(params[0]).toBe('delete');
  });

  it('debería incluir filtros combinados con numeración $n correcta', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getAuditLogs({ action: 'create', entityType: 'product', userId: 5 });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('al.action = $1');
    expect(sql).toContain('al.entity_type = $2');
    expect(sql).toContain('al.user_id = $3');
    expect(params[0]).toBe('create');
    expect(params[1]).toBe('product');
    expect(params[2]).toBe(5);
  });

  it('debería retornar [] si la BD falla', async () => {
    query.mockRejectedValueOnce(new Error('timeout'));

    const result = await getAuditLogs({});

    expect(result).toEqual([]);
  });

  it('debería usar limit y offset por defecto (100, 0)', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getAuditLogs({});

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(params).toContain(100);
    expect(params).toContain(0);
  });
});

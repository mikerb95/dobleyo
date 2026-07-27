// Tests de server/utils/recordDate.js
// Ejecutar con: npm test

import { describe, it, expect } from 'vitest';
import { resolveRecordedAt, recordedDay, MAX_BACKDATE_DAYS } from '../recordDate.js';

const SQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

describe('resolveRecordedAt', () => {
  it('devuelve null cuando no se envía fecha (la consulta cae en datetime(now))', () => {
    expect(resolveRecordedAt(undefined)).toBeNull();
    expect(resolveRecordedAt(null)).toBeNull();
    expect(resolveRecordedAt('')).toBeNull();
  });

  it('convierte una fecha pasada al formato de SQLite fijando el mediodía', () => {
    const day = daysAgo(5);
    const result = resolveRecordedAt(day);
    expect(result).toMatch(SQL_DATETIME);
    expect(result).toBe(`${day} 12:00:00`);
  });

  it('conserva la hora real cuando la fecha es la de hoy', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = resolveRecordedAt(today);
    expect(result.startsWith(`${today} `)).toBe(true);
    // La hora es la del momento del registro, no el mediodía fijo de las fechas pasadas.
    expect(result.slice(11, 13)).toBe(new Date().toISOString().slice(11, 13));
  });

  it('acepta un ISO completo (cola offline del móvil)', () => {
    expect(resolveRecordedAt(`${daysAgo(2)}T15:04:05Z`)).toBe(`${daysAgo(2)} 15:04:05`);
  });

  it('rechaza fechas futuras', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(() => resolveRecordedAt(future)).toThrowError(/futura/);
    try {
      resolveRecordedAt(future);
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });

  it('rechaza fechas más antiguas que el límite de retrodatación', () => {
    expect(() => resolveRecordedAt(daysAgo(MAX_BACKDATE_DAYS + 10))).toThrowError(/anterior/);
  });

  it('rechaza valores que no son fecha', () => {
    expect(() => resolveRecordedAt('ayer')).toThrowError(/inválida/);
    expect(() => resolveRecordedAt(42)).toThrowError(/inválida/);
  });
});

describe('recordedDay', () => {
  it('extrae el día de una fecha ya normalizada', () => {
    expect(recordedDay('2026-07-20 12:00:00')).toBe('2026-07-20');
    expect(recordedDay(null)).toBeNull();
  });
});

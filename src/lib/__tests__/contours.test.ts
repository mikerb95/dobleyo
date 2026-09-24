import { describe, it, expect } from 'vitest';
import { contourRings, hashSeed, mulberry32, ringsForAltitude, closedPath } from '../motion/contours.ts';
import { qrMatrix } from '../qr.ts';

describe('hashSeed y mulberry32', () => {
  it('son deterministas', () => {
    expect(hashSeed('finca-el-paraiso')).toBe(hashSeed('finca-el-paraiso'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('mulberry32 devuelve valores en [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('contourRings', () => {
  const opts = { seed: hashSeed('finca-la-esperanza'), rings: 6, width: 200, height: 120 };

  it('genera una curva cerrada por anillo, de la base a la cima', () => {
    const rings = contourRings(opts);
    expect(rings).toHaveLength(6);
    expect(rings[0].level).toBe(0);
    expect(rings[5].level).toBe(1);
    for (const r of rings) {
      expect(r.d.startsWith('M')).toBe(true);
      expect(r.d.endsWith('Z')).toBe(true);
      expect(r.d).not.toContain('NaN');
    }
  });

  it('la misma semilla da el mismo mapa y otra semilla uno distinto', () => {
    expect(contourRings(opts)).toEqual(contourRings(opts));
    expect(contourRings({ ...opts, seed: 1 })[0].d).not.toBe(contourRings(opts)[0].d);
  });

  it('un solo anillo es la cima', () => {
    expect(contourRings({ ...opts, rings: 1 })[0].level).toBe(1);
  });
});

describe('closedPath', () => {
  it('necesita al menos tres puntos', () => {
    expect(closedPath([[0, 0], [1, 1]])).toBe('');
  });
});

describe('ringsForAltitude', () => {
  it('escala con la altitud dentro de 4 a 9', () => {
    expect(ringsForAltitude(null)).toBe(5);
    expect(ringsForAltitude(500)).toBe(4);
    expect(ringsForAltitude(1100)).toBe(4);
    expect(ringsForAltitude(1800)).toBe(7);
    expect(ringsForAltitude(2100)).toBe(8);
    expect(ringsForAltitude(4000)).toBe(9);
  });
});

describe('qrMatrix', () => {
  it('codifica la URL en una matriz cuadrada con patrones de posición', () => {
    const m = qrMatrix('https://dobleyo.cafe/trazabilidad?lote=LOTE-HUI-2026-01');
    expect(m.size).toBeGreaterThanOrEqual(21);
    expect(m.cells.length).toBeGreaterThan(100);
    // Las tres esquinas de posición son oscuras.
    const has = (x: number, y: number) => m.cells.some((c) => c.x === x && c.y === y);
    expect(has(0, 0)).toBe(true);
    expect(has(m.size - 1, 0)).toBe(true);
    expect(has(0, m.size - 1)).toBe(true);
    expect(m.cells.filter((c) => c.finder).length).toBe(3 * 33);
  });
});

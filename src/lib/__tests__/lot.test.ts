import { describe, it, expect } from 'vitest';
import { toLotView, parseNotes, formatAltitude, roastCurve, processKind, EXAMPLE_LOT } from '../lot.ts';

const ROW = {
  lot_id: 'LOTE-HUI-2026-01',
  farm: 'Finca El Paraíso',
  farm_slug: 'finca-el-paraiso',
  region: 'Huila',
  municipality: 'Pitalito',
  altitude: 1800,
  variety: 'Geisha',
  process: 'Lavado',
  taste_notes: 'Bergamota, durazno, té negro',
  harvest_date: '2026-05-11 23:06:57',
  roast_level: 'Claro',
  actual_temp: 196,
  roast_time_minutes: 12,
  roast_date: '2026-05-31 17:10:12',
  score: 89.5,
};

describe('toLotView', () => {
  it('formatea el lote en español', () => {
    const v = toLotView(ROW, 'es');
    expect(v.code).toBe('LOTE-HUI-2026-01');
    expect(v.region).toBe('Pitalito, Huila');
    expect(v.altitudeLabel).toBe('1.800 msnm');
    expect(v.process).toBe('Lavado');
    expect(v.notes).toEqual(['Bergamota', 'Durazno', 'Té negro']);
    expect(v.score).toBe(89.5);
    expect(v.illustrative).toBe(false);
    expect(v.roastDate).toMatch(/2026/);
  });

  it('traduce los términos conocidos al inglés', () => {
    const v = toLotView(ROW, 'en');
    expect(v.altitudeLabel).toBe('1,800 masl');
    expect(v.process).toBe('Washed');
    expect(v.roastLevel).toBe('Light');
    expect(v.notes).toEqual(['Bergamot', 'Peach', 'Black tea']);
  });

  it('el QR apunta a la trazabilidad pública del lote', () => {
    expect(toLotView(ROW, 'en').qrUrl).toBe('https://dobleyo.cafe/trazabilidad?lote=LOTE-HUI-2026-01');
  });

  it('ignora puntajes que no están en escala SCA', () => {
    expect(toLotView({ ...ROW, score: 3 }, 'es').score).toBeNull();
    expect(toLotView({ ...ROW, score: null }, 'es').score).toBeNull();
  });

  it('marca el ejemplo como ilustrativo', () => {
    const v = toLotView(EXAMPLE_LOT, 'es', true);
    expect(v.illustrative).toBe(true);
    expect(v.roastDate).toBeNull();
  });

  it('acepta altitud como texto', () => {
    expect(toLotView({ ...ROW, altitude: '1750' }, 'es').altitude).toBe(1750);
  });
});

describe('parseNotes', () => {
  it('limita y limpia las notas', () => {
    expect(parseNotes('a, b ,, c; d', 'es')).toEqual(['A', 'B', 'C']);
    expect(parseNotes(null, 'es')).toEqual([]);
  });
  it('deja sin traducir lo que no conoce', () => {
    expect(parseNotes('Lulo', 'en')).toEqual(['Lulo']);
  });
});

describe('formatAltitude', () => {
  it('devuelve vacío sin dato', () => {
    expect(formatAltitude(null, 'es')).toBe('');
  });
});

describe('roastCurve', () => {
  const c = roastCurve(196, 12, { width: 300, height: 150 });

  it('termina en el dato real del lote', () => {
    const last = c.points[c.points.length - 1];
    expect(last[0]).toBeCloseTo(300, 0);
    expect(last[1]).toBeCloseTo(c.y(196), 0);
    expect(c.end).toEqual({ x: last[0], y: last[1] });
  });

  it('baja hasta el punto de retorno y después solo sube', () => {
    const ys = c.points.map(([, y]) => y);
    const tpIndex = ys.indexOf(Math.max(...ys)); // y mayor = temperatura menor
    for (let i = 1; i <= tpIndex; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);
    for (let i = tpIndex + 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
  });

  it('la tasa de subida decrece (tueste que se desacelera)', () => {
    const ys = c.points.map(([, y]) => y);
    const n = ys.length;
    const early = ys[Math.floor(n * 0.3)] - ys[Math.floor(n * 0.4)];
    const late = ys[Math.floor(n * 0.8)] - ys[Math.floor(n * 0.9)];
    expect(early).toBeGreaterThan(late);
  });

  it('se queda dentro del lienzo', () => {
    for (const [x, y] of c.points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(150);
    }
  });

  it('empieza con M y no tiene NaN', () => {
    expect(c.d.startsWith('M')).toBe(true);
    expect(c.d).not.toContain('NaN');
  });
});

describe('processKind', () => {
  it('reconoce los métodos en español, inglés y código de etiqueta', () => {
    expect(processKind('Lavado')).toBe('washed');
    expect(processKind('Washed')).toBe('washed');
    expect(processKind('HUM')).toBe('washed');
    expect(processKind('Honey')).toBe('honey');
    expect(processKind('Natural')).toBe('natural');
    expect(processKind('NAT')).toBe('natural');
    expect(processKind('Anaeróbico')).toBe('other');
    expect(processKind(null)).toBe('other');
  });
});

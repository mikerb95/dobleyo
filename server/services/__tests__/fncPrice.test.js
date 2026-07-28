// Tests unitarios del parser del boletín de precios de la FNC.
// Ejecutar con: npm test
//
// El fixture es el texto extraído del PDF real del 27 de julio de 2026.
// Se mockea db.js para que el import del servicio no abra conexión a Turso.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../../db.js', () => ({ query: vi.fn() }));
vi.mock('../../logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const { parseFncBulletin, bulletinUrls, excelsoRefForFactor } = await import('../fncPrice.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const boletin = readFileSync(join(__dirname, 'fixtures/fnc_boletin_2026-07-27.txt'), 'utf8');

describe('parseFncBulletin()', () => {
  const parsed = parseFncBulletin(boletin, 'https://ejemplo/precio_cafe.pdf');

  it('extrae la fecha del boletín en formato ISO', () => {
    expect(parsed.priceDate).toBe('2026-07-27');
  });

  it('extrae el precio por carga y el factor de rendimiento base', () => {
    expect(parsed.cargaCop).toBe(2210000);
    expect(parsed.baseYieldFactor).toBe(94);
  });

  it('extrae el cierre de Nueva York y el precio de la pasilla', () => {
    expect(parsed.nyCloseUscentLb).toBe(324.55);
    expect(parsed.pasillaCopKg).toBe(10000);
  });

  it('lee la tabla completa de factores de rendimiento', () => {
    expect(parsed.yieldTable).toHaveLength(13);
    expect(parsed.yieldTable[0].factor).toBe(88);
    expect(parsed.yieldTable.at(-1).factor).toBe(100);
  });

  it('calcula el precio por kg de café verde a partir del valor excelso', () => {
    // Factor 94: $2.128.400 por 93.09 kg de excelso.
    const fr94 = parsed.yieldTable.find((r) => r.factor === 94);
    expect(fr94.valorExcelsoCargaCop).toBe(2128400);
    expect(fr94.kgExcelsoEnCarga).toBe(93.09);
    expect(fr94.excelsoCopKg).toBeCloseTo(22863.9, 1);
    expect(parsed.excelsoCopKg).toBeCloseTo(22863.9, 1);
  });

  it('lee las sucursales de Almacafé con sus tres unidades', () => {
    expect(parsed.branches).toHaveLength(16);
    const armenia = parsed.branches.find((b) => b.sucursal === 'ARMENIA');
    expect(armenia).toEqual({
      sucursal: 'ARMENIA',
      cargaCop: 2210500,
      kiloCop: 17684,
      arrobaCop: 221050,
    });
  });

  it('conserva la URL de origen', () => {
    expect(parsed.sourceUrl).toBe('https://ejemplo/precio_cafe.pdf');
  });

  it('falla con mensaje claro si el texto no es un boletín válido', () => {
    expect(() => parseFncBulletin('')).toThrow(/vac[íi]o o ilegible/i);
    expect(() => parseFncBulletin('texto cualquiera sin fecha')).toThrow(/fecha/i);
    expect(() => parseFncBulletin('Julio 27 / 2026\nsin precios')).toThrow(/precio por carga/i);
  });
});

describe('bulletinUrls()', () => {
  it('incluye la ruta conocida y la del mes en curso, sin duplicados', () => {
    const urls = bulletinUrls(new Date(2026, 6, 27));
    expect(urls[0]).toContain('2026/03/precio_cafe.pdf');
    expect(urls).toContain('https://federaciondecafeteros.org/wp-content/uploads/2026/07/precio_cafe.pdf');
    expect(urls).toContain('https://federaciondecafeteros.org/wp-content/uploads/2026/06/precio_cafe.pdf');
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('cruza bien el cambio de año al calcular el mes anterior', () => {
    const urls = bulletinUrls(new Date(2027, 0, 5));
    expect(urls).toContain('https://federaciondecafeteros.org/wp-content/uploads/2026/12/precio_cafe.pdf');
  });
});

describe('excelsoRefForFactor()', () => {
  const price = parseFncBulletin(boletin);

  it('devuelve el precio del factor pedido', () => {
    expect(excelsoRefForFactor(price, 88)).toBeCloseTo(22864.83, 1);
    expect(excelsoRefForFactor(price, 100)).toBeCloseTo(22864.57, 1);
  });

  it('cae al factor base cuando el factor no está en la tabla', () => {
    expect(excelsoRefForFactor(price, 70)).toBe(price.excelsoCopKg);
    expect(excelsoRefForFactor(price, null)).toBe(price.excelsoCopKg);
  });

  it('devuelve null si no hay precio', () => {
    expect(excelsoRefForFactor(null, 94)).toBeNull();
  });
});

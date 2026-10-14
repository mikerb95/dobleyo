import { describe, it, expect } from 'vitest';
import { parseDose, ratioLabel, parseTempC, parseSeconds, grindIndex } from '../brew.ts';

describe('parseDose', () => {
  it('lee gramos y mililitros en ES y EN', () => {
    expect(parseDose('1:16 (15 g de café · 240 ml de agua)')).toEqual({ coffee: 15, water: 240 });
    expect(parseDose('1:15 (40 g coffee · 600 ml water)')).toEqual({ coffee: 40, water: 600 });
  });
  it('sin cantidades devuelve null (moka)', () => {
    expect(parseDose('Llenar el embudo sin presionar')).toBeNull();
  });
});

describe('ratioLabel', () => {
  it('saca la proporción del inicio', () => {
    expect(ratioLabel('1:14 (30 g · 420 ml)')).toBe('1:14');
    expect(ratioLabel('Fill the basket without pressing')).toBeNull();
  });
});

describe('parseTempC', () => {
  it('toma el primer valor en grados Celsius', () => {
    expect(parseTempC('92 - 94 °C / 198 - 201 °F')).toBe(92);
    expect(parseTempC('93 °C')).toBe(93);
    expect(parseTempC('Fuego medio-bajo')).toBeNull();
  });
});

describe('parseSeconds', () => {
  it('promedia un rango y lee un valor suelto', () => {
    expect(parseSeconds('2:30 - 3:00 min')).toBe(165);
    expect(parseSeconds('4:00 min')).toBe(240);
    expect(parseSeconds('al gusto')).toBeNull();
  });
});

describe('grindIndex', () => {
  it('ubica la molienda en la escala de 5', () => {
    expect(grindIndex('Media-gruesa', 'es')).toBe(3);
    expect(grindIndex('Fine-medium', 'en')).toBe(1);
    expect(grindIndex('Turca', 'es')).toBeNull();
  });
});

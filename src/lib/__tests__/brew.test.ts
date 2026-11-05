import { describe, it, expect } from 'vitest';
import { parseDose, ratioLabel, parseTempC, parseSeconds, grindIndex, boilingPointC, pourAdvice } from '../brew.ts';

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

describe('boilingPointC', () => {
  it('baja con la altitud', () => {
    expect(boilingPointC(0)).toBe(100);
    expect(boilingPointC(2640)).toBe(91.2);
    expect(boilingPointC(1495)).toBe(95);
  });
  it('una altitud negativa cuenta como nivel del mar', () => {
    expect(boilingPointC(-20)).toBe(100);
  });
});

describe('pourAdvice', () => {
  it('sirve de una vez cuando el agua no alcanza los 94 °C', () => {
    expect(pourAdvice(boilingPointC(2640))).toBe('straight');
  });
  it('reposo corto a media altura y más largo a nivel del mar', () => {
    expect(pourAdvice(boilingPointC(1495))).toBe('short');
    expect(pourAdvice(boilingPointC(10))).toBe('wait');
  });
});

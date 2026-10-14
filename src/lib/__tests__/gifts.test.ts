import { describe, it, expect } from 'vitest';
import { contentsOf, hasFreeShipping } from '../gifts.ts';

describe('contentsOf', () => {
  it('devuelve el contenido curado del kit', () => {
    expect(contentsOf('kit-regalo-especial')).toContain('Dos cafés de regiones distintas');
  });
  it('un kit desconocido muestra solo la caja de regalo', () => {
    expect(contentsOf('kit-nuevo')).toEqual(['Caja de regalo']);
  });
  it('no menciona QR ni rastreo mientras la trazabilidad está apagada', () => {
    const all = ['kit-iniciacion-barista', 'kit-regalo-especial', 'kit-trazabilidad-completa'].flatMap(contentsOf).join(' ');
    expect(all).not.toMatch(/QR|rastre|trazab/i);
  });
});

describe('hasFreeShipping', () => {
  it('el umbral de $120.000 ya incluye envío gratis', () => {
    expect(hasFreeShipping(120000)).toBe(true);
    expect(hasFreeShipping(89900)).toBe(false);
  });
});

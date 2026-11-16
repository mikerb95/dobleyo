// Permisos por rol y modo del modelo. Sin base ni red: US$0.

import { describe, it, expect } from 'vitest';
import { definiciones, validarLlamada, herramientasDe, escriturasDe } from '../permisos.js';
import { HERRAMIENTAS } from '../herramientas/index.js';
import { ESCRITURAS } from '../escrituras/index.js';
import { modoDelModelo, sinRayas } from '../motor.js';
import { systemPrompt } from '../prompt.js';

const RAYA = String.fromCharCode(0x2014);

describe('permisos', () => {
  it('el caficultor solo recibe sus lecturas y ninguna escritura', () => {
    expect(definiciones('caficultor').map((d) => d.name).sort()).toEqual(['buscar_en_panel', 'mi_finca']);
    expect(escriturasDe('caficultor')).toEqual([]);
  });

  it('el admin recibe todo menos mi_finca, y la última definición lleva cache_control', () => {
    const nombres = definiciones('admin').map((d) => d.name);
    expect(nombres).not.toContain('mi_finca');
    expect(nombres).toContain('cambiar_estado_pedido');
    expect(definiciones('admin').at(-1).cache_control).toEqual({ type: 'ephemeral' });
    expect(definiciones('admin').slice(0, -1).every((d) => !d.cache_control)).toBe(true);
  });

  it('ninguna escritura está en el catálogo de lectura', () => {
    const lecturas = new Set(HERRAMIENTAS.map((h) => h.nombre));
    for (const e of ESCRITURAS) expect(lecturas.has(e.nombre)).toBe(false);
    for (const e of ESCRITURAS) {
      expect(typeof e.preparar).toBe('function');
      expect(typeof e.ejecutar).toBe('function');
      expect(e.descripcion).toMatch(/No se ejecuta sola/);
    }
  });

  it('validarLlamada rechaza herramientas ajenas aunque el modelo las pida', () => {
    expect(validarLlamada('caficultor', 'consultar_ventas', {}).ok).toBe(false);
    expect(validarLlamada('caficultor', 'cambiar_estado_pedido', { referencia: 'DY-1', estado: 'delivered' }).ok).toBe(false);
    expect(validarLlamada('admin', 'no_existe', {}).ok).toBe(false);
    expect(validarLlamada('client', 'buscar_en_panel', { texto: 'hola' }).ok).toBe(false);
  });

  it('validarLlamada valida la entrada con el esquema', () => {
    const r = validarLlamada('admin', 'cambiar_estado_pedido', { referencia: 'DY-1', estado: 'cancelled' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/estado/);
    expect(validarLlamada('admin', 'cambiar_estado_pedido', { referencia: 'DY-1', estado: 'delivered' }).ok).toBe(true);
  });

  it('ningún rol recibe herramientas si no es del panel', () => {
    expect(herramientasDe('client')).toEqual([]);
    expect(definiciones('provider')).toEqual([]);
  });
});

describe('motor', () => {
  it('el modelo simulado se ignora en producción', () => {
    expect(modoDelModelo({ ASISTENTE_MODELO_FALSO: '1', NODE_ENV: 'development' })).toBe('falso');
    expect(modoDelModelo({ ASISTENTE_MODELO_FALSO: '1', NODE_ENV: 'production' })).toBe(null);
    expect(modoDelModelo({ ASISTENTE_MODELO_FALSO: '1', NODE_ENV: 'production', ANTHROPIC_API_KEY: 'k' })).toBe('real');
    expect(modoDelModelo({})).toBe(null);
  });

  it('quita rayas largas sin dañar rangos numéricos', () => {
    expect(sinRayas(`Hay dos pedidos ${RAYA} ambos pagados`)).toBe('Hay dos pedidos, ambos pagados');
    expect(sinRayas(`entre 10${RAYA}20 kg`)).toBe('entre 10-20 kg');
  });
});

describe('prompt', () => {
  it('lleva la fecha (no la hora), el trato de usted y no tiene rayas', () => {
    const p = systemPrompt('2026-11-16', { nombre: 'Rosa', rol: 'caficultor', etiquetaRol: 'caficultor' }, []);
    expect(p).toContain('Hoy es 2026-11-16');
    expect(p).not.toMatch(/\d{2}:\d{2}/);
    expect(p).toContain('de usted');
    expect(p).toContain('solo puede consultar');
    expect(p).not.toContain(RAYA);
  });
});

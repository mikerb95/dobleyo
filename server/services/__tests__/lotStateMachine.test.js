// Tests unitarios para server/services/lotStateMachine.js
// Ejecutar con: npm test
//
// El módulo recibe `queryFn` como parámetro (no importa db.js directamente),
// así que se prueba con una función falsa en vez de mockear la base de datos.

import { describe, it, expect } from 'vitest';
import { canTransitionTo, getCurrentStage, assertCanAdvance, STAGE_LABELS } from '../lotStateMachine.js';

// Construye un queryFn falso que responde según qué tabla mencione el SQL.
// `hits` es el conjunto de tablas con registro para el lote.
function fakeQuery(hits) {
  return async (sql) => {
    const table = [...hits].find((t) => sql.includes(t));
    return { rows: table ? [{ 1: 1 }] : [] };
  };
}

describe('canTransitionTo()', () => {
  it('permite las transiciones definidas en TRANSITIONS', () => {
    expect(canTransitionTo('harvested', 'in_storage_green')).toBe(true);
    expect(canTransitionTo('in_storage_green', 'sent_to_roasting')).toBe(true);
    expect(canTransitionTo('in_storage_roasted', 'packaged')).toBe(true);
  });

  it('rechaza saltarse etapas', () => {
    expect(canTransitionTo('harvested', 'roasted')).toBe(false);
    expect(canTransitionTo('harvested', 'packaged')).toBe(false);
  });

  it('permite reempacar un lote ya empacado (empaque parcial)', () => {
    expect(canTransitionTo('packaged', 'packaged')).toBe(true);
  });

  it('un stage final (rejected) no admite ninguna transición', () => {
    expect(canTransitionTo('rejected', 'in_storage_roasted')).toBe(false);
  });

  it('un stage desconocido no está en TRANSITIONS', () => {
    expect(canTransitionTo('no_existe', 'harvested')).toBe(false);
  });
});

describe('getCurrentStage()', () => {
  it('detecta el stage más avanzado con registro', async () => {
    const q = fakeQuery(['coffee_harvests', 'green_coffee_inventory']);
    await expect(getCurrentStage(q, 'LOT-1')).resolves.toBe('in_storage_green');
  });

  it('devuelve "unknown" si ninguna tabla tiene registro', async () => {
    const q = fakeQuery([]);
    await expect(getCurrentStage(q, 'LOT-X')).resolves.toBe('unknown');
  });

  it('ignora tablas que fallan (aún no existen) y sigue buscando', async () => {
    const q = async (sql) => {
      if (sql.includes('packaged_coffee')) throw new Error('no such table');
      if (sql.includes('coffee_harvests')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    };
    await expect(getCurrentStage(q, 'LOT-1')).resolves.toBe('harvested');
  });
});

describe('assertCanAdvance()', () => {
  it('no lanza para una transición válida', async () => {
    const q = fakeQuery(['coffee_harvests']);
    await expect(assertCanAdvance(q, 'LOT-1', 'in_storage_green')).resolves.toBeUndefined();
  });

  it('lanza un error 409 con detalle accionable ante una transición inválida', async () => {
    // El lote ya está en in_storage_green; intentar registrar cosecha de nuevo
    // (retroceder) debe rechazarse.
    const q = fakeQuery(['coffee_harvests', 'green_coffee_inventory']);
    await expect(assertCanAdvance(q, 'LOT-1', 'harvested')).rejects.toMatchObject({
      status: 409,
      detail: {
        lot_id: 'LOT-1',
        current_stage: 'in_storage_green',
        target_stage: 'harvested',
        allowed_next_stages: ['sent_to_roasting'],
      },
    });
  });

  it('el mensaje de error es legible para el usuario final', async () => {
    const q = fakeQuery(['coffee_harvests', 'green_coffee_inventory']);
    await expect(assertCanAdvance(q, 'LOT-1', 'harvested')).rejects.toThrow(
      /LOT-1.*in_storage_green.*harvested/s
    );
  });

  it('es permisivo cuando el stage no se puede determinar (unknown)', async () => {
    const q = fakeQuery([]);
    await expect(assertCanAdvance(q, 'LOT-NUEVO', 'in_storage_green')).resolves.toBeUndefined();
  });

  it('no bloquea si la consulta de stage falla por completo', async () => {
    const q = async () => { throw new Error('conexión caída'); };
    await expect(assertCanAdvance(q, 'LOT-1', 'in_storage_green')).resolves.toBeUndefined();
  });

  it('rechaza saltarse etapas (cosecha directo a empacado) con 409', async () => {
    const q = fakeQuery(['coffee_harvests']);
    await expect(assertCanAdvance(q, 'LOT-1', 'packaged')).rejects.toMatchObject({ status: 409 });
  });
});

describe('STAGE_LABELS', () => {
  it('tiene una etiqueta para cada stage usado en TRANSITIONS', () => {
    const stagesInTransitions = new Set();
    // Importar TRANSITIONS indirectamente vía canTransitionTo no es posible;
    // se listan los stages conocidos del pipeline explícitamente.
    ['harvested', 'in_storage_green', 'sent_to_roasting', 'returned_to_green',
     'roasted', 'quality_check', 'in_storage_roasted', 'packaged', 'rejected', 'unknown']
      .forEach((s) => stagesInTransitions.add(s));

    for (const stage of stagesInTransitions) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});

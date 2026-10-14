import { describe, it, expect } from 'vitest';
import { orderDays, addDays } from '../subscription.ts';

describe('orderDays', () => {
  it('cada 30 días en 90 días da 4 pedidos, el primero hoy', () => {
    expect(orderDays(30)).toEqual([0, 30, 60, 90]);
  });
  it('cada 15 días en 90 días da 7 pedidos', () => {
    expect(orderDays(15)).toEqual([0, 15, 30, 45, 60, 75, 90]);
  });
  it('una frecuencia inválida deja solo el pedido de hoy', () => {
    expect(orderDays(0)).toEqual([0]);
    expect(orderDays(Number.NaN)).toEqual([0]);
  });
});

describe('addDays', () => {
  it('cruza de mes sin arrastrar la hora', () => {
    const d = addDays(new Date(2026, 9, 13, 22, 45), 30);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 12, 0]);
  });
});

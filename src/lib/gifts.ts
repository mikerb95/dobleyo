/**
 * Lo que trae cada kit de regalo, resumido a mano de su descripción en la BD.
 * Lo usan la caja del encabezado y las tarjetas de /regalos.
 *
 * Mientras SHOW_TRACEABILITY esté apagado no se menciona QR ni rastreo, aunque
 * la descripción del "Kit Trazabilidad Completa" los traiga.
 */
const CONTENTS: Record<string, string[]> = {
  'kit-iniciacion-barista': ['Café de origen único', 'Guía de preparación', 'Caja de regalo'],
  'kit-regalo-especial': ['Dos cafés de regiones distintas', 'Presentación especial para regalo'],
  'kit-trazabilidad-completa': ['Café de especialidad', 'Caja de regalo'],
};

/** Contenido de un kit. Uno nuevo sin entrada muestra lo que vale para todos. */
export function contentsOf(id: string): string[] {
  return CONTENTS[id] ?? ['Caja de regalo'];
}

/** Umbral de envío gratis en COP (igual que server/routes/orders.js y CartDrawer). */
export const FREE_SHIPPING_COP = 120000;

export function hasFreeShipping(priceCop: number): boolean {
  return Number(priceCop) >= FREE_SHIPPING_COP;
}

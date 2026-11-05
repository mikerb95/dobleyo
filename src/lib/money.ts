/**
 * Precios del sitio: siempre en pesos colombianos. Solo cambia la presentación.
 * En inglés se agrega "COP" porque "$72,000" sin moneda se lee como dólares.
 *
 * Módulo puro: se importa desde el servidor y desde los scripts del navegador.
 */
export function formatCop(amount: number | string | null | undefined, lang: "es" | "en" = "es"): string {
  const n = Number(amount) || 0;
  return lang === "en"
    ? `$${n.toLocaleString("en-US")} COP`
    : `$${n.toLocaleString("es-CO")}`;
}

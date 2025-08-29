export function formatCurrency(value: number, currency = 'COP', locale = 'es-CO') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

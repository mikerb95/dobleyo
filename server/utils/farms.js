// Utilidades para fincas (farms) en Turso/libSQL.
// Las listas se guardan como JSON en columnas TEXT; aquí se serializan/parsean.

const LIST_FIELDS = ['varieties', 'certifications', 'processes', 'gallery_urls'];

/** Convierte un valor (array | string JSON | string separado por comas) a array. */
export function parseList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // No es JSON: tratar como lista separada por comas/; (compatibilidad)
    return String(value).split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Normaliza una fila de finca: deja las listas como arrays para el frontend. */
export function parseFarmRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of LIST_FIELDS) {
    if (f in out) out[f] = parseList(out[f]);
  }
  return out;
}

/** Serializa un valor de lista a JSON string para guardar en BD (o null). */
export function serializeList(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    // Acepta JSON ya formado o lista separada por comas.
    return JSON.stringify(parseList(value));
  }
  return null;
}

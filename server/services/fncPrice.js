// Servicio de precio de referencia de la Federación Nacional de Cafeteros.
//
// La FNC no expone API. Publica un boletín diario en PDF sobre una URL que se
// sobrescribe cada día, así que el servicio lo descarga, lo parsea y cachea el
// resultado en `fnc_price_history`. La descarga es bajo demanda: solo ocurre
// cuando se consulta el módulo y todavía no hay registro del día.
import { query } from '../db.js';
import { logger } from '../logger.js';

const BASE = 'https://federaciondecafeteros.org/wp-content/uploads';

// La FNC mantiene el PDF en una carpeta fija aunque el contenido sea del día,
// por eso se prueban varias rutas antes de rendirse.
const KNOWN_PATH = '2026/03/precio_cafe.pdf';

const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const toInt = (s) => parseInt(String(s).replace(/[.,]/g, ''), 10);
const toFloat = (s) => parseFloat(String(s).replace(/,/g, ''));

/** Rutas candidatas del boletín, de la más probable a la menos. */
export function bulletinUrls(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prev = new Date(y, now.getMonth() - 1, 1);

  const paths = [
    KNOWN_PATH,
    `${y}/${pad(m)}/precio_cafe.pdf`,
    `${prev.getFullYear()}/${pad(prev.getMonth() + 1)}/precio_cafe.pdf`,
  ];

  return [...new Set(paths)].map((p) => `${BASE}/${p}`);
}

/**
 * Extrae los datos del texto plano del boletín.
 * Puro y sin I/O para poder probarlo con fixtures.
 */
export function parseFncBulletin(text, sourceUrl = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('Boletín FNC vacío o ilegible');
  }

  // "Julio 27 / 2026"
  const dateMatch = text.match(/([A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d{1,2})\s*\/\s*(\d{4})/);
  if (!dateMatch) throw new Error('No se encontró la fecha en el boletín FNC');

  const monthName = dateMatch[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const month = MONTHS[monthName];
  if (!month) throw new Error(`Mes no reconocido en el boletín FNC: ${dateMatch[1]}`);

  const priceDate = `${dateMatch[3]}-${String(month).padStart(2, '0')}-${String(dateMatch[2]).padStart(2, '0')}`;

  // "Precio total por carga de 125 Kg de pergamino seco FR 94 2,210,000 COP"
  const cargaMatch = text.match(/carga de 125\s*Kg de pergamino seco FR\s*(\d{2,3})\s+([\d,.]+)\s*COP/i);
  if (!cargaMatch) throw new Error('No se encontró el precio por carga en el boletín FNC');

  const baseYieldFactor = parseInt(cargaMatch[1], 10);
  const cargaCop = toInt(cargaMatch[2]);

  const pasillaMatch = text.match(/pasilla contenida en el pergamino\s+([\d,.]+)\s*COP\/Kg/i);
  const nyMatch = text.match(/Nueva York\s+([\d.,]+)\s*USCent\/Lb/i);

  // Tabla "PRECIOS DE REFERENCIA SEGÚN FACTOR DE RENDIMIENTO EN TRILLA".
  // Filas: factor, kg excelso, kg pasilla, valor excelso, valor pasilla, total.
  const yieldTable = [];
  const rowRe = /^(\d{2,3})\s+([\d.]+)\s+([\d.]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/;
  for (const line of text.split('\n')) {
    const m = line.trim().match(rowRe);
    if (!m) continue;
    const factor = parseInt(m[1], 10);
    if (factor < 60 || factor > 140) continue; // descarta filas de otras tablas

    const kgExcelso = toFloat(m[2]);
    const valorExcelso = toInt(m[4]);

    yieldTable.push({
      factor,
      kgExcelsoEnCarga: kgExcelso,
      kgPasillaEnCarga: toFloat(m[3]),
      valorExcelsoCargaCop: valorExcelso,
      valorPasillaCargaCop: toInt(m[5]),
      precioTotalPergaminoCargaCop: toInt(m[6]),
      // Lo que realmente sirve para comparar contra una compra de café verde.
      excelsoCopKg: kgExcelso > 0 ? Math.round((valorExcelso / kgExcelso) * 100) / 100 : null,
    });
  }

  // Tabla de sucursales de Almacafé: "ARMENIA 2,210,500 17,684 221,050"
  const branches = [];
  const branchRe = /^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .]+?)\s+([\d,]{7,})\s+([\d,]+)\s+([\d,]+)$/;
  for (const line of text.split('\n')) {
    const m = line.trim().match(branchRe);
    if (!m) continue;
    branches.push({
      sucursal: m[1].trim(),
      cargaCop: toInt(m[2]),
      kiloCop: toInt(m[3]),
      arrobaCop: toInt(m[4]),
    });
  }

  const baseRow = yieldTable.find((r) => r.factor === baseYieldFactor);

  return {
    priceDate,
    cargaCop,
    pasillaCopKg: pasillaMatch ? toInt(pasillaMatch[1]) : null,
    nyCloseUscentLb: nyMatch ? toFloat(nyMatch[1]) : null,
    baseYieldFactor,
    excelsoCopKg: baseRow?.excelsoCopKg ?? null,
    yieldTable,
    branches,
    sourceUrl,
  };
}

/** Descarga el PDF del boletín y devuelve su texto plano. */
async function downloadBulletinText() {
  const { PDFParse } = await import('pdf-parse');
  const errors = [];

  for (const url of bulletinUrls()) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DobleYoCafe/1.0 (+https://dobleyo.cafe)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        errors.push(`${url} → HTTP ${res.status}`);
        continue;
      }

      const buffer = new Uint8Array(await res.arrayBuffer());
      const parser = new PDFParse({ data: buffer });
      try {
        const { text } = await parser.getText();
        return { text, sourceUrl: url };
      } finally {
        await parser.destroy();
      }
    } catch (err) {
      errors.push(`${url} → ${err.message}`);
    }
  }

  throw new Error(`No se pudo descargar el boletín de la FNC. Intentos: ${errors.join(' | ')}`);
}

/** Guarda (o actualiza) el boletín parseado en el histórico. */
async function persist(data) {
  await query(
    `INSERT INTO fnc_price_history
       (price_date, carga_cop, pasilla_cop_kg, ny_close_uscent_lb,
        base_yield_factor, excelso_cop_kg, yield_table, branches, source_url, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(price_date) DO UPDATE SET
       carga_cop = excluded.carga_cop,
       pasilla_cop_kg = excluded.pasilla_cop_kg,
       ny_close_uscent_lb = excluded.ny_close_uscent_lb,
       base_yield_factor = excluded.base_yield_factor,
       excelso_cop_kg = excluded.excelso_cop_kg,
       yield_table = excluded.yield_table,
       branches = excluded.branches,
       source_url = excluded.source_url,
       fetched_at = datetime('now')`,
    [
      data.priceDate,
      data.cargaCop,
      data.pasillaCopKg,
      data.nyCloseUscentLb,
      data.baseYieldFactor,
      data.excelsoCopKg,
      JSON.stringify(data.yieldTable),
      JSON.stringify(data.branches),
      data.sourceUrl,
    ]
  );
}

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export function mapPriceRow(row) {
  if (!row) return null;
  return {
    priceDate: row.price_date,
    cargaCop: row.carga_cop,
    pasillaCopKg: row.pasilla_cop_kg,
    nyCloseUscentLb: row.ny_close_uscent_lb,
    baseYieldFactor: row.base_yield_factor,
    excelsoCopKg: row.excelso_cop_kg,
    yieldTable: parseJson(row.yield_table, []),
    branches: parseJson(row.branches, []),
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at,
  };
}

/** Último precio guardado, sin tocar la red. */
export async function getLatestStoredPrice() {
  const { rows } = await query(
    'SELECT * FROM fnc_price_history ORDER BY price_date DESC LIMIT 1'
  );
  return mapPriceRow(rows[0]);
}

/**
 * Precio vigente. Descarga el boletín solo si el último guardado no es de hoy,
 * o si se fuerza la actualización. Si la descarga falla pero hay histórico, se
 * devuelve el último conocido marcado como obsoleto en vez de reventar.
 */
export async function getFncPrice({ forceRefresh = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const stored = await getLatestStoredPrice();

  if (!forceRefresh && stored && stored.priceDate >= today) {
    return { price: stored, refreshed: false, stale: false };
  }

  try {
    const { text, sourceUrl } = await downloadBulletinText();
    const parsed = parseFncBulletin(text, sourceUrl);
    await persist(parsed);

    const price = await getLatestStoredPrice();
    return { price, refreshed: true, stale: false };
  } catch (err) {
    logger.error({ err }, '[fncPrice] Falló la actualización del boletín FNC');
    if (stored) {
      return { price: stored, refreshed: false, stale: true, error: err.message };
    }
    throw err;
  }
}

/**
 * Precio de referencia por kg de café verde para un factor de rendimiento dado.
 * Si el factor no está en la tabla del boletín, cae al factor base.
 */
export function excelsoRefForFactor(price, factor) {
  if (!price) return null;
  const table = price.yieldTable || [];
  const row = table.find((r) => r.factor === Number(factor));
  return row?.excelsoCopKg ?? price.excelsoCopKg ?? null;
}

/** Precio guardado con fecha igual o anterior a la dada (para comparar compras viejas). */
export async function getPriceOnOrBefore(date) {
  const { rows } = await query(
    'SELECT * FROM fnc_price_history WHERE price_date <= ? ORDER BY price_date DESC LIMIT 1',
    [date]
  );
  return mapPriceRow(rows[0]);
}

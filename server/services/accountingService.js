/**
 * Asientos contables de los costos de producción (partida doble).
 *
 * Cada costo del pipeline capitaliza el valor al inventario del lote: se debita
 * la cuenta de inventario que corresponde a la etapa (café verde, en proceso o
 * tostado) y se acredita la contrapartida según la forma de pago elegida en el
 * formulario (caja, banco o cuentas por pagar).
 *
 * Los asientos nacen en estado 'borrador': un admin los revisa y publica desde
 * el módulo de finanzas. Si la contabilización falla, el paso de producción ya
 * quedó guardado — el operario en finca nunca se bloquea por contabilidad.
 */
import { query } from '../db.js';

// ── Plan de cuentas del proceso ──────────────────────────────────────────────

/**
 * Cuenta que se debita por tipo de costo.
 * El costo se capitaliza al inventario: no toca resultados hasta la venta.
 */
const DEBIT_ACCOUNT = {
  farmer_payment:         '1410', // Café Verde
  transport_to_storage:   '1410', // Café Verde (el flete de entrada es mayor valor del inventario)
  transport_to_roaster:   '1440', // Café en Proceso
  roasting_service:       '1440', // Café en Proceso
  transport_to_warehouse: '1420', // Café Tostado
  packaging_material:     '1420', // Café Tostado
  labeling_material:      '1420', // Café Tostado
  other:                  '1440',
};

/** Cuenta que se acredita según la forma de pago. */
const CREDIT_ACCOUNT = {
  caja:  '1110', // Caja Principal
  banco: '1210', // Bancolombia CC
};

/** Con pago a crédito, la cuenta por pagar depende de a quién se le debe. */
const PAYABLE_ACCOUNT = {
  farmer:   '2120', // Cuentas por Pagar - Caficultores
  supplier: '2110', // Cuentas por Pagar - Proveedores
};

/** El insumo de empaque sale del inventario de empaques, no de caja. */
const SUPPLY_CREDIT_ACCOUNT = '1430'; // Empaques y Consumibles

const COST_LABEL = {
  farmer_payment:         'Pago a caficultor',
  transport_to_storage:   'Transporte a bodega',
  transport_to_roaster:   'Transporte a tostadora',
  roasting_service:       'Maquila de tostión',
  transport_to_warehouse: 'Transporte de retorno a bodega',
  packaging_material:     'Material de empaque',
  labeling_material:      'Etiquetas',
  other:                  'Otro costo de producción',
};

function bizError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ── Utilidades ───────────────────────────────────────────────────────────────

async function accountIdByCode(code) {
  const { rows } = await query('SELECT id FROM accounting_accounts WHERE code = ?', [code]);
  if (!rows.length) throw bizError(500, `Cuenta contable ${code} no encontrada en el plan de cuentas`);
  return rows[0].id;
}

async function productionJournalId() {
  const { rows } = await query("SELECT id FROM accounting_journals WHERE code = 'PROD'");
  if (!rows.length) throw bizError(500, "Diario 'PROD' no encontrado. Ejecute la migración create_cost_tracking.js");
  return rows[0].id;
}

/**
 * Número de asiento correlativo. `entry_number` es UNIQUE, así que ante una
 * colisión por concurrencia se reintenta con el siguiente consecutivo.
 */
async function nextEntryNumber() {
  const { rows } = await query(
    "SELECT COUNT(*) AS cnt FROM accounting_entries WHERE entry_number LIKE 'PROD-%'"
  );
  return parseInt(rows[0].cnt, 10) + 1;
}

/** Contrapartida del asiento: cuenta acreditada según forma de pago y origen. */
function creditAccountCode({ paymentMethod, costType, partnerKind, fromSupply }) {
  // Bolsas y etiquetas ya están en el inventario de empaques: al consumirlas se
  // traslada su valor al café tostado, sin movimiento de caja.
  if (fromSupply) return SUPPLY_CREDIT_ACCOUNT;
  if (paymentMethod === 'credito') {
    const kind = partnerKind || (costType === 'farmer_payment' ? 'farmer' : 'supplier');
    return PAYABLE_ACCOUNT[kind] || PAYABLE_ACCOUNT.supplier;
  }
  return CREDIT_ACCOUNT[paymentMethod] || CREDIT_ACCOUNT.caja;
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Crea el asiento en borrador de un costo de producción.
 *
 * @param {object} cost
 * @param {string} cost.lotId
 * @param {string} cost.costType    Clave de DEBIT_ACCOUNT
 * @param {number} cost.amount      Monto en COP (positivo)
 * @param {string} cost.paymentMethod 'caja' | 'banco' | 'credito'
 * @param {string} [cost.entryDate] `YYYY-MM-DD`; por defecto hoy
 * @param {number} [cost.partnerId] Usuario (caficultor/proveedor) del crédito a CxP
 * @param {'farmer'|'supplier'} [cost.partnerKind]
 * @param {boolean} [cost.fromSupply] El costo consume inventario de empaques
 * @param {number} [cost.userId]
 * @param {string} [cost.notes]
 * @returns {Promise<{entryId: number, entryNumber: string}>}
 */
export async function postCostEntry({
  lotId, costType, amount, paymentMethod = 'caja', entryDate,
  partnerId, partnerKind, fromSupply = false, userId, notes,
}) {
  const amountNum = Math.round((parseFloat(amount) + Number.EPSILON) * 100) / 100;
  if (!isFinite(amountNum) || amountNum <= 0) throw bizError(400, 'Monto inválido para el asiento contable');

  const debitCode  = DEBIT_ACCOUNT[costType];
  if (!debitCode) throw bizError(400, `Tipo de costo no reconocido: ${costType}`);
  const creditCode = creditAccountCode({ paymentMethod, costType, partnerKind, fromSupply });

  const [journalId, debitId, creditId] = await Promise.all([
    productionJournalId(), accountIdByCode(debitCode), accountIdByCode(creditCode),
  ]);

  const date = entryDate || new Date().toISOString().slice(0, 10);
  const label = COST_LABEL[costType] || costType;
  const description = `${label} · Lote ${lotId}`;

  // El asiento y sus dos líneas son una sola operación: un asiento sin líneas
  // descuadraría el libro.
  const seq = await nextEntryNumber();
  const entryNumber = `PROD-${String(seq).padStart(5, '0')}`;

  const { rows } = await query(
    `INSERT INTO accounting_entries
       (entry_number, journal_id, entry_date, reference, description,
        total_debit, total_credit, state, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'borrador', ?, datetime('now')) RETURNING id`,
    [entryNumber, journalId, date, lotId, description, amountNum, amountNum, userId || null]
  );
  const entryId = rows[0].id;

  await query(
    `INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit, partner_id, created_at)
     VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`,
    [entryId, debitId, description, amountNum, partnerId || null]
  );
  await query(
    `INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit, partner_id, created_at)
     VALUES (?, ?, ?, 0, ?, ?, datetime('now'))`,
    [entryId, creditId, notes || description, amountNum, partnerId || null]
  );

  return { entryId, entryNumber, debitCode, creditCode };
}

/**
 * Reversa un asiento de costeo. Si aún está en borrador se cancela; si ya fue
 * publicado se crea el asiento espejo, porque un asiento publicado no se borra.
 *
 * @returns {Promise<{reversed: boolean, reversalEntryId: number|null}>}
 */
export async function reverseCostEntry(entryId, { userId, reason } = {}) {
  const { rows } = await query(
    'SELECT id, entry_number, journal_id, entry_date, reference, description, total_debit, state FROM accounting_entries WHERE id = ?',
    [entryId]
  );
  if (!rows.length) return { reversed: false, reversalEntryId: null };
  const entry = rows[0];

  if (entry.state === 'cancelado') return { reversed: false, reversalEntryId: null };

  if (entry.state === 'borrador') {
    await query("UPDATE accounting_entries SET state = 'cancelado', updated_at = datetime('now') WHERE id = ?", [entryId]);
    return { reversed: true, reversalEntryId: null };
  }

  // Publicado: asiento espejo con débitos y créditos invertidos.
  const { rows: lines } = await query(
    'SELECT account_id, description, debit, credit, partner_id FROM accounting_entry_lines WHERE entry_id = ?',
    [entryId]
  );

  const seq = await nextEntryNumber();
  const entryNumber = `PROD-${String(seq).padStart(5, '0')}`;
  const description = `Reversión de ${entry.entry_number}${reason ? ` · ${reason}` : ''}`;

  const { rows: created } = await query(
    `INSERT INTO accounting_entries
       (entry_number, journal_id, entry_date, reference, description,
        total_debit, total_credit, state, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'borrador', ?, datetime('now')) RETURNING id`,
    [entryNumber, entry.journal_id, new Date().toISOString().slice(0, 10), entry.reference,
     description, entry.total_debit, entry.total_debit, userId || null]
  );
  const reversalId = created[0].id;

  for (const line of lines) {
    await query(
      `INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit, partner_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [reversalId, line.account_id, description, line.credit, line.debit, line.partner_id]
    );
  }

  return { reversed: true, reversalEntryId: reversalId };
}

export const __testing = { DEBIT_ACCOUNT, CREDIT_ACCOUNT, PAYABLE_ACCOUNT, creditAccountCode, COST_LABEL };

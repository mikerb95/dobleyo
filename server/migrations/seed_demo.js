#!/usr/bin/env node
/**
 * Seed de DEMO completo para DobleYo Café.
 *
 * Puebla todos los módulos del sitio con datos representativos para mostrar
 * la plataforma en vivo: usuarios (con login real), productos/variantes,
 * trazabilidad (fincas, cosechas, lotes), producción, inventario, ventas
 * (e-commerce, MercadoLibre, canales externos), demanda, CRM y finanzas.
 *
 * Es IDEMPOTENTE: se puede ejecutar varias veces sin duplicar datos. Cada
 * sección verifica una clave natural antes de insertar.
 *
 * Ejecutar:  node server/migrations/seed_demo.js
 *
 * Notas:
 *  - Turso/libSQL: parámetros posicionales `?`, fechas con datetime('now').
 *  - Todos los usuarios demo comparten la contraseña: Demo1234*
 *  - No toca los registros ya existentes (productos, usuarios admin, etc.).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import client, { query } from '../db.js';

const DEMO_PASSWORD = 'Demo1234*';

// Catálogo real (ids en BD) con precios COP, para construir ventas coherentes
const CATALOG = {
  'cf-huila': { title: 'Café Huila Geisha 500g', price: 45000, cat: 'cafe' },
  'cf-nar': { title: 'Café Nariño Castillo 500g', price: 48000, cat: 'cafe' },
  'cf-sierra': { title: 'Café Sierra Nevada 500g', price: 42000, cat: 'cafe' },
  'acc-chemex': { title: 'Chemex 6 tazas', price: 269900, cat: 'accesorio' },
  'acc-molinillo': { title: 'Molinillo Manual', price: 199900, cat: 'accesorio' },
  'kit-iniciacion-barista': { title: 'Kit Iniciación Barista', price: 89900, cat: 'kit' },
  'kit-regalo-especial': { title: 'Kit Regalo Especial', price: 129900, cat: 'kit' },
  'kit-trazabilidad-completa': { title: 'Kit Trazabilidad Completa', price: 159900, cat: 'kit' },
};

// Envía un lote de sentencias en un solo round-trip (mucho más rápido en Turso)
async function batch(stmts) {
  if (stmts.length) await client.batch(stmts, 'write');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const log = (...a) => console.log('  ', ...a);
const section = (t) => console.log(`\n▸ ${t}`);

async function exists(sql, args = []) {
  const r = await query(sql, args);
  return r.rows.length > 0;
}

async function scalarId(sql, args = []) {
  const r = await query(sql, args);
  return r.rows.length ? Number(r.rows[0].id) : null;
}

// Inserta si la clave única no existe; devuelve el id (nuevo o existente).
async function upsertId(table, uniqueCol, uniqueVal, insertSql, insertArgs) {
  const found = await scalarId(`SELECT id FROM ${table} WHERE ${uniqueCol} = ?`, [uniqueVal]);
  if (found) return found;
  const r = await query(insertSql, insertArgs);
  return Number(r.lastInsertRowid);
}

// Fecha ISO N días atrás (YYYY-MM-DD)
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
// Timestamp ISO N días atrás (YYYY-MM-DD HH:MM:SS)
function tsDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Ciudades colombianas con coordenadas (para mapas de calor de ventas)
const CITIES = [
  ['Bogotá', 'Cundinamarca', 4.7110, -74.0721],
  ['Medellín', 'Antioquia', 6.2442, -75.5812],
  ['Cali', 'Valle del Cauca', 3.4516, -76.5320],
  ['Barranquilla', 'Atlántico', 10.9685, -74.7813],
  ['Cartagena', 'Bolívar', 10.3910, -75.4794],
  ['Bucaramanga', 'Santander', 7.1193, -73.1227],
  ['Pereira', 'Risaralda', 4.8133, -75.6961],
  ['Manizales', 'Caldas', 5.0689, -75.5174],
  ['Armenia', 'Quindío', 4.5339, -75.6811],
  ['Santa Marta', 'Magdalena', 11.2408, -74.1990],
  ['Cúcuta', 'Norte de Santander', 7.8939, -72.5078],
  ['Ibagué', 'Tolima', 4.4389, -75.2322],
  ['Villavicencio', 'Meta', 4.1420, -73.6266],
  ['Pasto', 'Nariño', 1.2136, -77.2811],
  ['Neiva', 'Huila', 2.9273, -75.2819],
  ['Popayán', 'Cauca', 2.4448, -76.6147],
  ['Tunja', 'Boyacá', 5.5353, -73.3678],
  ['Montería', 'Córdoba', 8.7479, -75.8814],
  ['Valledupar', 'Cesar', 10.4631, -73.2532],
  ['Sincelejo', 'Sucre', 9.3047, -75.3978],
];
const pick = (arr, i) => arr[i % arr.length];

// ── 1. USUARIOS ─────────────────────────────────────────────────────────────
async function seedUsers(passwordHash) {
  section('Usuarios (contraseña demo: Demo1234*)');
  const users = [
    // Operarios de producción (rol admin para acceso a la app operativa)
    ['operario.tueste@demo.dobleyo.cafe', 'José', 'García', 'admin', 'none', 'Bogotá', 'Cundinamarca'],
    ['operario.calidad@demo.dobleyo.cafe', 'María', 'López', 'admin', 'none', 'Bogotá', 'Cundinamarca'],
    ['operario.empaque@demo.dobleyo.cafe', 'Carlos', 'Ruiz', 'admin', 'none', 'Bogotá', 'Cundinamarca'],
    // Caficultores aprobados
    ['caficultor.huila@demo.dobleyo.cafe', 'Juan', 'Pérez', 'caficultor', 'approved', 'Pitalito', 'Huila'],
    ['caficultor.narino@demo.dobleyo.cafe', 'Rosa', 'Martínez', 'caficultor', 'approved', 'La Unión', 'Nariño'],
    ['caficultor.sierra@demo.dobleyo.cafe', 'Luis', 'Sánchez', 'caficultor', 'approved', 'Santa Marta', 'Magdalena'],
    // Caficultor pendiente (para mostrar flujo de aprobación)
    ['caficultor.cauca@demo.dobleyo.cafe', 'Ana', 'Quiñones', 'caficultor', 'pending', 'Popayán', 'Cauca'],
    // Clientes
    ['cliente.andrea@demo.dobleyo.cafe', 'Andrea', 'González', 'client', 'none', 'Medellín', 'Antioquia'],
    ['cliente.fernando@demo.dobleyo.cafe', 'Fernando', 'Torres', 'client', 'none', 'Cali', 'Valle del Cauca'],
    ['cliente.laura@demo.dobleyo.cafe', 'Laura', 'Ramírez', 'client', 'none', 'Barranquilla', 'Atlántico'],
    ['cliente.diego@demo.dobleyo.cafe', 'Diego', 'Castro', 'client', 'none', 'Bucaramanga', 'Santander'],
    ['cliente.valentina@demo.dobleyo.cafe', 'Valentina', 'Mora', 'client', 'none', 'Bogotá', 'Cundinamarca'],
    // Cliente B2B (proveedor/empresa)
    ['compras.cafebar@demo.dobleyo.cafe', 'Sofía', 'Herrera', 'client', 'none', 'Bogotá', 'Cundinamarca'],
  ];
  const ids = {};
  let n = 0;
  for (const [email, first, last, role, cafStatus, city, state] of users) {
    const id = await upsertId('users', 'email', email,
      `INSERT INTO users (email, password_hash, first_name, last_name, name, mobile_phone, city, state_province, country, role, is_verified, caficultor_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Colombia', ?, 1, ?, datetime('now'))`,
      [email, passwordHash, first, last, `${first} ${last}`,
       '30' + String(10000000 + n * 111111).slice(0, 8), city, state, role, cafStatus]);
    ids[email] = id;
    n++;
  }
  log(`${Object.keys(ids).length} usuarios demo asegurados`);
  return ids;
}

// ── 2. SOLICITUDES DE CAFICULTOR + FINCAS ───────────────────────────────────
async function seedCaficultores(U) {
  section('Solicitudes de caficultor + cosechas');
  const adminId = await scalarId(`SELECT id FROM users WHERE email = '0368dev@gmail.com'`)
    || await scalarId(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);

  const apps = [
    [U['caficultor.huila@demo.dobleyo.cafe'], 'Finca El Paraíso', 'Pitalito, Huila', 25.5, 6000, 'Geisha, Caturra', 'FLO, Orgánico', 12, 'approved'],
    [U['caficultor.narino@demo.dobleyo.cafe'], 'Finca La Esperanza', 'La Unión, Nariño', 12.0, 2800, 'Castillo, Caturra', 'Rainforest Alliance', 8, 'approved'],
    [U['caficultor.sierra@demo.dobleyo.cafe'], 'Finca Sierra Azul', 'Santa Marta, Magdalena', 40.0, 9500, 'Typica, Bourbon', 'Orgánico', 20, 'approved'],
    [U['caficultor.cauca@demo.dobleyo.cafe'], 'Finca Las Nubes', 'Popayán, Cauca', 8.5, 1500, 'Castillo', 'En trámite', 5, 'pending'],
  ];
  for (const [uid, farm, location, ha, prod, varieties, certs, years, status] of apps) {
    if (!uid) continue;
    if (await exists('SELECT 1 FROM caficultor_applications WHERE user_id = ?', [uid])) continue;
    await query(
      `INSERT INTO caficultor_applications (user_id, farm_name, farm_location, farm_size_hectares, annual_production_kg, coffee_varieties, certifications, experience_years, motivation, status, reviewed_by, reviewed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-40 days'))`,
      [uid, farm, location, ha, prod, varieties, certs, years,
       'Quiero llevar mi café de especialidad a más tazas con trazabilidad real.', status,
       status === 'approved' ? adminId : null, status === 'approved' ? tsDaysAgo(38) : null]);
  }
  log(`${apps.length} solicitudes de caficultor aseguradas`);

  // Cosechas (coffee_harvests) — lot_id UNIQUE
  const harvests = [
    ['LOTE-HUI-2026-01', 'Finca El Paraíso', 'Geisha', 'Templado', 'Lavado', 'Floral, jazmín', 'Bergamota, durazno, té negro', 'Huila', 1800],
    ['LOTE-NAR-2026-01', 'Finca La Esperanza', 'Castillo', 'Frío de montaña', 'Honey', 'Caramelo, panela', 'Naranja, miel, chocolate con leche', 'Nariño', 2100],
    ['LOTE-SIE-2026-01', 'Finca Sierra Azul', 'Typica', 'Tropical', 'Natural', 'Frutos rojos', 'Mora, vino tinto, cacao', 'Magdalena', 1100],
  ];
  for (const h of harvests) {
    if (await exists('SELECT 1 FROM coffee_harvests WHERE lot_id = ?', [h[0]])) continue;
    await query(
      `INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, region, altitude, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','-35 days'))`, h);
  }
  log(`${harvests.length} cosechas aseguradas`);
}

// ── 2.5 CADENA DE TRAZABILIDAD COMPLETA ─────────────────────────────────────
// Completa la cadena de producción de cada cosecha para que /trazabilidad
// muestre la historia entera: almacén verde → tostión → tostado → almacén
// tostado → empaque (con SCA) → etiqueta (con notas de sabor). Idempotente.
async function seedTraceabilityChain() {
  section('Cadena de trazabilidad completa (cosecha → empaque → etiqueta)');

  // acidity/body/balance en escala 1-5 (las barras SCA del frontend usan val/5).
  const chain = [
    {
      lot: 'LOTE-HUI-2026-01', label: 'LBL-HUI-2026-0001',
      green_kg: 60, green_loc: 'Bodega Verde A · Pitalito',
      sent_kg: 55, target: 198, roast_level: 'Claro', roasted_kg: 46.5, loss: 15.5,
      actual_temp: 196, roast_min: 12, roast_obs: 'Perfil filtro, primer crack a 9:30.',
      rstore_loc: 'Almacén Tostado A', container: 'GrainPro', containers: 4,
      acidity: 5, body: 4, balance: 5, score: 89.5,
      presentation: 'Bolsa con válvula', grind: 'Grano entero', pkg_size: '500g', units: 90,
      flavor: 'Bergamota, Durazno, Té negro, Jazmín',
      origin: 'Huila', variety: 'Geisha', roast: 'Claro', process: 'Lavado', altitude: '1800 msnm', farm: 'Finca El Paraíso',
    },
    {
      lot: 'LOTE-NAR-2026-01', label: 'LBL-NAR-2026-0001',
      green_kg: 50, green_loc: 'Bodega Verde B · La Unión',
      sent_kg: 45, target: 202, roast_level: 'Medio', roasted_kg: 38.7, loss: 14.0,
      actual_temp: 201, roast_min: 14, roast_obs: 'Perfil balanceado, desarrollo 22%.',
      rstore_loc: 'Almacén Tostado A', container: 'GrainPro', containers: 3,
      acidity: 4, body: 4, balance: 5, score: 86.5,
      presentation: 'Bolsa con válvula', grind: 'Grano entero', pkg_size: '500g', units: 75,
      flavor: 'Naranja, Miel, Chocolate con leche, Panela',
      origin: 'Nariño', variety: 'Castillo', roast: 'Medio', process: 'Honey', altitude: '2100 msnm', farm: 'Finca La Esperanza',
    },
    {
      lot: 'LOTE-SIE-2026-01', label: 'LBL-SIE-2026-0001',
      green_kg: 70, green_loc: 'Bodega Verde C · Santa Marta',
      sent_kg: 65, target: 205, roast_level: 'Oscuro', roasted_kg: 54.6, loss: 16.0,
      actual_temp: 204, roast_min: 15, roast_obs: 'Perfil espresso, segundo crack incipiente.',
      rstore_loc: 'Almacén Tostado B', container: 'GrainPro', containers: 5,
      acidity: 3, body: 5, balance: 4, score: 84.0,
      presentation: 'Bolsa con válvula', grind: 'Grano entero', pkg_size: '500g', units: 105,
      flavor: 'Mora, Vino tinto, Cacao, Frutos rojos',
      origin: 'Magdalena', variety: 'Typica', roast: 'Oscuro', process: 'Natural', altitude: '1100 msnm', farm: 'Finca Sierra Azul',
    },
  ];

  let n = 0;
  for (const c of chain) {
    const harvestId = await scalarId('SELECT id FROM coffee_harvests WHERE lot_id = ?', [c.lot]);
    if (!harvestId) { log(`⚠️  Sin cosecha para ${c.lot}, omitido`); continue; }

    // Etapa 2 — Almacén café verde
    if (!await exists('SELECT 1 FROM green_coffee_inventory WHERE lot_id = ?', [c.lot])) {
      await query(
        `INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'Ingreso por cosecha', datetime('now','-32 days'))`,
        [harvestId, c.lot, c.green_kg, c.green_loc, daysAgo(32)]);
    }

    // Etapa 3 — Envío a tostión
    let roastingId = await scalarId('SELECT id FROM roasting_batches WHERE lot_id = ?', [c.lot]);
    if (!roastingId) {
      const r = await query(
        `INSERT INTO roasting_batches (lot_id, quantity_sent_kg, target_temp, notes, status, created_at)
         VALUES (?, ?, ?, 'Lote enviado a tostión', 'roasted', datetime('now','-20 days'))`,
        [c.lot, c.sent_kg, c.target]);
      roastingId = Number(r.lastInsertRowid);
    }

    // Etapa 4 — Tueste
    let roastedId = await scalarId('SELECT id FROM roasted_coffee WHERE roasting_id = ?', [roastingId]);
    if (!roastedId) {
      const r = await query(
        `INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, actual_temp, roast_time_minutes, observations, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'stored', datetime('now','-19 days'))`,
        [roastingId, c.roast_level, c.roasted_kg, c.loss, c.actual_temp, c.roast_min, c.roast_obs]);
      roastedId = Number(r.lastInsertRowid);
    }

    // Etapa 5 — Almacén café tostado
    let storeId = await scalarId('SELECT id FROM roasted_coffee_inventory WHERE roasted_id = ?', [roastedId]);
    if (!storeId) {
      const r = await query(
        `INSERT INTO roasted_coffee_inventory (roasted_id, location, container_type, container_count, storage_conditions, notes, status, created_at)
         VALUES (?, ?, ?, ?, 'Ambiente seco, 18°C', 'Listo para empaque', 'packaged', datetime('now','-18 days'))`,
        [roastedId, c.rstore_loc, c.container, c.containers]);
      storeId = Number(r.lastInsertRowid);
    }

    // Etapa 6 — Empaque + control de calidad SCA
    if (!await exists('SELECT 1 FROM packaged_coffee WHERE roasted_storage_id = ?', [storeId])) {
      await query(
        `INSERT INTO packaged_coffee (roasted_storage_id, acidity, body, balance, score, presentation, grind_size, package_size, unit_count, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Empaque y cata final', 'ready_for_sale', datetime('now','-15 days'))`,
        [storeId, c.acidity, c.body, c.balance, c.score, c.presentation, c.grind, c.pkg_size, c.units]);
    }

    // Etiqueta con QR (notas de sabor para los chips de la página pública)
    const qrData = `https://dobleyo.cafe/trazabilidad?lote=${c.label}`;
    await upsertId('generated_labels', 'label_code', c.label,
      `INSERT INTO generated_labels (label_code, lot_code, origin, variety, roast, process, altitude, farm, acidity, body, balance, score, flavor_notes, qr_data, printed, sequence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now','-14 days'))`,
      [c.label, c.lot, c.origin, c.variety, c.roast, c.process, c.altitude, c.farm,
       c.acidity, c.body, c.balance, c.score, c.flavor, qrData]);

    n++;
  }
  log(`${n} cadenas de trazabilidad completas (verde → tueste → empaque → etiqueta)`);
}

// ── 2.6 FICHA DE PRODUCTO: descripción + puntaje SCA coherente ──────────────
// Completa la descripción narrativa (solo si está vacía) y alinea el score de
// los lotes con el puntaje SCA mostrado en trazabilidad, para coherencia.
async function seedProductCopy() {
  section('Ficha de producto (descripción + SCA coherente)');
  const copy = [
    {
      id: 'cf-sierra', score: 84.0,
      desc: 'Procedente de la Sierra Nevada de Santa Marta, este lavado de variedad Typica ofrece una taza redonda y reconfortante. Su tueste medio realza notas a cacao, nuez y caramelo, con cuerpo equilibrado y un final limpio. Versátil tanto en espresso como en métodos de filtrado.',
    },
    {
      id: 'cf-huila', score: 89.5,
      desc: 'De las montañas del Huila, este Geisha de proceso honey y tueste claro entrega una taza floral y vibrante. Destacan los cítricos, el dulzor a miel y un perfil aromático delicado a jazmín. Su acidez brillante luce especialmente en V60 y Chemex.',
    },
    {
      id: 'cf-nar', score: 86.5,
      desc: 'Cultivado en las alturas de Nariño, este Castillo natural de tueste oscuro es intenso y envolvente. Presenta notas a frutas rojas, chocolate y té negro, con cuerpo pronunciado y un dulzor profundo. Pensado para quienes disfrutan un café con carácter, ideal en espresso.',
    },
  ];
  let nDesc = 0, nScore = 0;
  for (const c of copy) {
    const r = await query(
      `UPDATE products SET description = ? WHERE id = ? AND (description IS NULL OR description = '')`,
      [c.desc, c.id]);
    if (r.rowsAffected) nDesc++;
    const rs = await query(
      `UPDATE lots SET score = ? WHERE product_id = ? AND score IS NOT NULL`,
      [c.score, c.id]);
    nScore += rs.rowsAffected || 0;
  }
  log(`${nDesc} descripciones añadidas · ${nScore} lotes con SCA alineado`);
}

// ── 3. LOTES (trazabilidad) ─────────────────────────────────────────────────
async function seedLots() {
  section('Lotes de trazabilidad');
  const lots = [
    // code, name, origin, farm, producer, altitude, variety, process, harvest_date, estado, weight, product_id
    ['DY-LOTE-HUI-001', 'Huila Geisha Lavado', 'Huila', 'Finca El Paraíso', 'Juan Pérez', '1800m', 'Geisha', 'Lavado', daysAgo(120), 'tostado', 60, 'cf-huila'],
    ['DY-LOTE-NAR-001', 'Nariño Castillo Honey', 'Nariño', 'Finca La Esperanza', 'Rosa Martínez', '2100m', 'Castillo', 'Honey', daysAgo(95), 'tostado', 50, 'cf-nar'],
    ['DY-LOTE-SIE-001', 'Sierra Nevada Natural', 'Magdalena', 'Finca Sierra Azul', 'Luis Sánchez', '1100m', 'Typica', 'Natural', daysAgo(80), 'tostado', 70, 'cf-sierra'],
    ['DY-LOTE-HUI-002', 'Huila Caturra Verde', 'Huila', 'Finca El Paraíso', 'Juan Pérez', '1800m', 'Caturra', 'Lavado', daysAgo(20), 'verde', 200, null],
  ];
  for (const [code, name, origin, farm, producer, altitude, variety, process, hdate, estado, weight, pid] of lots) {
    await upsertId('lots', 'code', code,
      `INSERT INTO lots (code, name, origin, farm, producer, altitude, variety, process, harvest_date, estado, fecha_tostado, weight, weight_unit, product_id, score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'kg', ?, ?, datetime('now'))`,
      [code, name, origin, farm, producer, altitude, variety, process, hdate, estado,
       estado === 'tostado' ? daysAgo(15) : null, weight, pid, estado === 'tostado' ? 86.5 : null]);
  }
  log(`${lots.length} lotes asegurados`);
}

// ── 4. VARIANTES DE PRODUCTO + RESEÑAS + NEWSLETTER ─────────────────────────
async function seedProductExtras(U) {
  section('Variantes, reseñas y newsletter');
  const coffees = ['cf-huila', 'cf-nar', 'cf-sierra'];
  const variants = [
    ['250g', 'Grano Entero', 0.55, '-250-GE'],
    ['250g', 'Molido Filtro', 0.55, '-250-MF'],
    ['500g', 'Grano Entero', 1.0, '-500-GE'],
    ['500g', 'Molido Espresso', 1.0, '-500-ME'],
    ['1kg', 'Grano Entero', 1.9, '-1000-GE'],
  ];
  let vCount = 0;
  for (const pid of coffees) {
    const base = await query('SELECT price, stock_quantity FROM products WHERE id = ?', [pid]);
    if (!base.rows.length) continue;
    const basePrice = Number(base.rows[0].price);
    let order = 0;
    for (const [size, grind, mult, suffix] of variants) {
      order++;
      if (await exists('SELECT 1 FROM product_variants WHERE product_id=? AND size_label=? AND grind_label=?', [pid, size, grind])) continue;
      await query(
        `INSERT INTO product_variants (product_id, size_label, grind_label, price_cop, stock_quantity, sku_suffix, is_active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
        [pid, size, grind, Math.round(basePrice * mult / 100) * 100, 20 + order * 3, pid.toUpperCase() + suffix, order]);
      vCount++;
    }
  }
  log(`${vCount} variantes de producto aseguradas`);

  // Reseñas aprobadas
  const reviews = [
    ['cf-huila', 'cliente.andrea@demo.dobleyo.cafe', 'Andrea G.', 5, 'Increíble taza, notas a durazno muy claras. Mi café diario.'],
    ['cf-huila', 'cliente.diego@demo.dobleyo.cafe', 'Diego C.', 5, 'El mejor Huila que he probado. Empaque y trazabilidad de lujo.'],
    ['cf-nar', 'cliente.fernando@demo.dobleyo.cafe', 'Fernando T.', 4, 'Dulce y balanceado, ideal en V60. Volveré a comprar.'],
    ['cf-sierra', 'cliente.laura@demo.dobleyo.cafe', 'Laura R.', 5, 'Cuerpo intenso y notas a frutos rojos. Excelente para espresso.'],
    ['cf-sierra', 'cliente.valentina@demo.dobleyo.cafe', 'Valentina M.', 4, 'Muy bueno, llegó rápido y fresco. Recomendado.'],
    ['acc-chemex', 'cliente.andrea@demo.dobleyo.cafe', 'Andrea G.', 5, 'Hermosa y funcional, resalta los cafés de especialidad.'],
  ];
  let rCount = 0;
  for (const [pid, email, rname, rating, comment] of reviews) {
    const uid = U[email] || null;
    if (await exists('SELECT 1 FROM product_reviews WHERE product_id=? AND reviewer_name=? AND comment=?', [pid, rname, comment])) continue;
    await query(
      `INSERT INTO product_reviews (product_id, user_id, reviewer_name, rating, comment, is_approved, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now','-' || ? || ' days'))`,
      [pid, uid, rname, rating, comment, rCount * 5 + 3]);
    rCount++;
  }
  log(`${rCount} reseñas aseguradas`);

  // Newsletter
  const emails = [
    'andrea.suscriptor@demo.dobleyo.cafe', 'pedro.coffee@demo.dobleyo.cafe',
    'marcela.barista@demo.dobleyo.cafe', 'jorge.lovers@demo.dobleyo.cafe',
    'natalia.specialty@demo.dobleyo.cafe', 'camilo.roast@demo.dobleyo.cafe',
  ];
  let nCount = 0;
  for (const e of emails) {
    if (await exists('SELECT 1 FROM newsletter_subscribers WHERE email=?', [e])) continue;
    await query(`INSERT INTO newsletter_subscribers (email, source, created_at) VALUES (?, 'footer', datetime('now','-' || ? || ' days'))`, [e, nCount * 7 + 2]);
    nCount++;
  }
  log(`${nCount} suscriptores de newsletter asegurados`);
}

// ── 5. VENTAS MERCADOLIBRE (sales_tracking → mapa de calor) ─────────────────
async function seedSalesTracking() {
  section('Ventas MercadoLibre (mapa de calor)');
  const coffeeIds = ['cf-huila', 'cf-nar', 'cf-sierra'];
  const extraIds = ['kit-iniciacion-barista', 'kit-regalo-especial', 'acc-molinillo'];
  const stmts = [];
  const N = 55;
  for (let i = 0; i < N; i++) {
    const ml = 9100001 + i;
    const [city, state, lat, lng] = pick(CITIES, i);
    // dispersa coordenadas levemente para que el heatmap no apile puntos
    const jLat = lat + (((i * 37) % 100) - 50) / 2000;
    const jLng = lng + (((i * 53) % 100) - 50) / 2000;
    const day = Math.floor((i / N) * 175) + (i % 7);

    const items = [];
    const c = CATALOG[pick(coffeeIds, i)];
    const q1 = 1 + (i % 3);
    items.push({ title: c.title, quantity: q1, unit_price: c.price });
    if (i % 4 === 0) {
      const e = CATALOG[pick(extraIds, i)];
      items.push({ title: e.title, quantity: 1, unit_price: e.price });
    }
    const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const status = i % 11 === 0 ? 'cancelled' : (i % 5 === 0 ? 'paid' : 'delivered');

    stmts.push({
      sql: `INSERT OR IGNORE INTO sales_tracking
        (ml_order_id, purchase_date, total_amount, order_status, shipping_method,
         recipient_city, recipient_state, recipient_country, recipient_zip_code,
         latitude, longitude, products, sync_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Colombia', ?, ?, ?, ?, datetime('now'), ?)`,
      args: [ml, tsDaysAgo(day), total, status,
        i % 2 === 0 ? 'Mercado Envíos' : 'Envío estándar',
        city, state, String(110000 + i * 7),
        Number(jLat.toFixed(6)), Number(jLng.toFixed(6)),
        JSON.stringify(items), tsDaysAgo(day)],
    });
  }
  await batch(stmts);
  const cnt = await scalarId(`SELECT COUNT(*) AS id FROM sales_tracking`);
  log(`${cnt} ventas MercadoLibre en BD (objetivo ${N})`);
}

// ── 6. PEDIDOS E-COMMERCE (customer_orders pagados/enviados con geo) ─────────
async function seedCustomerOrders(U) {
  section('Pedidos e-commerce (tienda)');
  const clientEmails = [
    'cliente.andrea@demo.dobleyo.cafe', 'cliente.fernando@demo.dobleyo.cafe',
    'cliente.laura@demo.dobleyo.cafe', 'cliente.diego@demo.dobleyo.cafe',
    'cliente.valentina@demo.dobleyo.cafe',
  ];
  const statuses = ['paid', 'shipped', 'delivered', 'processing', 'delivered', 'paid'];
  const orderStmts = [];
  const plan = [];
  for (let i = 0; i < 12; i++) {
    const ref = `DEMO-ORD-${String(i + 1).padStart(3, '0')}`;
    const email = pick(clientEmails, i);
    const uid = U[email] || null;
    const [city, state, lat, lng] = pick(CITIES, i * 3);
    const name = email.split('@')[0].replace('cliente.', '').replace(/^./, (c) => c.toUpperCase());
    // 1-3 ítems
    const ids = Object.keys(CATALOG);
    const items = [];
    const nItems = 1 + (i % 3);
    for (let k = 0; k < nItems; k++) {
      const pid = pick(ids, i + k * 2);
      const p = CATALOG[pid];
      items.push({ pid, title: p.title, price: p.price, qty: 1 + ((i + k) % 2) });
    }
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const shipping = subtotal >= 120000 ? 0 : 12000;
    const total = subtotal + shipping;
    const day = 5 + i * 6;
    orderStmts.push({
      sql: `INSERT OR IGNORE INTO customer_orders
        (reference, status, customer_name, customer_email, customer_phone, shipping_address,
         shipping_city, shipping_department, shipping_zip, subtotal_cop, shipping_cop, total_cop,
         payment_method, payment_transaction_id, notes, user_id, created_at, updated_at,
         geocoding_lat, geocoding_lng, geocoding_city_norm, geocoding_done)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pedido demo', ?, ?, ?, ?, ?, ?, 1)`,
      args: [ref, pick(statuses, i), name, email, '30' + String(20000000 + i * 123456).slice(0, 8),
        `Calle ${10 + i} # ${20 + i}-${30 + i}`, city, state, String(110000 + i * 11),
        subtotal, shipping, total, i % 2 === 0 ? 'wompi' : 'mercadopago',
        `TXN-DEMO-${1000 + i}`, uid, tsDaysAgo(day), tsDaysAgo(day),
        Number(lat.toFixed(6)), Number(lng.toFixed(6)), city.toLowerCase()],
    });
    plan.push({ ref, items });
  }
  await batch(orderStmts);

  // Ítems (requieren el id del pedido recién insertado)
  const itemStmts = [];
  for (const { ref, items } of plan) {
    const oid = await scalarId(`SELECT id FROM customer_orders WHERE reference = ?`, [ref]);
    if (!oid) continue;
    if (await exists('SELECT 1 FROM customer_order_items WHERE order_id = ?', [oid])) continue;
    for (const it of items) {
      itemStmts.push({
        sql: `INSERT INTO customer_order_items (order_id, product_id, product_name, unit_price_cop, quantity, subtotal_cop)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [oid, it.pid, it.title, it.price, it.qty, it.price * it.qty],
      });
    }
  }
  await batch(itemStmts);
  log(`12 pedidos demo + ${itemStmts.length} ítems asegurados`);
}

// ── 7. VENTAS POR CANALES EXTERNOS (Instagram, WhatsApp, etc.) ──────────────
async function seedExternalSales(U) {
  section('Ventas por canales externos');
  const adminId = U['operario.empaque@demo.dobleyo.cafe'] || null;
  const channels = [
    ['instagram', '@dobleyo.cafe'], ['whatsapp', 'Línea +57 300'], ['referido', 'Cliente frecuente'],
    ['tienda_fisica', 'Punto Usaquén'], ['telefono', 'Pedido telefónico'], ['instagram', 'Historia destacada'],
  ];
  const ids = Object.keys(CATALOG);
  const saleStmts = [];
  const plan = [];
  for (let i = 0; i < 15; i++) {
    const num = `EXT-DEMO-${String(i + 1).padStart(3, '0')}`;
    const [channel, detail] = pick(channels, i);
    const [city, state] = pick(CITIES, i * 2);
    const items = [];
    const nItems = 1 + (i % 2);
    for (let k = 0; k < nItems; k++) {
      const pid = pick(ids, i + k);
      items.push({ pid, price: CATALOG[pid].price, qty: 1 + (i % 3) });
    }
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const discount = i % 4 === 0 ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal - discount;
    saleStmts.push({
      sql: `INSERT OR IGNORE INTO external_sales
        (sale_number, channel, channel_detail, customer_name, customer_contact, customer_city, customer_state,
         sale_date, subtotal, discount, total, status, registered_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completada', ?, ?)`,
      args: [num, channel, detail, `Cliente ${channel} ${i + 1}`, '@usuario' + i, city, state,
        daysAgo(3 + i * 4), subtotal, discount, total, adminId, tsDaysAgo(3 + i * 4)],
    });
    plan.push({ num, items });
  }
  await batch(saleStmts);

  const itemStmts = [];
  for (const { num, items } of plan) {
    const sid = await scalarId(`SELECT id FROM external_sales WHERE sale_number = ?`, [num]);
    if (!sid) continue;
    if (await exists('SELECT 1 FROM external_sale_items WHERE sale_id = ?', [sid])) continue;
    for (const it of items) {
      itemStmts.push({
        sql: `INSERT INTO external_sale_items (sale_id, product_id, quantity, unit_price, subtotal, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [sid, it.pid, it.qty, it.price, it.price * it.qty],
      });
    }
  }
  await batch(itemStmts);
  log(`15 ventas externas + ${itemStmts.length} ítems aseguradas`);
}

// ── 8. DEMANDA (demand_records — módulo de demanda) ─────────────────────────
async function seedDemandRecords() {
  section('Registros de demanda');
  if (await exists(`SELECT 1 FROM demand_records WHERE notes = 'SEED-DEMO' LIMIT 1`)) {
    log('Ya existen registros de demanda demo, omitido');
    return;
  }
  const cats = [
    ['cafe-grano', ['Huila Geisha 500g', 'Nariño Castillo 500g', 'Sierra Nevada 500g'], 'units'],
    ['cafe-molido', ['Huila Molido 250g', 'Nariño Molido 250g'], 'units'],
    ['kits-regalo', ['Kit Regalo Especial', 'Kit Trazabilidad'], 'units'],
    ['accesorios', ['Chemex 6 tazas', 'Molinillo Manual'], 'units'],
    ['mayorista-b2b', ['Café Verde Huila', 'Café Verde Nariño'], 'kg'],
    ['suscripcion', ['Plan mensual 500g', 'Plan quincenal 250g'], 'units'],
  ];
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  const stmts = [];
  for (const [cat, products, unit] of cats) {
    for (let m = 0; m < months.length; m++) {
      const product = pick(products, m);
      // tendencia creciente con algo de ruido
      const base = unit === 'kg' ? 120 : 40;
      const value = Math.round((base + m * (base * 0.12) + ((m * 17) % 11)) * 10) / 10;
      stmts.push({
        sql: `INSERT INTO demand_records (category, product_key, period, demand_value, unit, notes, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'SEED-DEMO', datetime('now'), datetime('now'))`,
        args: [cat, product, months[m], value, unit],
      });
    }
  }
  await batch(stmts);
  log(`${stmts.length} registros de demanda creados`);
}

// ── 9. CRM (cuentas B2B, contactos, interacciones) ──────────────────────────
async function seedCRM(U) {
  section('CRM B2B');
  const owner = U['compras.cafebar@demo.dobleyo.cafe'] || null;
  const adminOwner = await scalarId(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);
  const accounts = [
    ['Café Bar Quindío SAS', 'Café Bar Quindío', 'cafeteria', 'Quindío', 'Armenia', '901111111', 'negotiation', 4800000, 'instagram'],
    ['Restaurante La Terraza', 'La Terraza', 'cafeteria', 'Cundinamarca', 'Bogotá', '901222222', 'sample_sent', 2600000, 'referido'],
    ['Supermercados El Trigal', 'El Trigal', 'retail', 'Antioquia', 'Medellín', '901333333', 'active', 12500000, 'feria'],
    ['Hotel Boutique Andino', 'Hotel Andino', 'hotel', 'Caldas', 'Manizales', '901444444', 'prospect', 1800000, 'web'],
    ['Distribuidora Pacífico', 'Distri Pacífico', 'distributor_co', 'Valle del Cauca', 'Cali', '901555555', 'contacted', 7200000, 'llamada'],
    ['Bright Coffee Imports LLC', 'Bright Coffee US', 'importer_us', 'Florida', 'Miami', 'US-99887766', 'lost', 0, 'web'],
  ];
  let aCount = 0;
  for (const [legal, display, segment, region, city, tax, stage, value, source] of accounts) {
    let aid = await scalarId(`SELECT id FROM crm_accounts WHERE legal_name = ?`, [legal]);
    if (!aid) {
      const r = await query(
        `INSERT INTO crm_accounts (legal_name, display_name, segment, country, region, city, tax_id, pipeline_stage, pipeline_value, owner_user_id, source, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'CO', ?, ?, ?, ?, ?, ?, ?, 'Cuenta demo', datetime('now','-30 days'), datetime('now'))`,
        [legal, display, segment, region, city, tax, stage, value, owner || adminOwner, source]);
      aid = Number(r.lastInsertRowid);
      aCount++;
      // contacto principal
      await query(
        `INSERT INTO crm_contacts (account_id, full_name, role, email, phone, is_primary, created_at)
         VALUES (?, ?, 'Compras', ?, ?, 1, datetime('now','-30 days'))`,
        [aid, `Contacto ${display}`, `compras@${display.toLowerCase().replace(/[^a-z]/g, '')}.com`, '60' + tax.slice(0, 7)]);
      // interacciones
      const kinds = [['call', 'Llamada de descubrimiento'], ['email', 'Envío de catálogo y precios'], ['sample', 'Cata de producto en sitio'], ['quote', 'Cotización enviada']];
      for (let k = 0; k < kinds.length; k++) {
        await query(
          `INSERT INTO crm_interactions (account_id, kind, subject, body, occurred_at, created_by, created_at)
           VALUES (?, ?, ?, ?, datetime('now','-' || ? || ' days'), ?, datetime('now'))`,
          [aid, kinds[k][0], kinds[k][1], 'Interacción demo registrada para seguimiento comercial.',
           28 - k * 7, adminOwner]);
      }
    }
  }
  log(`${aCount} cuentas CRM nuevas (con contactos e interacciones)`);
}

// ── 10. PRODUCCIÓN (estaciones, equipos, perfiles, BOMs, órdenes) ───────────
async function seedProduction(U) {
  section('Producción');
  const operario = U['operario.tueste@demo.dobleyo.cafe'] || null;
  const admin = await scalarId(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);

  // Estaciones de trabajo
  await batch([
    ['WC-001', 'Tostadora Principal', 'tostado', 120, 'kg', 50000, 'Planta - Área 1'],
    ['WC-002', 'Molino Industrial', 'molido', 150, 'kg', 35000, 'Planta - Área 2'],
    ['WC-003', 'Línea de Empaque', 'empaque', 300, 'unidades', 30000, 'Planta - Área 3'],
    ['WC-004', 'Laboratorio Calidad', 'control_calidad', 50, 'kg', 40000, 'Planta - Área 4'],
  ].map(([code, name, type, cap, unit, cost, loc]) => ({
    sql: `INSERT OR IGNORE INTO work_centers (code, name, work_center_type, capacity_per_hour, capacity_unit, cost_per_hour, is_active, location, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
    args: [code, name, type, cap, unit, cost, loc],
  })));
  const wc1 = await scalarId(`SELECT id FROM work_centers WHERE code='WC-001'`);

  // Equipos de tostado
  await batch([
    ['EQ-001', 'Tostadora Probat L12', 'Probat', 'L12', 50, 20, 50, 'gas', 18],
    ['EQ-002', 'Loring Smart Roaster', 'Loring', 'S15', 60, 25, 60, 'gas', 20],
  ].map(([code, name, brand, model, cap, mn, mx, fuel, t]) => ({
    sql: `INSERT OR IGNORE INTO roasting_equipment (work_center_id, equipment_code, equipment_name, brand, model, batch_capacity_kg, min_batch_kg, max_batch_kg, fuel_type, roast_time_minutes, is_operational, last_maintenance_date, next_maintenance_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))`,
    args: [wc1, code, name, brand, model, cap, mn, mx, fuel, t, daysAgo(30), daysAgo(-30)],
  })));
  const eq1 = await scalarId(`SELECT id FROM roasting_equipment WHERE equipment_code='EQ-001'`);

  // Perfiles de tostado
  await batch([
    ['PROF-001', 'Ligero Especialidad', 'ligero', 195, 12, 'Geisha, Castillo de altura', 'Floral, frutal, ácido brillante'],
    ['PROF-002', 'Medio Balanceado', 'medio', 200, 14, 'Caturra, Castillo', 'Chocolate, panela, cuerpo medio'],
    ['PROF-003', 'Medio-Oscuro Casa', 'medio_oscuro', 203, 15, 'Typica, Bourbon', 'Caramelo, nuez, cuerpo completo'],
  ].map(([code, name, level, temp, dur, varieties, flavor]) => ({
    sql: `INSERT OR IGNORE INTO roast_profiles (profile_code, profile_name, roast_level, target_temperature_celsius, roast_duration_minutes, suitable_for_varieties, flavor_profile, is_active, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
    args: [code, name, level, temp, dur, varieties, flavor, admin],
  })));

  // BOMs (recetas) para cada café tostado
  const bomMap = { 'BOM-HUI': 'cf-huila', 'BOM-NAR': 'cf-nar', 'BOM-SIE': 'cf-sierra' };
  await batch(Object.entries(bomMap).map(([code, pid]) => ({
    sql: `INSERT OR IGNORE INTO bill_of_materials (bom_code, product_id, product_qty, product_unit, bom_type, work_center_id, estimated_time_minutes, loss_percentage, is_active, created_at)
          VALUES (?, ?, 1, 'kg', 'tostado', ?, 20, 15.0, 1, datetime('now'))`,
    args: [code, pid, wc1],
  })));

  // Órdenes de producción en distintos estados
  const orderStmts = [];
  const ordPlan = [
    ['PO-DEMO-001', 'BOM-HUI', 'cf-huila', 50, 'completada', 'normal', 20],
    ['PO-DEMO-002', 'BOM-NAR', 'cf-nar', 40, 'en_progreso', 'alta', 5],
    ['PO-DEMO-003', 'BOM-SIE', 'cf-sierra', 60, 'confirmada', 'normal', -2],
    ['PO-DEMO-004', 'BOM-HUI', 'cf-huila', 30, 'borrador', 'baja', -7],
  ];
  for (const [num, bomCode, pid, qty, state, prio, schedOffset] of ordPlan) {
    const bomId = await scalarId(`SELECT id FROM bill_of_materials WHERE bom_code=?`, [bomCode]);
    if (!bomId) continue;
    orderStmts.push({
      sql: `INSERT OR IGNORE INTO production_orders
        (order_number, bom_id, product_id, planned_quantity, produced_quantity, quantity_unit, work_center_id, roasting_equipment_id,
         state, priority, scheduled_date, expected_loss_percentage, production_cost, responsible_user_id, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'kg', ?, ?, ?, ?, ?, 15.0, ?, ?, ?, datetime('now'))`,
      args: [num, bomId, pid, qty, state === 'completada' ? qty * 0.85 : (state === 'en_progreso' ? qty * 0.4 : 0),
        wc1, eq1, state, prio, daysAgo(schedOffset), state === 'completada' ? qty * 22000 : 0, operario, admin],
    });
  }
  await batch(orderStmts);
  log('4 estaciones, 2 equipos, 3 perfiles, 3 BOMs y 4 órdenes de producción aseguradas');
}

// ── 11. MOVIMIENTOS DE INVENTARIO ───────────────────────────────────────────
async function seedInventoryMovements(U) {
  section('Movimientos de inventario');
  if (await exists(`SELECT 1 FROM inventory_movements WHERE reference LIKE 'SEED-MOV-%' LIMIT 1`)) {
    log('Movimientos demo ya existen, omitido');
    return;
  }
  const user = await scalarId(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);
  const stmts = [];
  let seq = 0;
  for (const pid of Object.keys(CATALOG)) {
    const cur = await query('SELECT stock_quantity FROM products WHERE id=?', [pid]);
    if (!cur.rows.length) continue;
    let stock = Number(cur.rows[0].stock_quantity);
    // entrada de producción + un par de salidas por venta
    const moves = [
      ['entrada', 30, 'Ingreso por producción'],
      ['salida', -8, 'Venta tienda online'],
      ['salida', -5, 'Venta MercadoLibre'],
      ['ajuste', -2, 'Ajuste por inventario físico'],
    ];
    for (const [type, qty, reason] of moves) {
      seq++;
      const before = stock - qty; // estado anterior reconstruido
      stmts.push({
        sql: `INSERT INTO inventory_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, user_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','-' || ? || ' days'))`,
        args: [pid, type, Math.abs(qty), before, stock, reason, `SEED-MOV-${String(seq).padStart(3, '0')}`, user, seq % 20],
      });
    }
  }
  await batch(stmts);
  log(`${stmts.length} movimientos de inventario creados`);
}

// ── 12. FINANZAS (plan de cuentas, maestros y transacciones) ────────────────
async function seedFinance(U) {
  section('Finanzas');

  // Plan de cuentas (subconjunto operativo)
  const accounts = [
    ['1110', 'Caja Principal', 'activo', 'efectivo'],
    ['1210', 'Bancolombia Cuenta Corriente', 'activo', 'banco'],
    ['1220', 'BBVA Ahorros', 'activo', 'banco'],
    ['1300', 'Cuentas por Cobrar Clientes', 'activo', 'cuentas_por_cobrar'],
    ['1410', 'Inventario Café Verde', 'activo', 'inventario'],
    ['1420', 'Inventario Café Tostado', 'activo', 'inventario'],
    ['2110', 'Cuentas por Pagar Proveedores', 'pasivo', 'cuentas_por_pagar'],
    ['2210', 'IVA por Pagar', 'pasivo', null],
    ['3100', 'Capital Social', 'patrimonio', 'capital'],
    ['4110', 'Ingresos Venta Café Tostado', 'ingreso', 'venta_producto'],
    ['4120', 'Ingresos Venta Accesorios', 'ingreso', 'venta_producto'],
    ['5100', 'Costo Café Verde', 'costo', 'costo_venta'],
    ['6100', 'Sueldos y Salarios', 'gasto', 'gasto_administrativo'],
    ['6200', 'Arrendamiento', 'gasto', 'gasto_administrativo'],
    ['7100', 'Publicidad y Marketing', 'gasto', 'gasto_venta'],
    ['5210', 'Energía y Gas', 'gasto', 'gasto_operativo'],
  ];
  await batch(accounts.map(([code, name, type, sub]) => ({
    sql: `INSERT OR IGNORE INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at)
          VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    args: [code, name, type, sub],
  })));

  // Diarios
  await batch([
    ['VEN', 'Diario de Ventas', 'venta'], ['COM', 'Diario de Compras', 'compra'],
    ['BAN', 'Diario de Banco', 'banco'], ['CAJ', 'Diario de Caja', 'caja'], ['GEN', 'Diario General', 'general'],
  ].map(([code, name, type]) => ({
    sql: `INSERT OR IGNORE INTO accounting_journals (code, name, journal_type, is_active, created_at) VALUES (?, ?, ?, 1, datetime('now'))`,
    args: [code, name, type],
  })));

  // Métodos de pago
  await batch([
    ['EFEC', 'Efectivo', 'efectivo', 0], ['TRANS', 'Transferencia', 'transferencia', 1],
    ['TDEB', 'Tarjeta Débito', 'tarjeta_debito', 1], ['TCRED', 'Tarjeta Crédito', 'tarjeta_credito', 1], ['PSE', 'PSE', 'pse', 1],
  ].map(([code, name, type, ref]) => ({
    sql: `INSERT OR IGNORE INTO payment_methods (code, name, method_type, is_active, requires_reference, created_at) VALUES (?, ?, ?, 1, ?, datetime('now'))`,
    args: [code, name, type, ref],
  })));

  // Centros de costo
  await batch([
    ['CC-001', 'Tostado'], ['CC-002', 'Molido y Empaque'], ['CC-003', 'Calidad'], ['CC-004', 'Administración'], ['CC-005', 'Ventas'],
  ].map(([code, name]) => ({
    sql: `INSERT OR IGNORE INTO cost_centers (code, name, is_active, created_at) VALUES (?, ?, 1, datetime('now'))`,
    args: [code, name],
  })));

  // Impuestos
  await batch([
    ['IVA19', 'IVA 19%', 19, 'iva'], ['IVA5', 'IVA 5%', 5, 'iva'], ['RFTE', 'Retención Fuente 2.5%', 2.5, 'retencion_renta'],
  ].map(([code, name, rate, type]) => ({
    sql: `INSERT OR IGNORE INTO tax_rates (code, name, rate_percent, tax_type, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    args: [code, name, rate, type],
  })));

  // Cuentas bancarias
  for (const [bank, num, type, bal] of [
    ['Bancolombia', '05234567890', 'corriente', 18500000],
    ['BBVA', '00987654321', 'ahorros', 7200000],
  ]) {
    if (!await exists('SELECT 1 FROM bank_accounts WHERE account_number=?', [num])) {
      await query(`INSERT INTO bank_accounts (bank_name, account_number, account_type, currency, current_balance, is_active, created_at) VALUES (?, ?, ?, 'COP', ?, 1, datetime('now'))`,
        [bank, num, type, bal]);
    }
  }

  // Proveedores
  for (const [name, contact, email] of [
    ['Empaques Colombia SAS', 'Pedro López', 'ventas@empaquescol.com'],
    ['Equipos Industriales SA', 'Marco Pérez', 'soporte@equiposind.com'],
  ]) {
    if (!await exists('SELECT 1 FROM product_suppliers WHERE name=?', [name])) {
      await query(`INSERT INTO product_suppliers (name, contact_name, email, payment_terms, is_active, created_at) VALUES (?, ?, ?, 'Neto 30', 1, datetime('now'))`,
        [name, contact, email]);
    }
  }

  // ── Transacciones ──
  const pmTrans = await scalarId(`SELECT id FROM payment_methods WHERE code='TRANS'`);
  const bankId = await scalarId(`SELECT id FROM bank_accounts WHERE account_number='05234567890'`);
  const supplierId = await scalarId(`SELECT id FROM product_suppliers WHERE name='Empaques Colombia SAS'`);
  const clientIds = (await query(`SELECT id FROM users WHERE role='client' ORDER BY id LIMIT 5`)).rows.map(r => Number(r.id));
  const caficultorId = U['caficultor.huila@demo.dobleyo.cafe'] || null;
  const admin = await scalarId(`SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1`);

  // Facturas de venta + líneas + pagos recibidos
  let invStmts = [];
  const invPlan = [];
  for (let i = 0; i < 8; i++) {
    const num = `FV-DEMO-${String(i + 1).padStart(3, '0')}`;
    const customer = clientIds.length ? pick(clientIds, i) : admin;
    const pid = pick(['cf-huila', 'cf-nar', 'cf-sierra'], i);
    const qty = 5 + i;
    const unit = CATALOG[pid].price;
    const subtotal = qty * unit;
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const state = i % 3 === 0 ? 'pagada' : (i % 3 === 1 ? 'confirmada' : 'pagada_parcial');
    const paid = state === 'pagada' ? total : (state === 'pagada_parcial' ? Math.round(total * 0.5) : 0);
    invStmts.push({
      sql: `INSERT OR IGNORE INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, state, payment_term_days, subtotal, tax_amount, total_amount, amount_paid, amount_due, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 30, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [num, customer, daysAgo(i * 9 + 5), daysAgo(i * 9 - 25), state, subtotal, tax, total, paid, total - paid, admin],
    });
    invPlan.push({ num, pid, qty, unit, subtotal, tax, total, paid, state, customer, idx: i });
  }
  await batch(invStmts);

  // Líneas de factura + pagos
  const lineStmts = [];
  const payStmts = [];
  for (const inv of invPlan) {
    const invId = await scalarId(`SELECT id FROM sales_invoices WHERE invoice_number=?`, [inv.num]);
    if (!invId) continue;
    if (!await exists('SELECT 1 FROM sales_invoice_lines WHERE sales_invoice_id=?', [invId])) {
      lineStmts.push({
        sql: `INSERT INTO sales_invoice_lines (sales_invoice_id, product_id, description, quantity, unit_price, tax_rate, subtotal, total, created_at)
              VALUES (?, ?, ?, ?, ?, 5, ?, ?, datetime('now'))`,
        args: [invId, inv.pid, CATALOG[inv.pid].title, inv.qty, inv.unit, inv.subtotal, inv.subtotal + inv.tax],
      });
    }
    if (inv.paid > 0) {
      const payNum = `PR-DEMO-${String(inv.idx + 1).padStart(3, '0')}`;
      if (!await exists('SELECT 1 FROM payments WHERE payment_number=?', [payNum])) {
        const r = await query(
          `INSERT INTO payments (payment_number, payment_type, payment_date, partner_id, amount, currency, payment_method_id, bank_account_id, reference, state, user_id, created_at)
           VALUES (?, 'recibido', ?, ?, ?, 'COP', ?, ?, ?, 'confirmado', ?, datetime('now'))`,
          [payNum, daysAgo(inv.idx * 9), inv.customer, inv.paid, pmTrans, bankId, `REF-${payNum}`, admin]);
        const payId = Number(r.lastInsertRowid);
        payStmts.push({
          sql: `INSERT INTO payment_allocations (payment_id, invoice_id, invoice_type, amount_allocated, allocation_date, created_at)
                VALUES (?, ?, 'venta', ?, ?, datetime('now'))`,
          args: [payId, invId, inv.paid, daysAgo(inv.idx * 9)],
        });
      }
    }
  }
  await batch(lineStmts);
  await batch(payStmts);

  // Facturas de compra (a caficultores / proveedores)
  const pInvStmts = [];
  for (let i = 0; i < 4; i++) {
    const num = `FC-DEMO-${String(i + 1).padStart(3, '0')}`;
    const isCaf = i % 2 === 0;
    const subtotal = 800000 + i * 250000;
    const tax = isCaf ? 0 : Math.round(subtotal * 0.19);
    const total = subtotal + tax;
    const state = i % 2 === 0 ? 'pagada' : 'confirmada';
    pInvStmts.push({
      sql: `INSERT OR IGNORE INTO purchase_invoices (invoice_number, supplier_invoice_number, supplier_id, caficultor_id, invoice_date, due_date, state, subtotal, tax_amount, total_amount, amount_paid, amount_due, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [num, `PROV-${1000 + i}`, isCaf ? null : supplierId, isCaf ? caficultorId : null,
        daysAgo(i * 12 + 10), daysAgo(i * 12 - 20), state, subtotal, tax, total,
        state === 'pagada' ? total : 0, state === 'pagada' ? 0 : total, admin],
    });
  }
  await batch(pInvStmts);

  // Gastos
  const expStmts = [];
  const expCats = [
    ['operativo', 'Mantenimiento tostadora', 450000, 'CC-001'],
    ['administrativo', 'Arriendo planta mensual', 3500000, 'CC-004'],
    ['venta', 'Campaña Instagram Ads', 800000, 'CC-005'],
    ['operativo', 'Energía y gas planta', 1200000, 'CC-001'],
    ['administrativo', 'Nómina operarios', 6500000, 'CC-004'],
    ['venta', 'Material POP feria de café', 600000, 'CC-005'],
    ['operativo', 'Compra empaques', 950000, 'CC-002'],
    ['financiero', 'Comisiones pasarela de pago', 320000, 'CC-005'],
  ];
  for (let i = 0; i < expCats.length; i++) {
    const [cat, desc, amount, ccCode] = expCats[i];
    const num = `EXP-DEMO-${String(i + 1).padStart(3, '0')}`;
    const ccId = await scalarId(`SELECT id FROM cost_centers WHERE code=?`, [ccCode]);
    const state = i % 4 === 0 ? 'pagado' : (i % 4 === 1 ? 'aprobado' : 'borrador');
    expStmts.push({
      sql: `INSERT OR IGNORE INTO expenses (expense_number, expense_date, category, description, amount, currency, cost_center_id, payment_method_id, state, approved_by, approved_at, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [num, daysAgo(i * 7 + 3), cat, desc, amount, ccId, pmTrans, state,
        state !== 'borrador' ? admin : null, state !== 'borrador' ? tsDaysAgo(i * 7) : null, admin],
    });
  }
  await batch(expStmts);

  log('Plan de cuentas, maestros, 8 facturas venta, 4 facturas compra, pagos y 8 gastos asegurados');
}

export async function seedDemo() {
  console.log('🌱 Sembrando datos de DEMO para DobleYo Café...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const U = await seedUsers(passwordHash);
  await seedCaficultores(U);
  await seedTraceabilityChain();
  await seedLots();
  await seedProductCopy();
  await seedProductExtras(U);
  await seedSalesTracking();
  await seedCustomerOrders(U);
  await seedExternalSales(U);
  await seedDemandRecords();
  await seedCRM(U);
  await seedProduction(U);
  await seedInventoryMovements(U);
  await seedFinance(U);

  return { users: U };
}

// Ejecutado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  // `node seed_demo.js --trace` siembra solo la cadena de trazabilidad.
  const onlyTrace = process.argv.includes('--trace');
  const run = onlyTrace ? seedTraceabilityChain : seedDemo;
  run()
    .then(() => { console.log('\n✅ Seed completado.' + (onlyTrace ? '' : ' Login demo: cualquier usuario @demo.dobleyo.cafe / Demo1234*')); process.exit(0); })
    .catch((err) => { console.error('\n❌ Error en seed:', err); process.exit(1); });
}

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
import { query } from '../db.js';

const DEMO_PASSWORD = 'Demo1234*';

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

export async function seedDemo() {
  console.log('🌱 Sembrando datos de DEMO para DobleYo Café...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const U = await seedUsers(passwordHash);
  await seedCaficultores(U);
  await seedLots();
  await seedProductExtras(U);

  return { users: U };
}

// Ejecutado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => { console.log('\n✅ Parte 1 del seed de demo completada.'); process.exit(0); })
    .catch((err) => { console.error('\n❌ Error en seed de demo:', err); process.exit(1); });
}

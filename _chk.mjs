const { query } = await import('./server/db.js');
const info = await query("PRAGMA table_info(coffee_harvests)");
console.log('columnas coffee_harvests:', info.rows.map(r=>`${r.name}:${r.type}`).join(', '));
const yf = await query("SELECT COUNT(*) n, COUNT(yield_factor) con_valor, MIN(yield_factor) mn, MAX(yield_factor) mx FROM coffee_harvests");
console.log('yield_factor →', yf.rows[0]);
const lc = await query("SELECT COUNT(*) n, SUM(amount_cop) total FROM lot_costs WHERE cost_type='farmer_payment'");
console.log('farmer_payment →', lc.rows[0]);
const g = await query("SELECT COUNT(*) n, SUM(weight_kg) kg FROM green_coffee_inventory");
console.log('green_coffee_inventory →', g.rows[0]);

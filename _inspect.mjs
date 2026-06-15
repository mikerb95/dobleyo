import { query } from './server/db.js';
const t = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
const tables = t.rows.map(r => r.name);
const counts = {};
for (const name of tables) {
  try { const c = await query(`SELECT COUNT(*) AS n FROM "${name}"`); counts[name] = Number(c.rows[0].n); }
  catch(e){ counts[name] = 'ERR'; }
}
for (const [k,v] of Object.entries(counts)) console.log(`${String(v).padStart(6)}  ${k}`);
process.exit(0);

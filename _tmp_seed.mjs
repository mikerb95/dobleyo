
import { query } from '/home/mike/dev/work/github.com/dobleyo/server/db.js';

// users table is referenced by joins in storageService
await query(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT)`);
await query(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, entity_type TEXT, entity_id TEXT, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
await query(`INSERT OR IGNORE INTO users (id, email) VALUES (1, 'admin@dobleyo.cafe')`);

await query(`INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, region, altitude)
  VALUES ('COL-HUI-1800-CAT-LAV-AB12','finca-la-sierra','CAT','templado','LAV','floral','panela','HUI',1800)`);
await query(`INSERT INTO coffee_harvests (lot_id, farm, variety, climate, process, aroma, taste_notes, region, altitude)
  VALUES ('COL-NAR-1900-BOR-HON-CD34','finca-nariño','BOR','frio','HON','citrico','cacao','NAR',1900)`);

// verde: usa los códigos LEGACY 'A-01' / 'C-01'
await query(`INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
  VALUES (1,'COL-HUI-1800-CAT-LAV-AB12', 500, 'A-01', '2026-01-10')`);
await query(`INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
  VALUES (1,'COL-HUI-1800-CAT-LAV-AB12', 300, 'C-01', '2026-01-12')`);
await query(`INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
  VALUES (2,'COL-NAR-1900-BOR-HON-CD34', 200, 'B-02', '2026-01-15')`);
// una ubicación huérfana que no existe en el maestro
await query(`INSERT INTO green_coffee_inventory (harvest_id, lot_id, weight_kg, location, storage_date)
  VALUES (2,'COL-NAR-1900-BOR-HON-CD34', 50, 'PATIO VIEJO', '2026-01-16')`);

// enviar 600 kg a tostión del lote 1 → consume A-01 (500) + C-01 (100)
await query(`INSERT INTO roasting_batches (lot_id, quantity_sent_kg, status) VALUES ('COL-HUI-1800-CAT-LAV-AB12', 600, 'completed')`);
await query(`INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, status)
  VALUES (1,'MEDIUM', 510, 15.0, 'stored')`);
await query(`INSERT INTO roasted_coffee_inventory (roasted_id, location, container_type, container_count, status)
  VALUES (1,'ROASTED-A-01','BAG-5KG', 102, 'ready_for_packaging')`);

// un tostado ya empacado → debe netear a 0
await query(`INSERT INTO roasting_batches (lot_id, quantity_sent_kg, status) VALUES ('COL-NAR-1900-BOR-HON-CD34', 150, 'completed')`);
await query(`INSERT INTO roasted_coffee (roasting_id, roast_level, weight_kg, weight_loss_percent, status)
  VALUES (2,'DARK', 128, 14.7, 'stored')`);
await query(`INSERT INTO roasted_coffee_inventory (roasted_id, location, container_type, container_count, status)
  VALUES (2,'CLIMATE-01','BUCKET-25', 5, 'packaged')`);

console.log('seed listo');
process.exit(0);

// Migración: Tabla de fincas (farms) — Fase 7
// Landing pages de fincas y caficultores.
// Turso/libSQL (SQLite): sin TEXT[]/JSONB/TIMESTAMPTZ. Las listas (varieties,
// certifications, processes, gallery_urls) se almacenan como JSON en columnas TEXT.
import { query } from '../db.js';

export async function createFarmsTable() {
    await query(`
    CREATE TABLE IF NOT EXISTS farms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caficultor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      slug VARCHAR(160) NOT NULL UNIQUE,
      region VARCHAR(80) NOT NULL,
      municipality VARCHAR(120),
      altitude_min INTEGER,
      altitude_max INTEGER,
      hectares REAL,
      varieties TEXT,         -- JSON array
      certifications TEXT,    -- JSON array
      soil_type VARCHAR(100),
      processes TEXT,         -- JSON array
      story TEXT,
      short_description VARCHAR(300),
      cover_image_url TEXT,
      gallery_urls TEXT DEFAULT '[]',  -- JSON array
      latitude REAL,
      longitude REAL,
      is_published INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `, []);

    await query(`CREATE INDEX IF NOT EXISTS idx_farms_caficultor ON farms(caficultor_id)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_farms_region ON farms(region)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_farms_slug ON farms(slug)`, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_farms_published ON farms(is_published)`, []);

    console.log('[Farms Migration] Tabla farms creada correctamente.');
}

// Ejecutar directamente como script
if (process.argv[1] === new URL(import.meta.url).pathname) {
    createFarmsTable()
        .then(() => { console.log('Migración de fincas completada.'); process.exit(0); })
        .catch(err => { console.error('Error en migración:', err); process.exit(1); });
}

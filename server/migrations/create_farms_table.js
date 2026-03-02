// Migración: Tabla de fincas (farms) — Fase 7
// Landing pages de fincas y caficultores
import { query } from '../db.js';

export async function createFarmsTable() {
  // Tabla principal de fincas
  await query(`
    CREATE TABLE IF NOT EXISTS farms (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      caficultor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      slug VARCHAR(160) NOT NULL UNIQUE,
      region VARCHAR(80) NOT NULL,
      municipality VARCHAR(120),
      altitude_min INT,
      altitude_max INT,
      hectares DECIMAL(10,2),
      varieties TEXT[],
      certifications TEXT[],
      soil_type VARCHAR(100),
      processes TEXT[],
      story TEXT,
      short_description VARCHAR(300),
      cover_image_url TEXT,
      gallery_urls JSONB DEFAULT '[]',
      latitude DECIMAL(10,7),
      longitude DECIMAL(10,7),
      is_published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
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

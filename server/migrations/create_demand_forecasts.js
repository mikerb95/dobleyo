import { query } from '../db.js';

/**
 * Tabla demand_forecasts — pronóstico de demanda (Fase analítica con Python).
 *
 * La función Python `api/ml/recompute.py` lee `sales_tracking`, agrega la
 * demanda semanal por SKU (y los ingresos totales) y escribe aquí una "corrida"
 * completa identificada por `generated_at`. El backend Node solo LEE esta tabla.
 *
 *   metric        'units'   → demanda en unidades por producto
 *                 'revenue' → proyección de ingresos (total_amount agregado)
 *   product_key   título normalizado del producto ML, o 'TOTAL' para ingresos
 *   period_start  lunes (ISO) de la semana pronosticada
 *   horizon_index 1..H (semanas hacia adelante)
 *   *_bound       banda de confianza (~95%); puede ser NULL si no hay historia
 *   model_used    holt | ses | moving_avg | seasonal_naive
 */
export async function createDemandForecasts() {
  await query(`
    CREATE TABLE IF NOT EXISTS demand_forecasts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key    TEXT    NOT NULL,
      product_ml_id  TEXT,
      metric         TEXT    NOT NULL DEFAULT 'units',
      period_start   TEXT    NOT NULL,
      horizon_index  INTEGER NOT NULL,
      forecast_value REAL    NOT NULL,
      lower_bound    REAL,
      upper_bound    REAL,
      model_used     TEXT    NOT NULL DEFAULT 'moving_avg',
      history_weeks  INTEGER,
      generated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_demand_forecasts_key       ON demand_forecasts(product_key)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_forecasts_metric    ON demand_forecasts(metric)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_forecasts_generated ON demand_forecasts(generated_at)`);

  console.log('[Migration] demand_forecasts creada.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await createDemandForecasts();
  console.log('OK');
  process.exit(0);
}

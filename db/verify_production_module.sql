-- ==============================================
-- 📊 SCRIPT DE VERIFICACIÓN: Módulo Producción
-- ==============================================
-- Este script verifica que todas las tablas necesarias
-- existan y contengan datos válidos para el módulo de producción

USE dobleyo;

-- ==============================================
-- 1. VERIFICAR TABLAS DE PRODUCCIÓN
-- ==============================================
SELECT 'TABLE VERIFICATION' as 'Task';
SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES 
   WHERE TABLE_SCHEMA='dobleyo' AND TABLE_NAME IN (
     'production_orders',
     'roast_batches',
     'production_quality_checks',
     'equipment_maintenance',
     'roasting_equipment',
     'roast_profiles',
     'bill_of_materials',
     'work_centers',
     'production_order_components',
     'roast_batch_waste'
   )) = 10,
  'OK: All production tables exist',
  'ERROR: Missing some production tables'
) as result;

-- ==============================================
-- 2. CONTAR REGISTROS EN TABLAS PRINCIPALES
-- ==============================================
SELECT '=== PRODUCTION RECORDS ===' as '';

SELECT 
  'production_orders' as table_name,
  COUNT(*) as record_count
FROM production_orders
UNION ALL SELECT 'roast_batches', COUNT(*) FROM roast_batches
UNION ALL SELECT 'production_quality_checks', COUNT(*) FROM production_quality_checks
UNION ALL SELECT 'roasting_equipment', COUNT(*) FROM roasting_equipment
UNION ALL SELECT 'roast_profiles', COUNT(*) FROM roast_profiles
UNION ALL SELECT 'bill_of_materials', COUNT(*) FROM bill_of_materials
UNION ALL SELECT 'work_centers', COUNT(*) FROM work_centers;

-- ==============================================
-- 3. VERIFICAR ESTADOS DE ÓRDENES
-- ==============================================
SELECT '=== ORDER STATES ===' as '';

SELECT 
  state,
  COUNT(*) as count
FROM production_orders
GROUP BY state
ORDER BY state;

-- ==============================================
-- 4. VERIFICAR EQUIPOS DISPONIBLES
-- ==============================================
SELECT '=== ROASTING EQUIPMENT ===' as '';

SELECT 
  id,
  name,
  equipment_type,
  capacity_kg,
  is_active,
  CASE WHEN is_active = 1 THEN 'Operativo' ELSE 'Mantenimiento' END as status
FROM roasting_equipment
ORDER BY id;

-- ==============================================
-- 5. VERIFICAR PERFILES DE TOSTADO
-- ==============================================
SELECT '=== ROAST PROFILES ===' as '';

SELECT 
  id,
  roast_name,
  target_roast_level,
  target_first_crack_minutes,
  target_development_time_minutes,
  target_drop_temperature_celsius,
  expected_color_agtron
FROM roast_profiles
ORDER BY id;

-- ==============================================
-- 6. VERIFICAR BOMs (RECETAS)
-- ==============================================
SELECT '=== BILL OF MATERIALS ===' as '';

SELECT 
  b.id,
  b.bom_name,
  p.product_name,
  b.expected_loss_percentage,
  COUNT(bc.id) as component_count
FROM bill_of_materials b
LEFT JOIN products p ON b.product_id = p.id
LEFT JOIN bom_components bc ON b.id = bc.bom_id
GROUP BY b.id
ORDER BY b.id;

-- ==============================================
-- 7. VERIFICAR CALIDAD (CATACIONES)
-- ==============================================
SELECT '=== QUALITY CHECKS ===' as '';

SELECT 
  check_type,
  COUNT(*) as total_checks,
  SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed,
  ROUND(100 * SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as pass_rate_percentage
FROM production_quality_checks
GROUP BY check_type
ORDER BY check_type;

-- ==============================================
-- 8. VERIFICAR OPERARIOS DISPONIBLES
-- ==============================================
SELECT '=== OPERATORS ===' as '';

SELECT 
  id,
  name,
  email,
  role,
  CASE WHEN is_active = 1 THEN 'Activo' ELSE 'Inactivo' END as status,
  created_at
FROM users
WHERE role IN ('operario', 'admin')
ORDER BY role, name;

-- ==============================================
-- 9. VERIFICAR PRODUCTOS
-- ==============================================
SELECT '=== PRODUCTS ===' as '';

SELECT 
  product_type,
  COUNT(*) as count
FROM products
GROUP BY product_type
ORDER BY product_type;

-- ==============================================
-- 10. VERIFICAR LOTES DE CAFÉ VERDE
-- ==============================================
SELECT '=== GREEN COFFEE LOTS ===' as '';

SELECT 
  id,
  lot_number,
  coffee_origin,
  harvest_month,
  total_weight_kg,
  ROUND(total_weight_kg - COALESCE(stock_consumed_kg, 0), 2) as remaining_kg,
  altitude_masl,
  harvest_method
FROM coffee_harvests
ORDER BY id;

-- ==============================================
-- 11. VERIFICAR CENTROS DE TRABAJO
-- ==============================================
SELECT '=== WORK CENTERS ===' as '';

SELECT 
  id,
  name,
  center_type,
  capacity_daily_kg,
  responsible_user_id,
  (SELECT name FROM users WHERE id = work_centers.responsible_user_id) as responsible_name
FROM work_centers
ORDER BY id;

-- ==============================================
-- 12. CÁLCULOS DE PÉRDIDA EN BATCHES
-- ==============================================
SELECT '=== BATCH WEIGHT LOSS ANALYSIS ===' as '';

SELECT 
  COUNT(*) as total_batches_completed,
  ROUND(AVG(weight_loss_percentage), 2) as avg_loss_percentage,
  ROUND(MIN(weight_loss_percentage), 2) as min_loss_percentage,
  ROUND(MAX(weight_loss_percentage), 2) as max_loss_percentage,
  ROUND(STDDEV(weight_loss_percentage), 2) as stddev_loss_percentage,
  ROUND(SUM(roasted_coffee_weight_kg), 2) as total_roasted_kg
FROM roast_batches
WHERE completed_at IS NOT NULL
  AND weight_loss_percentage IS NOT NULL;

-- ==============================================
-- 13. PERFORMANCE DE OPERADORES
-- ==============================================
SELECT '=== OPERATOR PERFORMANCE ===' as '';

SELECT 
  u.name as operator_name,
  COUNT(rb.id) as batches_roasted,
  ROUND(SUM(rb.green_coffee_weight_kg), 2) as total_green_kg,
  ROUND(SUM(rb.roasted_coffee_weight_kg), 2) as total_roasted_kg,
  ROUND(AVG(rb.weight_loss_percentage), 2) as avg_loss_percentage
FROM roast_batches rb
JOIN users u ON rb.operator_id = u.id
WHERE rb.completed_at IS NOT NULL
GROUP BY u.id
ORDER BY total_roasted_kg DESC;

-- ==============================================
-- 14. ALERTAS SISTEMA
-- ==============================================
SELECT '=== SYSTEM ALERTS ===' as '';

-- Equipo en mantenimiento
SELECT 
  'Equipment Maintenance' as alert_type,
  COUNT(*) as count,
  'WARNING' as severity
FROM roasting_equipment
WHERE is_active = 0

UNION ALL

-- Órdenes sin completar
SELECT 
  'Incomplete Orders',
  COUNT(*),
  'WARNING'
FROM production_orders
WHERE state IN ('borrador', 'confirmada', 'en_progreso', 'pausada')
  AND DATE(scheduled_date) < DATE(NOW())

UNION ALL

-- Inspecciones fallidas
SELECT 
  'Failed Quality Checks',
  COUNT(*),
  'ERROR'
FROM production_quality_checks
WHERE passed = 0
  AND DATE(check_date) >= DATE_SUB(DATE(NOW()), INTERVAL 7 DAY)

UNION ALL

-- Pérdida anómala (> 16%)
SELECT 
  'High Weight Loss',
  COUNT(*),
  'WARNING'
FROM roast_batches
WHERE weight_loss_percentage > 16
  AND completed_at IS NOT NULL
  AND DATE(roast_date) >= DATE_SUB(DATE(NOW()), INTERVAL 7 DAY);

-- ==============================================
-- 15. ESTADÍSTICAS GENERALES
-- ==============================================
SELECT '=== GENERAL STATISTICS ===' as '';

SELECT 
  (SELECT COUNT(*) FROM production_orders) as total_orders,
  (SELECT COUNT(*) FROM production_orders WHERE state = 'completada') as completed_orders,
  (SELECT COUNT(*) FROM roast_batches WHERE completed_at IS NOT NULL) as completed_batches,
  (SELECT ROUND(AVG(weight_loss_percentage), 2) FROM roast_batches WHERE completed_at IS NOT NULL) as avg_loss_percentage,
  (SELECT COUNT(*) FROM production_quality_checks WHERE passed = 1) as quality_passed,
  (SELECT COUNT(*) FROM production_quality_checks WHERE passed = 0) as quality_failed,
  (SELECT ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM production_quality_checks) WHERE passed = 1, 2) FROM production_quality_checks) as pass_rate_percentage;

-- ==============================================
-- 16. ÍNDICES - VERIFICAR PERFORMANCE
-- ==============================================
SELECT '=== INDEXES ===' as '';

SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX as column_position
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'dobleyo'
  AND TABLE_NAME IN (
    'production_orders',
    'roast_batches',
    'production_quality_checks',
    'users',
    'products'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ==============================================
-- 17. INTEGRIDAD REFERENCIAL
-- ==============================================
SELECT '=== REFERENTIAL INTEGRITY CHECK ===' as '';

-- Órdenes con BOMs inválidos
SELECT 
  'Invalid BOM in Orders',
  COUNT(*) as count
FROM production_orders po
WHERE po.bom_id IS NOT NULL
  AND po.bom_id NOT IN (SELECT id FROM bill_of_materials)

UNION ALL

-- Batches con equipos inválidos
SELECT 
  'Invalid Equipment in Batches',
  COUNT(*)
FROM roast_batches rb
WHERE rb.roasting_equipment_id IS NOT NULL
  AND rb.roasting_equipment_id NOT IN (SELECT id FROM roasting_equipment)

UNION ALL

-- Inspecciones con usuarios inválidos
SELECT 
  'Invalid Inspector in QC',
  COUNT(*)
FROM production_quality_checks pqc
WHERE pqc.inspector_id IS NOT NULL
  AND pqc.inspector_id NOT IN (SELECT id FROM users);

-- ==============================================
-- 18. RESUMEN FINAL
-- ==============================================
SELECT '
╔═══════════════════════════════════════════════╗
║  ✅ VERIFICACIÓN COMPLETADA                   ║
║  Módulo de Producción - Status Report         ║
╚═══════════════════════════════════════════════╝
' as VERIFICATION_SUMMARY;

-- ==============================================
-- 19. SAMPLE QUERIES PARA DEVELOPMENT
-- ==============================================

-- Obtener órdenes activas con progress
SELECT 
  po.id,
  po.order_number,
  po.state,
  p.product_name,
  po.planned_quantity,
  COUNT(rb.id) as batches_created,
  ROUND(SUM(rb.roasted_coffee_weight_kg), 2) as production_so_far,
  po.scheduled_date,
  u.name as responsible_person
FROM production_orders po
LEFT JOIN products p ON po.product_id = p.id
LEFT JOIN roast_batches rb ON po.id = rb.production_order_id
LEFT JOIN users u ON po.responsible_user_id = u.id
WHERE po.state IN ('confirmada', 'en_progreso')
GROUP BY po.id
ORDER BY po.scheduled_date, po.priority DESC;

-- Última catación de cada batch
SELECT 
  rb.batch_number,
  rb.roast_date,
  MAX(pqc.overall_score) as latest_quality_score,
  MAX(pqc.check_date) as quality_check_date,
  u.name as inspector_name
FROM roast_batches rb
LEFT JOIN production_quality_checks pqc ON rb.id = pqc.roast_batch_id
LEFT JOIN users u ON pqc.inspector_id = u.id
WHERE rb.completed_at IS NOT NULL
GROUP BY rb.id
ORDER BY rb.roast_date DESC
LIMIT 10;

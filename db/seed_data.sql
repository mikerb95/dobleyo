-- ==========================================
-- SEED DATA - DobleYo Database
-- Datos iniciales para desarrollo y pruebas
-- ==========================================

-- ==========================================
-- 1. USUARIOS
-- ==========================================

-- Admin principal
INSERT INTO users (email, password_hash, first_name, last_name, name, mobile_phone, tax_id, city, state_province, role, is_verified, created_at) 
VALUES ('admin@dobleyo.cafe', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Mike', 'Admin', 'Mike Admin', '3001234567', '1234567890', 'Bogotá', 'Cundinamarca', 'admin', TRUE, NOW());

-- Operarios de producción
INSERT INTO users (email, password_hash, first_name, last_name, name, mobile_phone, tax_id, city, state_province, role, is_verified, created_at) 
VALUES 
('jose@dobleyo.cafe', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'José', 'García', 'José García', '3101234567', '1111111111', 'Bogotá', 'Cundinamarca', 'admin', TRUE, NOW()),
('maria@dobleyo.cafe', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'María', 'López', 'María López', '3102234567', '2222222222', 'Bogotá', 'Cundinamarca', 'admin', TRUE, NOW()),
('carlos@dobleyo.cafe', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Carlos', 'Ruiz', 'Carlos Ruiz', '3103234567', '3333333333', 'Bogotá', 'Cundinamarca', 'admin', TRUE, NOW());

-- Caficultores
INSERT INTO users (email, password_hash, first_name, last_name, name, mobile_phone, tax_id, city, state_province, role, is_verified, caficultor_status, created_at) 
VALUES 
('caficultor1@cafe.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Juan', 'Pérez', 'Juan Pérez', '3104234567', '4444444444', 'Manizales', 'Caldas', 'caficultor', TRUE, 'approved', NOW()),
('caficultor2@cafe.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Rosa', 'Martínez', 'Rosa Martínez', '3105234567', '5555555555', 'Armenia', 'Quindío', 'caficultor', TRUE, 'approved', NOW()),
('caficultor3@cafe.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Luis', 'Sánchez', 'Luis Sánchez', '3106234567', '6666666666', 'Pereira', 'Risaralda', 'caficultor', TRUE, 'approved', NOW());

-- Clientes
INSERT INTO users (email, password_hash, first_name, last_name, name, mobile_phone, city, state_province, role, is_verified, created_at) 
VALUES 
('cliente1@gmail.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Andrea', 'González', 'Andrea González', '3107234567', 'Medellín', 'Antioquia', 'client', TRUE, NOW()),
('cliente2@gmail.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'Fernando', 'Torres', 'Fernando Torres', '3108234567', 'Cali', 'Valle', 'client', TRUE, NOW());

-- ==========================================
-- 2. ESTACIONES DE TRABAJO Y EQUIPOS
-- ==========================================

-- Estaciones
INSERT INTO work_centers (code, name, work_center_type, capacity_per_hour, capacity_unit, cost_per_hour, is_active, location, created_at) 
VALUES 
('WC-001', 'Tostadora Principal', 'tostado', 120, 'kg', 50000, TRUE, 'Planta - Área 1', NOW()),
('WC-002', 'Molino', 'molido', 150, 'kg', 35000, TRUE, 'Planta - Área 2', NOW()),
('WC-003', 'Empaque', 'empaque', 300, 'unidades', 30000, TRUE, 'Planta - Área 3', NOW()),
('WC-004', 'Control Calidad', 'control_calidad', 50, 'kg', 40000, TRUE, 'Planta - Área 4', NOW()),
('WC-005', 'Almacén', 'almacen', 1000, 'kg', 25000, TRUE, 'Almacén', NOW());

-- Equipos de tostado
INSERT INTO roasting_equipment (work_center_id, equipment_code, equipment_name, brand, model, batch_capacity_kg, min_batch_kg, max_batch_kg, fuel_type, roast_time_minutes, cooling_time_minutes, last_maintenance_date, next_maintenance_date, is_operational, created_at) 
VALUES 
(1, 'EQUIPO-001', 'Tostadora Giratoria 1', 'Probat', 'L12', 50, 20, 50, 'gas', 18, 10, '2026-01-10', '2026-02-10', TRUE, NOW()),
(1, 'EQUIPO-002', 'Tostadora Giratoria 2', 'Loring', 'Smart Roaster', 60, 25, 60, 'gas', 20, 12, '2026-01-15', '2026-02-15', TRUE, NOW()),
(1, 'EQUIPO-003', 'Tostadora Pequeña', 'Gene Café', 'CB-1', 20, 5, 20, 'electrico', 15, 8, '2026-01-12', '2026-02-12', TRUE, NOW());

-- ==========================================
-- 3. PRODUCTOS
-- ==========================================

-- Café Verde (materia prima)
INSERT INTO products (id, sku, name, description, category, origin, process, price, cost, is_active, stock_quantity, weight, weight_unit, created_at) 
VALUES 
('CAFE-VERDE-001', 'SKU-CV-001', 'Café Verde Colombiano Huila', 'Café verde sin tostar - Huila', 'cafe', 'Huila', 'lavado', 0, 8000, TRUE, 500, 70, 'kg', NOW()),
('CAFE-VERDE-002', 'SKU-CV-002', 'Café Verde Etíope Yirgacheffe', 'Café verde sin tostar - Etiopía', 'cafe', 'Etiopía', 'natural', 0, 9000, TRUE, 300, 70, 'kg', NOW()),
('CAFE-VERDE-003', 'SKU-CV-003', 'Café Verde Brasileño', 'Café verde sin tostar - Brasil', 'cafe', 'Brasil', 'lavado', 0, 7500, TRUE, 400, 70, 'kg', NOW());

-- Café Tostado (producto final)
INSERT INTO products (id, sku, name, description, category, origin, roast, price, cost, rating, is_active, stock_quantity, weight, weight_unit, created_at) 
VALUES 
('CAFE-TOSTADO-001', 'SKU-CT-001', 'Colombiano Huila 500g - Medio', 'Café tostado molido - 500g', 'cafe', 'Huila', 'medio', 35000, 10000, 4.8, TRUE, 150, 500, 'g', NOW()),
('CAFE-TOSTADO-002', 'SKU-CT-002', 'Etíope Yirgacheffe 250g - Ligero', 'Café tostado en grano - 250g', 'cafe', 'Etiopía', 'ligero', 28000, 9000, 4.9, TRUE, 200, 250, 'g', NOW()),
('CAFE-TOSTADO-003', 'SKU-CT-003', 'Brasileño 500g - Oscuro', 'Café tostado molido - 500g', 'cafe', 'Brasil', 'oscuro', 32000, 9500, 4.7, TRUE, 120, 500, 'g', NOW()),
('CAFE-TOSTADO-004', 'SKU-CT-004', 'Blend Casa 500g', 'Mezcla especial DobleYo - 500g', 'cafe', 'Varios', 'medio', 40000, 11000, 4.9, TRUE, 180, 500, 'g', NOW());

-- Empaques
INSERT INTO products (id, sku, name, description, category, subcategory, price, cost, is_active, stock_quantity, weight, weight_unit, created_at) 
VALUES 
('EMPAQUE-001', 'SKU-EMP-001', 'Bolsa kraft 500g con zip', 'Bolsa kraft con cierre zip - 500g', 'merchandising', 'empaque', 1200, 300, TRUE, 1000, 5, 'g', NOW()),
('EMPAQUE-002', 'SKU-EMP-002', 'Bolsa kraft 250g con zip', 'Bolsa kraft con cierre zip - 250g', 'merchandising', 'empaque', 900, 200, TRUE, 1500, 3, 'g', NOW()),
('EMPAQUE-003', 'SKU-EMP-003', 'Etiqueta premium', 'Etiqueta impresa full color', 'merchandising', 'empaque', 150, 40, TRUE, 5000, 2, 'g', NOW());

-- Accesorios
INSERT INTO products (id, sku, name, description, category, subcategory, price, cost, is_active, stock_quantity, weight, weight_unit, created_at) 
VALUES 
('ACCESORIO-001', 'SKU-ACC-001', 'Prensa Francesa 350ml', 'Cafetera prensa francesa', 'accesorio', 'prensa', 85000, 35000, TRUE, 45, 600, 'g', NOW()),
('ACCESORIO-002', 'SKU-ACC-002', 'Chemex 6 tazas', 'Cafetera de vidrio tipo Chemex', 'accesorio', 'chemex', 120000, 45000, TRUE, 30, 800, 'g', NOW()),
('ACCESORIO-003', 'SKU-ACC-003', 'Molinillo Manual', 'Molinillo de café manual', 'accesorio', 'molinillo', 45000, 18000, TRUE, 60, 400, 'g', NOW());

-- ==========================================
-- 4. PERFILES DE TOSTADO
-- ==========================================

INSERT INTO roast_profiles (profile_code, profile_name, roast_level, target_temperature_celsius, roast_duration_minutes, first_crack_time_minutes, second_crack_time_minutes, development_time_ratio, color_agtron, suitable_for_varieties, flavor_profile, is_active, created_by, created_at) 
VALUES 
('PROFILE-001', 'Ligero - Especialidad', 'ligero', 195, 12, 8, NULL, 20, 85, 'Etiopía, Kenya, Colombia High Altitude', 'Ácido brillante, floral, frutal', TRUE, 1, NOW()),
('PROFILE-002', 'Medio - Balanceado', 'medio', 200, 14, 9, 11, 28, 65, 'Colombia, Honduras, Costa Rica', 'Cuerpo medio, sabor balanceado, chocolate', TRUE, 1, NOW()),
('PROFILE-003', 'Oscuro - Bold', 'oscuro', 205, 16, 10, 13, 38, 45, 'Brasil, Sumatra, Mezclas', 'Cuerpo completo, caramelo, ahumado', TRUE, 1, NOW()),
('PROFILE-004', 'Medio-Oscuro - Casa', 'medio_oscuro', 202, 15, 9, 12, 32, 55, 'Varios - Blend', 'Cuerpo completo, chocolate oscuro, dulce', TRUE, 1, NOW());

-- ==========================================
-- 5. LISTAS DE MATERIALES (BOMs)
-- ==========================================

-- BOM: Colombiano Huila 500g
INSERT INTO bill_of_materials (bom_code, product_id, product_qty, product_unit, bom_type, work_center_id, estimated_time_minutes, loss_percentage, is_active, created_at) 
VALUES ('BOM-001', 'CAFE-TOSTADO-001', 1, 'kg', 'tostado', 1, 20, 14.5, TRUE, NOW());

INSERT INTO bom_components (bom_id, component_product_id, quantity, quantity_unit, component_type, scrap_percentage, created_at) 
VALUES 
(1, 'CAFE-VERDE-001', 1.2, 'kg', 'materia_prima', 14.5, NOW()),
(1, 'EMPAQUE-001', 2, 'unidad', 'empaque', 0, NOW()),
(1, 'EMPAQUE-003', 2, 'unidad', 'empaque', 0, NOW());

-- BOM: Etíope Yirgacheffe 250g
INSERT INTO bill_of_materials (bom_code, product_id, product_qty, product_unit, bom_type, work_center_id, estimated_time_minutes, loss_percentage, is_active, created_at) 
VALUES ('BOM-002', 'CAFE-TOSTADO-002', 1, 'kg', 'tostado', 1, 18, 15.0, TRUE, NOW());

INSERT INTO bom_components (bom_id, component_product_id, quantity, quantity_unit, component_type, scrap_percentage, created_at) 
VALUES 
(2, 'CAFE-VERDE-002', 1.25, 'kg', 'materia_prima', 15.0, NOW()),
(2, 'EMPAQUE-002', 4, 'unidad', 'empaque', 0, NOW()),
(2, 'EMPAQUE-003', 4, 'unidad', 'empaque', 0, NOW());

-- BOM: Blend Casa 500g
INSERT INTO bill_of_materials (bom_code, product_id, product_qty, product_unit, bom_type, work_center_id, estimated_time_minutes, loss_percentage, is_active, created_at) 
VALUES ('BOM-003', 'CAFE-TOSTADO-004', 1, 'kg', 'tostado', 1, 22, 15.5, TRUE, NOW());

INSERT INTO bom_components (bom_id, component_product_id, quantity, quantity_unit, component_type, scrap_percentage, created_at) 
VALUES 
(3, 'CAFE-VERDE-001', 0.5, 'kg', 'materia_prima', 14.5, NOW()),
(3, 'CAFE-VERDE-002', 0.4, 'kg', 'materia_prima', 15.0, NOW()),
(3, 'CAFE-VERDE-003', 0.35, 'kg', 'materia_prima', 13.0, NOW()),
(3, 'EMPAQUE-001', 2, 'unidad', 'empaque', 0, NOW()),
(3, 'EMPAQUE-003', 2, 'unidad', 'empaque', 0, NOW());

-- ==========================================
-- 6. LOTES DE CAFÉ VERDE
-- ==========================================

INSERT INTO lots (code, name, origin, farm, producer, altitude, variety, shade_system, climate, process, harvest_date, weight, weight_unit, estado, created_at) 
VALUES 
('LOTE-CV-001', 'Huila Harvest 2025-11', 'Huila', 'Finca El Paraíso', 'Juan Pérez', '1800m', 'Geisha', 'Sombrío', 'Templado', 'Lavado', '2025-11-15', 500, 'kg', 'verde', NOW()),
('LOTE-CV-002', 'Yirgacheffe Natural 2025-10', 'Etiopía', 'Kochere', 'Cooperative', '2000m', 'Heirloom', 'Natural', 'Tropical', 'Natural', '2025-10-20', 300, 'kg', 'verde', NOW()),
('LOTE-CV-003', 'Brasileño Cerrado 2025-09', 'Brasil', 'Fazenda Montaña', 'Rosa Martínez', '1200m', 'Bourbon', 'A Pleno Sol', 'Tropical', 'Lavado', '2025-09-10', 400, 'kg', 'verde', NOW());

-- ==========================================
-- 7. PLAN DE CUENTAS CONTABLES
-- ==========================================

-- ACTIVOS
INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at) 
VALUES 
('1000', 'ACTIVOS', 'activo', NULL, TRUE, NOW()),
('1100', 'Efectivo y Equivalentes', 'activo', 'efectivo', TRUE, NOW()),
('1110', 'Caja Principal', 'activo', 'efectivo', TRUE, NOW()),
('1200', 'Cuentas Bancarias', 'activo', 'banco', TRUE, NOW()),
('1210', 'Bancolombia CC', 'activo', 'banco', TRUE, NOW()),
('1220', 'BBVA Ahorros', 'activo', 'banco', TRUE, NOW()),
('1300', 'Cuentas por Cobrar', 'activo', 'cuentas_por_cobrar', TRUE, NOW()),
('1400', 'Inventario', 'activo', 'inventario', TRUE, NOW()),
('1410', 'Café Verde', 'activo', 'inventario', TRUE, NOW()),
('1420', 'Café Tostado', 'activo', 'inventario', TRUE, NOW()),
('1430', 'Empaques y Consumibles', 'activo', 'inventario', TRUE, NOW()),
('1500', 'Activos Fijos', 'activo', 'activo_fijo', TRUE, NOW()),
('1510', 'Equipos de Tostado', 'activo', 'activo_fijo', TRUE, NOW()),
('1520', 'Depreciación Acumulada', 'activo', 'activo_fijo', TRUE, NOW());

-- PASIVOS
INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at) 
VALUES 
('2000', 'PASIVOS', 'pasivo', NULL, TRUE, NOW()),
('2100', 'Cuentas por Pagar', 'pasivo', 'cuentas_por_pagar', TRUE, NOW()),
('2110', 'Cuentas por Pagar - Proveedores', 'pasivo', 'cuentas_por_pagar', TRUE, NOW()),
('2120', 'Cuentas por Pagar - Caficultores', 'pasivo', 'cuentas_por_pagar', TRUE, NOW()),
('2200', 'Impuestos por Pagar', 'pasivo', NULL, TRUE, NOW()),
('2210', 'IVA por Pagar', 'pasivo', NULL, TRUE, NOW()),
('2300', 'Préstamos', 'pasivo', 'prestamo', TRUE, NOW());

-- PATRIMONIO
INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at) 
VALUES 
('3000', 'PATRIMONIO', 'patrimonio', NULL, TRUE, NOW()),
('3100', 'Capital', 'patrimonio', 'capital', TRUE, NOW()),
('3200', 'Ganancias/Pérdidas Acumuladas', 'patrimonio', NULL, TRUE, NOW());

-- INGRESOS
INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at) 
VALUES 
('4000', 'INGRESOS', 'ingreso', NULL, TRUE, NOW()),
('4100', 'Ventas de Productos', 'ingreso', 'venta_producto', TRUE, NOW()),
('4110', 'Ventas Café Tostado', 'ingreso', 'venta_producto', TRUE, NOW()),
('4120', 'Ventas Accesorios', 'ingreso', 'venta_producto', TRUE, NOW()),
('4200', 'Otros Ingresos', 'ingreso', 'otro_ingreso', TRUE, NOW());

-- GASTOS
INSERT INTO accounting_accounts (code, name, account_type, account_subtype, is_active, created_at) 
VALUES 
('5000', 'GASTOS OPERATIVOS', 'gasto', 'gasto_operativo', TRUE, NOW()),
('5100', 'Costo de Café Verde Comprado', 'costo', 'costo_venta', TRUE, NOW()),
('5200', 'Servicios Públicos', 'gasto', 'gasto_operativo', TRUE, NOW()),
('5210', 'Electricidad', 'gasto', 'gasto_operativo', TRUE, NOW()),
('5220', 'Gas', 'gasto', 'gasto_operativo', TRUE, NOW()),
('5300', 'Mantenimiento', 'gasto', 'gasto_operativo', TRUE, NOW()),
('6000', 'GASTOS ADMINISTRATIVOS', 'gasto', 'gasto_administrativo', TRUE, NOW()),
('6100', 'Sueldos y Salarios', 'gasto', 'gasto_administrativo', TRUE, NOW()),
('6200', 'Arriendos', 'gasto', 'gasto_administrativo', TRUE, NOW()),
('6300', 'Seguros', 'gasto', 'gasto_administrativo', TRUE, NOW()),
('7000', 'GASTOS DE VENTA', 'gasto', 'gasto_venta', TRUE, NOW()),
('7100', 'Publicidad y Marketing', 'gasto', 'gasto_venta', TRUE, NOW()),
('7200', 'Comisiones', 'gasto', 'gasto_venta', TRUE, NOW());

-- ==========================================
-- 8. DIARIOS CONTABLES
-- ==========================================

INSERT INTO accounting_journals (code, name, journal_type, is_active, created_at) 
VALUES 
('VEN', 'Diario de Ventas', 'venta', TRUE, NOW()),
('COM', 'Diario de Compras', 'compra', TRUE, NOW()),
('BAN', 'Diario de Banco', 'banco', TRUE, NOW()),
('CAJ', 'Diario de Caja', 'caja', TRUE, NOW()),
('GEN', 'Diario General', 'general', TRUE, NOW());

-- ==========================================
-- 9. MÉTODOS DE PAGO
-- ==========================================

INSERT INTO payment_methods (code, name, method_type, is_active, requires_reference, created_at) 
VALUES 
('EFEC', 'Efectivo', 'efectivo', TRUE, FALSE, NOW()),
('TRANS', 'Transferencia Bancaria', 'transferencia', TRUE, TRUE, NOW()),
('CHEK', 'Cheque', 'cheque', TRUE, TRUE, NOW()),
('TDEB', 'Tarjeta Débito', 'tarjeta_debito', TRUE, TRUE, NOW()),
('TCRED', 'Tarjeta Crédito', 'tarjeta_credito', TRUE, TRUE, NOW()),
('PSE', 'PSE', 'pse', TRUE, TRUE, NOW());

-- ==========================================
-- 10. CENTROS DE COSTO
-- ==========================================

INSERT INTO cost_centers (code, name, description, is_active, created_at) 
VALUES 
('CC-001', 'Tostado', 'Centro de costo - Tostado de café', TRUE, NOW()),
('CC-002', 'Molido y Empaque', 'Centro de costo - Molido y empaque', TRUE, NOW()),
('CC-003', 'Control de Calidad', 'Centro de costo - Control de calidad', TRUE, NOW()),
('CC-004', 'Administración', 'Centro de costo - Administración', TRUE, NOW()),
('CC-005', 'Ventas', 'Centro de costo - Ventas y distribución', TRUE, NOW());

-- ==========================================
-- 11. PROVEEDORES
-- ==========================================

INSERT INTO product_suppliers (name, contact_name, email, phone, address, tax_id, payment_terms, is_active, created_at) 
VALUES 
('Empaques Colombia SAS', 'Pedro López', 'ventas@empaquescol.com', '3101234567', 'Cra 15 # 45-30, Bogotá', '9012345678', 'Neto 30', TRUE, NOW()),
('Equipos Industriales SA', 'Marco Pérez', 'soporte@equiposindustrial.com', '3102234567', 'Cra 7 # 120-50, Bogotá', '9012345679', 'Neto 60', TRUE, NOW());

-- ==========================================
-- 12. CUENTAS BANCARIAS
-- ==========================================

INSERT INTO bank_accounts (bank_name, account_number, account_type, currency, current_balance, is_active, created_at) 
VALUES 
('Bancolombia', '05234567890', 'corriente', 'COP', 5000000, TRUE, NOW()),
('BBVA', '00987654321', 'ahorros', 'COP', 2500000, TRUE, NOW());

-- ==========================================
-- 13. DATOS ADICIONALES DE USUARIOS (Aplicaciones caficultores)
-- ==========================================

INSERT INTO caficultor_applications (user_id, farm_name, region, altitude, hectares, varieties_cultivated, certifications, status, reviewed_by, reviewed_at, created_at) 
VALUES 
(4, 'Finca El Paraíso', 'Huila', 1800, 25.5, 'Geisha, Bourbon', 'FLO, Orgánico', 'approved', 1, NOW(), NOW()),
(5, 'Cooperative Yirgacheffe', 'Etiopía', 2000, 150, 'Heirloom', 'Fair Trade', 'approved', 1, NOW(), NOW()),
(6, 'Fazenda Montaña', 'Brasil', 1200, 500, 'Bourbon, Typica', 'Convencional', 'approved', 1, NOW(), NOW());

-- ==========================================
-- VALIDACIÓN - Mostrar datos insertados
-- ==========================================

-- Usuarios creados
SELECT 'USUARIOS' as 'Tipo', COUNT(*) as 'Total' FROM users
UNION ALL
-- Equipos
SELECT 'EQUIPOS TOSTADO', COUNT(*) FROM roasting_equipment
UNION ALL
-- Productos
SELECT 'PRODUCTOS', COUNT(*) FROM products
UNION ALL
-- BOMs
SELECT 'LISTAS DE MATERIALES', COUNT(*) FROM bill_of_materials
UNION ALL
-- Lotes
SELECT 'LOTES', COUNT(*) FROM lots
UNION ALL
-- Cuentas contables
SELECT 'CUENTAS CONTABLES', COUNT(*) FROM accounting_accounts
UNION ALL
-- Métodos de pago
SELECT 'METODOS DE PAGO', COUNT(*) FROM payment_methods
UNION ALL
-- Centros de costo
SELECT 'CENTROS DE COSTO', COUNT(*) FROM cost_centers;

-- Información de acceso
SELECT '=== CREDENCIALES DE PRUEBA ===' as '';
SELECT 'Admin' as 'Rol', 'admin@dobleyo.cafe' as 'Email', 'contraseña: prueba' as 'Nota'
UNION ALL
SELECT 'Operario 1', 'jose@dobleyo.cafe', 'Tostado'
UNION ALL
SELECT 'Operario 2', 'maria@dobleyo.cafe', 'Control Calidad'
UNION ALL
SELECT 'Operario 3', 'carlos@dobleyo.cafe', 'Empaque'
UNION ALL
SELECT 'Caficultor 1', 'caficultor1@cafe.com', 'Huila'
UNION ALL
SELECT 'Caficultor 2', 'caficultor2@cafe.com', 'Etiopía'
UNION ALL
SELECT 'Caficultor 3', 'caficultor3@cafe.com', 'Brasil';

-- Inventario actual
SELECT '=== INVENTARIO ACTUAL ===' as '';
SELECT name, stock_quantity, weight, weight_unit FROM products WHERE stock_quantity > 0 ORDER BY stock_quantity DESC;

-- Equipos disponibles
SELECT '=== EQUIPOS DE TOSTADO ===' as '';
SELECT equipment_name, batch_capacity_kg, is_operational, fuel_type FROM roasting_equipment ORDER BY equipment_code;

-- BOMs configurados
SELECT '=== RECETAS (BOMs) ===' as '';
SELECT bom_code, b.product_id, p.name, b.product_qty FROM bill_of_materials b 
JOIN products p ON b.product_id = p.id 
ORDER BY bom_code;

import { query } from './db.js';

/**
 * Seed de datos demo para el sistema de inventario
 * Crea productos de café, accesorios, merchandising, proveedores y movimientos
 */

async function seedInventory() {
  console.log('🌱 Iniciando seed de inventario...\n');

  try {
    // 1. CREAR PROVEEDORES
    console.log('👥 Creando proveedores...');
    
    const suppliers = [
      {
        name: 'Finca La Esperanza',
        contact_name: 'Carlos Rodríguez',
        email: 'carlos@fincalaesperanza.co',
        phone: '+57 310 555 0101',
        tax_id: '900123456-1',
        payment_terms: '30 días'
      },
      {
        name: 'Importadora de Equipos Café Pro',
        contact_name: 'Ana Martínez',
        email: 'ventas@cafepro.com',
        phone: '+57 311 555 0202',
        tax_id: '800234567-2',
        payment_terms: '15 días'
      },
      {
        name: 'Textiles Colombia SAS',
        contact_name: 'Luis González',
        email: 'comercial@textilescol.co',
        phone: '+57 312 555 0303',
        tax_id: '900345678-3',
        payment_terms: '45 días'
      }
    ];

    const supplierIds = [];
    for (const supplier of suppliers) {
      const result = await query(
        `INSERT INTO product_suppliers (name, contact_name, email, phone, tax_id, payment_terms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [supplier.name, supplier.contact_name, supplier.email, supplier.phone, supplier.tax_id, supplier.payment_terms]
      );
      supplierIds.push(result.rows.insertId);
      console.log(`  ✓ ${supplier.name}`);
    }

    // 2. CREAR PRODUCTOS DE CAFÉ
    console.log('\n☕ Creando productos de café...');
    
    const coffeeProducts = [
      {
        id: 'CF-HUILA-001',
        sku: 'CF-HUI-250',
        name: 'Café Huila Premium',
        description: 'Café de altura del departamento de Huila. Notas de caramelo, chocolate y frutas rojas. Tostado medio.',
        category: 'cafe',
        subcategory: 'Huila',
        origin: 'Huila, Colombia',
        process: 'Lavado',
        roast: 'Medio',
        price: 45000,
        cost: 28000,
        stock_quantity: 150,
        stock_min: 20,
        weight: 250,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
        is_active: true,
        is_bestseller: true,
        is_fast: true
      },
      {
        id: 'CF-NARINO-001',
        sku: 'CF-NAR-250',
        name: 'Café Nariño Especial',
        description: 'Café de las montañas de Nariño. Acidez brillante, notas cítricas y florales. Tostado claro.',
        category: 'cafe',
        subcategory: 'Nariño',
        origin: 'Nariño, Colombia',
        process: 'Honey',
        roast: 'Claro',
        price: 48000,
        cost: 30000,
        stock_quantity: 120,
        stock_min: 15,
        weight: 250,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800',
        is_active: true,
        is_new: true,
        is_fast: true
      },
      {
        id: 'CF-SIERRA-001',
        sku: 'CF-SIE-500',
        name: 'Café Sierra Nevada',
        description: 'Café orgánico de la Sierra Nevada. Cuerpo balanceado, notas de nuez y chocolate oscuro.',
        category: 'cafe',
        subcategory: 'Sierra Nevada',
        origin: 'Sierra Nevada, Colombia',
        process: 'Natural',
        roast: 'Oscuro',
        price: 52000,
        cost: 32000,
        stock_quantity: 80,
        stock_min: 10,
        weight: 500,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
        is_active: true,
        is_deal: true
      },
      {
        id: 'CF-ANTIOQ-001',
        sku: 'CF-ANT-1000',
        name: 'Café Antioquia 1kg',
        description: 'Café tradicional de Antioquia. Ideal para preparaciones con leche. Tostado medio-oscuro.',
        category: 'cafe',
        subcategory: 'Antioquia',
        origin: 'Antioquia, Colombia',
        process: 'Lavado',
        roast: 'Medio-Oscuro',
        price: 85000,
        cost: 52000,
        stock_quantity: 60,
        stock_min: 8,
        weight: 1,
        weight_unit: 'kg',
        image_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800',
        is_active: true,
        is_bestseller: true
      },
      {
        id: 'CF-CAUCA-001',
        sku: 'CF-CAU-250',
        name: 'Café Cauca Exótico',
        description: 'Café experimental del Cauca con fermentación controlada. Perfil complejo y afrutado.',
        category: 'cafe',
        subcategory: 'Cauca',
        origin: 'Cauca, Colombia',
        process: 'Honey Fermentado',
        roast: 'Claro',
        price: 58000,
        cost: 38000,
        stock_quantity: 40,
        stock_min: 5,
        weight: 250,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
        is_active: true,
        is_new: true
      }
    ];

    for (const product of coffeeProducts) {
      await query(
        `INSERT INTO products (
          id, sku, name, description, category, subcategory, origin, process, roast,
          price, cost, stock_quantity, stock_min, weight, weight_unit, image_url,
          is_active, is_deal, is_bestseller, is_new, is_fast
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id, product.sku, product.name, product.description, product.category,
          product.subcategory, product.origin, product.process, product.roast,
          product.price, product.cost, product.stock_quantity, product.stock_min,
          product.weight, product.weight_unit, product.image_url,
          product.is_active, product.is_deal || false, product.is_bestseller || false,
          product.is_new || false, product.is_fast || false
        ]
      );
      console.log(`  ✓ ${product.name} (${product.stock_quantity} unidades)`);

      // Asociar con proveedor de café
      await query(
        `INSERT INTO product_supplier_prices (product_id, supplier_id, cost_price, is_preferred, lead_time_days)
         VALUES (?, ?, ?, true, 7)`,
        [product.id, supplierIds[0], product.cost]
      );
    }

    // 3. CREAR ACCESORIOS
    console.log('\n🔧 Creando accesorios para café...');
    
    const accessories = [
      {
        id: 'ACC-CHEMEX-001',
        sku: 'ACC-CHX-6C',
        name: 'Chemex Classic 6 Tazas',
        description: 'Cafetera de vidrio Chemex original. Método de filtrado por gravedad que resalta claridad y dulzura.',
        category: 'accesorio',
        subcategory: 'Chemex',
        price: 165000,
        cost: 98000,
        stock_quantity: 25,
        stock_min: 5,
        weight: 680,
        weight_unit: 'g',
        dimensions: '21cm alto x 13cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800',
        is_active: true,
        is_bestseller: true
      },
      {
        id: 'ACC-V60-001',
        sku: 'ACC-V60-02',
        name: 'Hario V60 Dripper Cerámica',
        description: 'Dripper V60 de cerámica. Diseño cónico con estrías en espiral para extracción óptima.',
        category: 'accesorio',
        subcategory: 'V60',
        price: 85000,
        cost: 52000,
        stock_quantity: 45,
        stock_min: 10,
        weight: 420,
        weight_unit: 'g',
        dimensions: '12cm alto x 11cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800',
        is_active: true,
        is_fast: true
      },
      {
        id: 'ACC-PRENSA-001',
        sku: 'ACC-FRP-1L',
        name: 'Prensa Francesa 1 Litro',
        description: 'Cafetera de émbolo con estructura de acero inoxidable y vidrio borosilicato resistente al calor.',
        category: 'accesorio',
        subcategory: 'Prensa Francesa',
        price: 95000,
        cost: 58000,
        stock_quantity: 35,
        stock_min: 8,
        weight: 550,
        weight_unit: 'g',
        dimensions: '22cm alto x 10cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800',
        is_active: true,
        is_deal: true
      },
      {
        id: 'ACC-MOLINILLO-001',
        sku: 'ACC-GRD-MAN',
        name: 'Molinillo Manual Hario',
        description: 'Molinillo de fresas cónicas de cerámica. Ajuste preciso de molienda, perfecto para viajes.',
        category: 'accesorio',
        subcategory: 'Molinillo',
        price: 125000,
        cost: 75000,
        stock_quantity: 20,
        stock_min: 5,
        weight: 380,
        weight_unit: 'g',
        dimensions: '18cm alto x 7cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1587828696648-c6326d159561?w=800',
        is_active: true,
        is_new: true
      },
      {
        id: 'ACC-FILTROS-001',
        sku: 'ACC-FLT-V60',
        name: 'Filtros V60 (100 unidades)',
        description: 'Filtros de papel natural para Hario V60 tamaño 02. Sin blanquear, grosor óptimo.',
        category: 'accesorio',
        subcategory: 'Filtros',
        price: 18000,
        cost: 9000,
        stock_quantity: 200,
        stock_min: 30,
        weight: 150,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
        is_active: true,
        is_fast: true
      },
      {
        id: 'ACC-FILTROS-002',
        sku: 'ACC-FLT-CHX',
        name: 'Filtros Chemex (100 unidades)',
        description: 'Filtros especiales Chemex de papel grueso. Remueven aceites y sedimentos para claridad máxima.',
        category: 'accesorio',
        subcategory: 'Filtros',
        price: 22000,
        cost: 11000,
        stock_quantity: 150,
        stock_min: 25,
        weight: 180,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
        is_active: true,
        is_fast: true
      },
      {
        id: 'ACC-BASCULA-001',
        sku: 'ACC-SCL-001',
        name: 'Báscula Digital con Timer',
        description: 'Báscula de precisión 0.1g con temporizador integrado. Ideal para métodos de vertido.',
        category: 'accesorio',
        subcategory: 'Báscula',
        price: 145000,
        cost: 88000,
        stock_quantity: 18,
        stock_min: 5,
        weight: 320,
        weight_unit: 'g',
        dimensions: '15cm x 15cm x 2.5cm',
        image_url: 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800',
        is_active: true
      },
      {
        id: 'ACC-TERMO-001',
        sku: 'ACC-TRM-500',
        name: 'Termo Keep Cup 500ml',
        description: 'Termo de doble pared con aislamiento al vacío. Mantiene temperatura por 8 horas.',
        category: 'accesorio',
        subcategory: 'Termo',
        price: 78000,
        cost: 45000,
        stock_quantity: 50,
        stock_min: 12,
        weight: 280,
        weight_unit: 'g',
        dimensions: '18cm alto x 8cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1595981234058-9f71ea2f16c1?w=800',
        is_active: true,
        is_bestseller: true
      }
    ];

    for (const product of accessories) {
      await query(
        `INSERT INTO products (
          id, sku, name, description, category, subcategory, price, cost,
          stock_quantity, stock_min, weight, weight_unit, dimensions, image_url,
          is_active, is_deal, is_bestseller, is_new, is_fast
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id, product.sku, product.name, product.description, product.category,
          product.subcategory, product.price, product.cost, product.stock_quantity,
          product.stock_min, product.weight, product.weight_unit, product.dimensions,
          product.image_url, product.is_active, product.is_deal || false,
          product.is_bestseller || false, product.is_new || false, product.is_fast || false
        ]
      );
      console.log(`  ✓ ${product.name} (${product.stock_quantity} unidades)`);

      // Asociar con proveedor de equipos
      await query(
        `INSERT INTO product_supplier_prices (product_id, supplier_id, cost_price, is_preferred, lead_time_days)
         VALUES (?, ?, ?, true, 15)`,
        [product.id, supplierIds[1], product.cost]
      );
    }

    // 4. CREAR MERCHANDISING
    console.log('\n👕 Creando merchandising...');
    
    const merchandise = [
      {
        id: 'MER-CAMISETA-001',
        sku: 'MER-TSH-M',
        name: 'Camiseta DobleYo Negra',
        description: 'Camiseta 100% algodón con logo DobleYo bordado. Talla M.',
        category: 'merchandising',
        subcategory: 'Camiseta',
        price: 45000,
        cost: 22000,
        stock_quantity: 30,
        stock_min: 10,
        weight: 180,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
        is_active: true
      },
      {
        id: 'MER-CAMISETA-002',
        sku: 'MER-TSH-L',
        name: 'Camiseta DobleYo Blanca',
        description: 'Camiseta 100% algodón con estampado de café. Talla L.',
        category: 'merchandising',
        subcategory: 'Camiseta',
        price: 45000,
        cost: 22000,
        stock_quantity: 25,
        stock_min: 8,
        weight: 190,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800',
        is_active: true
      },
      {
        id: 'MER-TAZA-001',
        sku: 'MER-MUG-350',
        name: 'Taza Cerámica DobleYo',
        description: 'Taza de cerámica artesanal con logo DobleYo. Capacidad 350ml.',
        category: 'merchandising',
        subcategory: 'Taza',
        price: 32000,
        cost: 16000,
        stock_quantity: 60,
        stock_min: 15,
        weight: 420,
        weight_unit: 'g',
        dimensions: '10cm alto x 9cm diámetro',
        image_url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800',
        is_active: true,
        is_fast: true
      },
      {
        id: 'MER-GORRA-001',
        sku: 'MER-CAP-001',
        name: 'Gorra DobleYo Ajustable',
        description: 'Gorra de algodón con bordado DobleYo. Talla ajustable.',
        category: 'merchandising',
        subcategory: 'Gorra',
        price: 38000,
        cost: 19000,
        stock_quantity: 40,
        stock_min: 10,
        weight: 120,
        weight_unit: 'g',
        image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800',
        is_active: true,
        is_new: true
      },
      {
        id: 'MER-BOLSA-001',
        sku: 'MER-BAG-TOTE',
        name: 'Bolsa Tote DobleYo',
        description: 'Bolsa de lona reutilizable con estampado de granos de café.',
        category: 'merchandising',
        subcategory: 'Bolsa',
        price: 28000,
        cost: 14000,
        stock_quantity: 45,
        stock_min: 12,
        weight: 150,
        weight_unit: 'g',
        dimensions: '40cm x 35cm',
        image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800',
        is_active: true
      }
    ];

    for (const product of merchandise) {
      await query(
        `INSERT INTO products (
          id, sku, name, description, category, subcategory, price, cost,
          stock_quantity, stock_min, weight, weight_unit, dimensions, image_url,
          is_active, is_new, is_fast
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id, product.sku, product.name, product.description, product.category,
          product.subcategory, product.price, product.cost, product.stock_quantity,
          product.stock_min, product.weight, product.weight_unit, product.dimensions || null,
          product.image_url, product.is_active, product.is_new || false, product.is_fast || false
        ]
      );
      console.log(`  ✓ ${product.name} (${product.stock_quantity} unidades)`);

      // Asociar con proveedor de textiles
      await query(
        `INSERT INTO product_supplier_prices (product_id, supplier_id, cost_price, is_preferred, lead_time_days)
         VALUES (?, ?, ?, true, 20)`,
        [product.id, supplierIds[2], product.cost]
      );
    }

    // 5. CREAR MOVIMIENTOS DE INVENTARIO DE EJEMPLO
    console.log('\n📦 Creando movimientos de inventario...');
    
    const movements = [
      // Entradas iniciales
      { product_id: 'CF-HUILA-001', type: 'entrada', qty: 150, reason: 'Stock inicial', ref: 'INIT-001' },
      { product_id: 'CF-NARINO-001', type: 'entrada', qty: 120, reason: 'Stock inicial', ref: 'INIT-002' },
      { product_id: 'ACC-CHEMEX-001', type: 'entrada', qty: 25, reason: 'Stock inicial', ref: 'INIT-003' },
      
      // Ventas
      { product_id: 'CF-HUILA-001', type: 'salida', qty: 12, reason: 'Venta online', ref: 'ORD-1001' },
      { product_id: 'CF-HUILA-001', type: 'salida', qty: 8, reason: 'Venta online', ref: 'ORD-1002' },
      { product_id: 'ACC-V60-001', type: 'salida', qty: 3, reason: 'Venta tienda física', ref: 'POS-501' },
      { product_id: 'MER-TAZA-001', type: 'salida', qty: 5, reason: 'Venta online', ref: 'ORD-1003' },
      
      // Compras a proveedores
      { product_id: 'CF-SIERRA-001', type: 'entrada', qty: 50, reason: 'Compra a proveedor', ref: 'PO-2001' },
      { product_id: 'ACC-FILTROS-001', type: 'entrada', qty: 100, reason: 'Reposición stock', ref: 'PO-2002' },
      
      // Devoluciones
      { product_id: 'CF-NARINO-001', type: 'devolucion', qty: 2, reason: 'Devolución cliente', ref: 'DEV-301' },
      
      // Mermas
      { product_id: 'CF-ANTIOQ-001', type: 'merma', qty: 1, reason: 'Paquete dañado en almacén', ref: 'MER-101' },
      
      // Ajustes
      { product_id: 'ACC-PRENSA-001', type: 'ajuste', qty: 35, reason: 'Ajuste inventario físico', ref: 'ADJ-401' }
    ];

    for (const mov of movements) {
      // Obtener stock actual
      const current = await query('SELECT stock_quantity FROM products WHERE id = ?', [mov.product_id]);
      const currentStock = current.rows[0]?.stock_quantity || 0;
      
      let newStock = currentStock;
      let actualQty = mov.qty;
      
      if (mov.type === 'entrada' || mov.type === 'devolucion') {
        newStock = currentStock + mov.qty;
      } else if (mov.type === 'salida' || mov.type === 'merma') {
        newStock = Math.max(0, currentStock - mov.qty);
        actualQty = currentStock - newStock; // Cantidad real restada
      } else if (mov.type === 'ajuste') {
        newStock = mov.qty;
        actualQty = newStock - currentStock;
      }

      // Registrar movimiento
      await query(
        `INSERT INTO inventory_movements (
          product_id, movement_type, quantity, quantity_before, quantity_after,
          reason, reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mov.product_id, mov.type, actualQty, currentStock, newStock, mov.reason, mov.ref]
      );

      // Actualizar stock
      await query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, mov.product_id]);
      
      console.log(`  ✓ ${mov.type.toUpperCase()} ${mov.product_id}: ${currentStock} → ${newStock}`);
    }

    // 6. RESUMEN FINAL
    console.log('\n📊 Resumen de datos creados:');
    
    const stats = await query(`
      SELECT 
        category,
        COUNT(*) as total,
        SUM(stock_quantity) as total_stock,
        SUM(stock_quantity * price) as total_value
      FROM products
      GROUP BY category
    `);

    for (const stat of stats.rows) {
      console.log(`  ${stat.category.toUpperCase()}: ${stat.total} productos | Stock: ${stat.total_stock} | Valor: $${stat.total_value.toLocaleString('es-CO')}`);
    }

    const movCount = await query('SELECT COUNT(*) as total FROM inventory_movements');
    console.log(`\n  Total movimientos: ${movCount.rows[0].total}`);

    console.log('\n✅ Seed completado exitosamente!\n');
    console.log('🎯 Accede a /admin/inventario para ver los datos\n');

  } catch (error) {
    console.error('❌ Error en seed:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedInventory()
    .then(() => {
      console.log('👋 Seed finalizado');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error fatal:', err);
      process.exit(1);
    });
}

export { seedInventory };

// Escrituras del catálogo: ajustar stock y editar precio o textos de un
// producto. Solo admin, siempre con tarjeta. Nunca crea ni retira productos,
// ni toca SKU, categoría o imágenes.
//
// El stock se ajusta con los mismos caminos que el panel: updateStock() de
// routes/stock.js (producto sin variantes) o el movimiento de variante de
// PUT /api/inventory/variants/:id. Los dos dejan el movimiento en
// inventory_movements y avisan a MercadoLibre con scheduleStockSync().

import { z } from 'zod';
import { query, withTransaction } from '../../../db.js';
import { logAudit } from '../../audit.js';
import { scheduleStockSync } from '../../mlStock.js';
import { updateStock } from '../../../routes/stock.js';
import { dinero } from '../herramientas/comun.js';
import { vistaCambio, propuesta, hecho, noSe } from './cambio.js';

async function producto(id) {
  const { rows } = await query(
    `SELECT p.id, p.name, p.price, p.description, p.stock_quantity, p.is_active,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variantes,
            (SELECT COUNT(*) FROM ml_listings l WHERE l.product_id = p.id AND l.is_active = 1) AS publicaciones_ml
       FROM products p WHERE p.id = ?`,
    [String(id).trim()],
  );
  return rows[0] ?? null;
}

async function variante(id, productoId) {
  const { rows } = await query(
    'SELECT id, product_id, size_label, grind_label, price_cop, stock_quantity, is_active FROM product_variants WHERE id = ? AND product_id = ?',
    [id, productoId],
  );
  return rows[0] ?? null;
}

const nombreVariante = (v) => [v.size_label, v.grind_label].filter(Boolean).join(' · ') || `Variante ${v.id}`;

export const ajustarStock = {
  nombre: 'ajustar_stock',
  descripcion:
    'Fija el stock físico de un producto, o de una de sus variantes si el producto vende por variante, con un motivo que queda ' +
    'en el libro de movimientos. Si el producto está publicado en MercadoLibre, la cantidad publicada allá también cambia. ' +
    'No se ejecuta sola: la persona ve el cambio y decide. Busque antes los ids con consultar_productos y pregunte el motivo si ' +
    'no lo dijo.',
  esquema: z.object({
    producto_id: z.string().min(1).max(80).describe('Id del producto (sale de consultar_productos).'),
    variante_id: z.number().int().positive().optional().describe('Id de la variante, obligatorio si el producto tiene variantes.'),
    cantidad: z.number().int().min(0).max(100000).describe('Stock físico NUEVO (no la diferencia), en unidades.'),
    motivo: z.string().min(3).max(160).describe('Motivo del ajuste, con las palabras de la persona (conteo, llegó empaque, daño...).'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const p = await producto(entrada.producto_id);
    if (!p) return noSe(`No existe el producto ${entrada.producto_id}.`);
    const tieneVariantes = Number(p.variantes) > 0;
    let v = null;
    if (tieneVariantes) {
      if (!entrada.variante_id) return noSe(`El producto ${p.name} vende por variantes: indique variante_id (consultar_productos las lista).`);
      v = await variante(entrada.variante_id, p.id);
      if (!v) return noSe(`La variante ${entrada.variante_id} no es de ${p.name}.`);
    } else if (entrada.variante_id) {
      return noSe(`El producto ${p.name} no tiene variantes: ajuste sin variante_id.`);
    }
    const antes = Number(v ? v.stock_quantity : p.stock_quantity) || 0;
    if (antes === entrada.cantidad) return noSe(`El stock ya es ${antes}. No hay nada que cambiar.`);

    const avisos = [];
    if (Number(p.publicaciones_ml) > 0) {
      avisos.push('Este producto está publicado en MercadoLibre: la cantidad disponible allá también cambia. Desde el panel no se deshace sola.');
    }
    if (!p.is_active) avisos.push('El producto está retirado de la tienda; el stock cambia igual.');

    const vista = vistaCambio({
      rotulo: 'Stock',
      titulo: p.name,
      contexto: v ? nombreVariante(v) : null,
      cambios: [
        { campo: 'Unidades', antes, despues: entrada.cantidad },
        { campo: 'Motivo', antes: null, despues: entrada.motivo.trim() },
      ],
      avisos,
    });
    return propuesta(`Stock de ${p.name}${v ? ` (${nombreVariante(v)})` : ''}`, `${antes} → ${entrada.cantidad} unidades`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const p = await producto(entrada.producto_id);
    const motivo = `${entrada.motivo.trim()} (asistente)`;

    if (Number(p.variantes) > 0) {
      const v = await variante(entrada.variante_id, p.id);
      const antes = Number(v.stock_quantity) || 0;
      const cambio = await withTransaction(async (tx) => {
        const r = await tx.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ? AND stock_quantity = ?', [entrada.cantidad, v.id, antes]);
        if (!r.rowCount) return false;
        await tx.query(
          `INSERT INTO inventory_movements (product_id, variant_id, movement_type, quantity, quantity_before, quantity_after, reason, reference, user_id)
           VALUES (?, ?, 'ajuste', ?, ?, ?, ?, 'ASISTENTE', ?)`,
          [p.id, v.id, entrada.cantidad - antes, antes, entrada.cantidad, motivo, ctx.usuario.id || null],
        );
        return true;
      });
      if (!cambio) return noSe('El stock cambió mientras tanto (quizá entró una venta). Consulte de nuevo y vuelva a proponer.');
      await logAudit(ctx.usuario.id, 'update', 'product_variant', v.id, { product_id: p.id, stockBefore: antes, stockAfter: entrada.cantidad, via: 'asistente' });
      scheduleStockSync([p.id]);
      return hecho(`Stock de ${p.name} (${nombreVariante(v)}): ${antes} → ${entrada.cantidad}.`, '/admin/inventario');
    }

    const r = await updateStock(p.id, entrada.cantidad, { userId: ctx.usuario.id || null, reason: motivo });
    if (!r) return noSe(`No existe el producto ${p.id}.`);
    await logAudit(ctx.usuario.id, 'update', 'product', p.id, { stockBefore: r.before, stockAfter: r.after, via: 'asistente' });
    return hecho(`Stock de ${p.name}: ${r.before} → ${r.after}.`, '/admin/inventario');
  },
};

export const editarProducto = {
  nombre: 'editar_producto',
  descripcion:
    'Cambia el precio (del producto o de una variante), el nombre visible o la descripción de un producto. Se ve de inmediato en ' +
    'la tienda. No cambia el precio en MercadoLibre, ni SKU, categoría o imágenes. No se ejecuta sola: la persona ve el cambio y ' +
    'decide. Busque antes los ids con consultar_productos y pase solo los campos que pidió cambiar.',
  esquema: z.object({
    producto_id: z.string().min(1).max(80).describe('Id del producto (sale de consultar_productos).'),
    variante_id: z.number().int().positive().optional().describe('Id de la variante si el precio que cambia es el de una variante.'),
    precio: z.number().int().min(500).max(20_000_000).optional().describe('Precio nuevo en pesos colombianos, sin puntos.'),
    nombre: z.string().min(3).max(120).optional().describe('Nombre visible nuevo.'),
    descripcion: z.string().min(10).max(2000).optional().describe('Descripción nueva, completa.'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    if (entrada.precio == null && !entrada.nombre && !entrada.descripcion) return noSe('No hay ningún campo para cambiar.');
    if (entrada.variante_id && entrada.precio == null) return noSe('Con variante_id solo se cambia el precio de la variante.');
    const p = await producto(entrada.producto_id);
    if (!p) return noSe(`No existe el producto ${entrada.producto_id}.`);
    let v = null;
    if (entrada.variante_id) {
      v = await variante(entrada.variante_id, p.id);
      if (!v) return noSe(`La variante ${entrada.variante_id} no es de ${p.name}.`);
    } else if (entrada.precio != null && Number(p.variantes) > 0) {
      return noSe(`${p.name} vende por variantes y cada una tiene su precio: indique variante_id.`);
    }

    const cambios = [];
    const avisos = ['Se ve de inmediato en la tienda.'];
    if (entrada.precio != null) {
      const antes = Number(v ? v.price_cop : p.price) || 0;
      cambios.push({ campo: v ? `Precio (${nombreVariante(v)})` : 'Precio', antes: dinero(antes).texto, despues: dinero(entrada.precio).texto });
      if (antes > 0 && Math.abs(entrada.precio - antes) / antes > 0.5) avisos.push('El precio cambia más de la mitad. Revise que la cifra sea la correcta.');
      if (Number(p.publicaciones_ml) > 0) avisos.push('El precio en MercadoLibre no cambia: hay que ajustarlo allá.');
    }
    if (entrada.nombre) cambios.push({ campo: 'Nombre', antes: p.name, despues: entrada.nombre.trim() });
    if (entrada.descripcion) cambios.push({ campo: 'Descripción', antes: p.description, despues: entrada.descripcion.trim() });

    const vista = vistaCambio({ rotulo: 'Producto', titulo: p.name, contexto: String(p.id), cambios, avisos });
    if (!vista.cambios.length) return noSe('Los valores pedidos ya son los actuales.');
    return propuesta(`Producto ${p.name}`, vista.cambios.map((c) => c.campo).join(', '), vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const p = await producto(entrada.producto_id);
    const campos = [];
    const args = [];
    if (entrada.precio != null && !entrada.variante_id) { campos.push('price = ?'); args.push(entrada.precio); }
    if (entrada.nombre) { campos.push('name = ?'); args.push(entrada.nombre.trim()); }
    if (entrada.descripcion) { campos.push('description = ?'); args.push(entrada.descripcion.trim()); }

    await withTransaction(async (tx) => {
      if (campos.length) {
        await tx.query(`UPDATE products SET ${campos.join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...args, p.id]);
      }
      if (entrada.precio != null && entrada.variante_id) {
        await tx.query('UPDATE product_variants SET price_cop = ? WHERE id = ? AND product_id = ?', [entrada.precio, entrada.variante_id, p.id]);
      }
    });
    await logAudit(ctx.usuario.id, 'update', entrada.variante_id ? 'product_variant' : 'product', entrada.variante_id ?? p.id, {
      product_id: p.id,
      fields: Object.keys(entrada).filter((k) => !['producto_id', 'variante_id'].includes(k)),
      via: 'asistente',
    });
    return hecho(`Producto ${entrada.nombre?.trim() || p.name} actualizado: ${prep.motivo}.`, '/admin/productos');
  },
};

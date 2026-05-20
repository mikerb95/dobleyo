import { Router } from 'express';
import { logger } from '../logger.js';
import { query } from '../db.js';

export const couponsRouter = Router();

/**
 * POST /api/coupons/validate
 * Body: { code, email }
 * Valida el código y verifica la condición de primera compra.
 * No autenticación requerida — el email se usa solo para la verificación.
 */
couponsRouter.post('/validate', async (req, res) => {
  try {
    const code  = (req.body.code  || '').trim().toUpperCase();
    const email = (req.body.email || '').trim().toLowerCase();

    if (!code)  return res.status(400).json({ success: false, error: 'Código requerido' });
    if (!email) return res.status(400).json({ success: false, error: 'Correo requerido para validar el cupón' });

    const codeResult = await query(
      `SELECT * FROM discount_codes WHERE code = ? AND active = 1`,
      [code]
    );

    if (!codeResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Código de descuento inválido o inactivo' });
    }

    const dc = codeResult.rows[0];

    // Expiración
    if (dc.expires_at && new Date(dc.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Este código ha expirado' });
    }

    // Usos máximos globales
    if (dc.max_uses !== null && dc.uses_count >= dc.max_uses) {
      return res.status(400).json({ success: false, error: 'Este código ya alcanzó su límite de usos' });
    }

    // Solo primera compra: verificar que el email no tenga órdenes pagadas previas
    if (dc.first_purchase_only) {
      const prevOrders = await query(
        `SELECT COUNT(*) as cnt FROM customer_orders
         WHERE customer_email = ? AND status IN ('paid', 'processing', 'shipped', 'delivered')`,
        [email]
      );
      if (Number(prevOrders.rows[0].cnt) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Este código es válido solo para tu primera compra'
        });
      }
    }

    return res.json({
      success: true,
      data: {
        code:          dc.code,
        discountType:  dc.discount_type,
        discountValue: dc.discount_value,
        firstPurchaseOnly: !!dc.first_purchase_only,
        description: dc.discount_type === 'percent'
          ? `${dc.discount_value}% de descuento`
          : `$${Number(dc.discount_value).toLocaleString('es-CO')} de descuento`,
      }
    });
  } catch (err) {
    logger.error({ err }, '[POST /api/coupons/validate] Error:');
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

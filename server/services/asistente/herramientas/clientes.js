// Herramienta de lectura: cuentas mayoristas del CRM y sus interacciones.
// Solo admin. Nunca lee crm_contacts (nombres, correos y teléfonos de
// personas) ni el NIT de la cuenta.

import { z } from 'zod';
import { ok, dinero, fecha, filas, deTercero, seguro, diasDesde } from './comun.js';

export const ETAPAS_CRM = {
  prospect: 'Prospecto',
  contacted: 'Contactado',
  sample_sent: 'Muestra enviada',
  negotiation: 'Negociación',
  active: 'Cliente activo',
  lost: 'Perdido',
};

export const TIPOS_INTERACCION = {
  call: 'Llamada',
  email: 'Correo',
  meeting: 'Reunión',
  sample: 'Muestra',
  quote: 'Cotización',
  note: 'Nota',
  stage_change: 'Cambio de etapa',
  order: 'Pedido',
  payment: 'Pago',
};

const SEGMENTOS = {
  importer_us: 'Importador EE. UU.',
  distributor_co: 'Distribuidor Colombia',
  hotel: 'Hotel',
  cafeteria: 'Cafetería',
  retail: 'Tienda',
  other: 'Otro',
};

export const consultarCrm = {
  nombre: 'consultar_crm',
  descripcion:
    'Cuentas mayoristas (B2B) del CRM: etapa del embudo, valor estimado, última interacción y, si se pide una cuenta, ' +
    'sus interacciones recientes. Úsela para "¿qué mayoristas no contactamos este mes?" o "¿en qué va Tostadores del Norte?". ' +
    'Da el id de la cuenta, que necesitan las acciones del CRM.',
  esquema: z.object({
    buscar: z.string().max(60).optional().describe('Nombre comercial o razón social, o parte de él.'),
    cuenta_id: z.number().int().positive().optional().describe('Id de una cuenta para ver su detalle e interacciones.'),
    etapa: z.enum(Object.keys(ETAPAS_CRM)).optional().describe('Etapa del embudo.'),
    sin_contacto_dias: z.number().int().min(1).max(365).optional().describe('Cuentas sin interacción hace al menos estos días.'),
    limite: z.number().int().min(1).max(30).optional(),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_crm', async (a) => {
    const where = [];
    const args = [];
    if (a.cuenta_id) { where.push('a.id = ?'); args.push(a.cuenta_id); }
    if (a.buscar) { where.push('(a.display_name LIKE ? OR a.legal_name LIKE ?)'); args.push(`%${a.buscar}%`, `%${a.buscar}%`); }
    if (a.etapa) { where.push('a.pipeline_stage = ?'); args.push(a.etapa); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let cuentas = await filas(
      `SELECT a.id, a.display_name, a.legal_name, a.segment, a.city, a.country, a.pipeline_stage, a.pipeline_value,
              a.notes, a.updated_at,
              (SELECT MAX(i.occurred_at) FROM crm_interactions i WHERE i.account_id = a.id) AS ultima_interaccion
         FROM crm_accounts a ${w}
        ORDER BY a.updated_at DESC LIMIT ?`,
      [...args, a.sin_contacto_dias ? 200 : a.limite ?? 15],
    );
    if (a.sin_contacto_dias) {
      cuentas = cuentas
        .filter((c) => c.pipeline_stage !== 'lost')
        .filter((c) => {
          const d = diasDesde(c.ultima_interaccion);
          return d == null || d >= a.sin_contacto_dias;
        })
        .slice(0, a.limite ?? 15);
    }

    let interacciones = [];
    if (a.cuenta_id && cuentas.length) {
      interacciones = await filas(
        `SELECT kind, subject, body, occurred_at FROM crm_interactions
          WHERE account_id = ? ORDER BY occurred_at DESC LIMIT 10`,
        [a.cuenta_id],
      );
    }

    return ok({
      mostradas: cuentas.length,
      cuentas: cuentas.map((c) => ({
        id: Number(c.id),
        nombre: c.display_name || c.legal_name,
        razon_social: c.legal_name,
        segmento: SEGMENTOS[c.segment] ?? c.segment,
        ciudad: [c.city, c.country].filter(Boolean).join(', ') || null,
        etapa: ETAPAS_CRM[c.pipeline_stage] ?? c.pipeline_stage,
        etapa_codigo: c.pipeline_stage,
        valor_estimado: dinero(c.pipeline_value),
        ultima_interaccion: fecha(c.ultima_interaccion),
        dias_sin_contacto: diasDesde(c.ultima_interaccion),
        escritoPorTerceros: c.notes ? { notas: deTercero(c.notes, 300) } : undefined,
        enlace: '/admin/crm',
      })),
      interacciones: interacciones.map((i) => ({
        tipo: TIPOS_INTERACCION[i.kind] ?? i.kind,
        fecha: fecha(i.occurred_at),
        asunto: deTercero(i.subject, 120),
        escritoPorTerceros: i.body ? { detalle: deTercero(i.body, 400) } : undefined,
      })),
    });
  }),
};

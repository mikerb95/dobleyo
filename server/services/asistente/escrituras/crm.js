// Escrituras del CRM: registrar una interacción y mover la etapa del embudo.
// Solo admin, siempre con tarjeta. No crea cuentas ni toca contactos (datos
// personales) y no le escribe a nadie.

import { z } from 'zod';
import { query } from '../../../db.js';
import { logAudit } from '../../audit.js';
import { ETAPAS_CRM, TIPOS_INTERACCION } from '../herramientas/clientes.js';
import { vistaCambio, propuesta, hecho, noSe } from './cambio.js';

const TIPOS_PERMITIDOS = ['call', 'email', 'meeting', 'sample', 'quote', 'note'];

async function cuenta(id) {
  const { rows } = await query('SELECT id, display_name, legal_name, pipeline_stage FROM crm_accounts WHERE id = ?', [id]);
  return rows[0] ?? null;
}

const nombreCuenta = (c) => c.display_name || c.legal_name;

export const registrarInteraccionCrm = {
  nombre: 'registrar_interaccion_crm',
  descripcion:
    'Registra en una cuenta del CRM una llamada, correo, reunión, muestra, cotización o nota, con su asunto y detalle. No le ' +
    'escribe a nadie: solo deja el registro. No se ejecuta sola: la persona ve el cambio y decide. Busque antes el id de la ' +
    'cuenta con consultar_crm.',
  esquema: z.object({
    cuenta_id: z.number().int().positive().describe('Id de la cuenta (sale de consultar_crm).'),
    tipo: z.enum(TIPOS_PERMITIDOS).describe('Tipo de interacción.'),
    asunto: z.string().min(3).max(140).describe('Asunto corto, con las palabras de la persona.'),
    detalle: z.string().max(2000).optional().describe('Detalle de lo conversado, si la persona lo dio.'),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Fecha en que ocurrió (AAAA-MM-DD), si no fue hoy.'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const c = await cuenta(entrada.cuenta_id);
    if (!c) return noSe(`No existe la cuenta ${entrada.cuenta_id} en el CRM.`);
    const vista = vistaCambio({
      rotulo: 'CRM',
      titulo: nombreCuenta(c),
      contexto: `Etapa: ${ETAPAS_CRM[c.pipeline_stage] ?? c.pipeline_stage}`,
      cambios: [
        { campo: 'Tipo', antes: null, despues: TIPOS_INTERACCION[entrada.tipo] },
        { campo: 'Asunto', antes: null, despues: entrada.asunto.trim() },
        ...(entrada.detalle ? [{ campo: 'Detalle', antes: null, despues: entrada.detalle.trim() }] : []),
        ...(entrada.fecha ? [{ campo: 'Fecha', antes: null, despues: entrada.fecha }] : []),
      ],
    });
    return propuesta(`Interacción con ${nombreCuenta(c)}`, `${TIPOS_INTERACCION[entrada.tipo]}: ${entrada.asunto.trim()}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const c = await cuenta(entrada.cuenta_id);
    const r = await query(
      `INSERT INTO crm_interactions (account_id, kind, subject, body, occurred_at, created_by)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?) RETURNING id`,
      [c.id, entrada.tipo, entrada.asunto.trim(), entrada.detalle?.trim() || null, entrada.fecha ? `${entrada.fecha} 17:00:00` : null, ctx.usuario.id || null],
    );
    await query("UPDATE crm_accounts SET updated_at = datetime('now') WHERE id = ?", [c.id]);
    await logAudit(ctx.usuario.id, 'create', 'crm_interaction', r.rows[0].id, { account_id: c.id, kind: entrada.tipo, via: 'asistente' });
    return hecho(`Quedó registrada la ${TIPOS_INTERACCION[entrada.tipo].toLowerCase()} con ${nombreCuenta(c)}.`, '/admin/crm');
  },
};

export const moverEtapaCrm = {
  nombre: 'mover_etapa_crm',
  descripcion:
    'Mueve una cuenta del CRM a otra etapa del embudo (prospecto, contactado, muestra enviada, negociación, cliente activo o ' +
    'perdido), con un motivo opcional que queda como nota. No se ejecuta sola: la persona ve el cambio y decide. Busque antes el ' +
    'id de la cuenta con consultar_crm.',
  esquema: z.object({
    cuenta_id: z.number().int().positive().describe('Id de la cuenta (sale de consultar_crm).'),
    etapa: z.enum(Object.keys(ETAPAS_CRM)).describe('Etapa nueva.'),
    motivo: z.string().max(300).optional().describe('Motivo del cambio, si la persona lo dio.'),
  }),
  roles: ['admin'],

  async preparar(entrada) {
    const c = await cuenta(entrada.cuenta_id);
    if (!c) return noSe(`No existe la cuenta ${entrada.cuenta_id} en el CRM.`);
    if (c.pipeline_stage === entrada.etapa) return noSe(`${nombreCuenta(c)} ya está en "${ETAPAS_CRM[entrada.etapa]}".`);
    const vista = vistaCambio({
      rotulo: 'CRM',
      titulo: nombreCuenta(c),
      cambios: [
        { campo: 'Etapa', antes: ETAPAS_CRM[c.pipeline_stage] ?? c.pipeline_stage, despues: ETAPAS_CRM[entrada.etapa] },
        ...(entrada.motivo ? [{ campo: 'Motivo (nota)', antes: null, despues: entrada.motivo.trim() }] : []),
      ],
    });
    return propuesta(`Etapa de ${nombreCuenta(c)}`, `${ETAPAS_CRM[c.pipeline_stage]} → ${ETAPAS_CRM[entrada.etapa]}`, vista);
  },

  async ejecutar(entrada, ctx) {
    const prep = await this.preparar(entrada, ctx);
    if (prep.ok !== true) return prep;
    const c = await cuenta(entrada.cuenta_id);
    const r = await query(
      "UPDATE crm_accounts SET pipeline_stage = ?, updated_at = datetime('now') WHERE id = ? AND pipeline_stage = ?",
      [entrada.etapa, c.id, c.pipeline_stage],
    );
    if (!r.rowCount) return noSe(`La cuenta ${nombreCuenta(c)} cambió mientras tanto. Consúltela de nuevo.`);
    if (entrada.motivo?.trim()) {
      await query(
        `INSERT INTO crm_interactions (account_id, kind, subject, body, created_by) VALUES (?, 'note', 'Motivo del cambio de etapa', ?, ?)`,
        [c.id, entrada.motivo.trim(), ctx.usuario.id || null],
      );
    }
    await logAudit(ctx.usuario.id, 'update', 'crm_account', c.id, { from: c.pipeline_stage, to: entrada.etapa, via: 'asistente' });
    return hecho(`${nombreCuenta(c)} pasó a "${ETAPAS_CRM[entrada.etapa]}".`, '/admin/crm');
  },
};

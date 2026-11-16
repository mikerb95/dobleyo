// Herramientas de lectura de producción.
//
// - `consultar_produccion` (admin): bandeja de tareas y la historia de un lote,
//   desde workflowService (lo mismo que ve /admin/produccion).
// - `mi_finca` (caficultor): solo sus fincas y sus lotes, hasta la venta del
//   café verde. Sin montos de compra ni kilos pagados (datos de compra, solo
//   admin, como en POST /api/coffee/harvest). Más estricto que la pantalla:
//   una finca sin dueño registrado NO cuenta como suya.

import { z } from 'zod';
import { ok, fallo, fecha, filas, kg, seguro } from './comun.js';
import { getWorkQueue, getLotJourney } from '../../workflowService.js';
import { getCurrentStage, STAGE_LABELS } from '../../lotStateMachine.js';
import { query } from '../../../db.js';

const ETIQUETA_TAREA = {
  store_green: 'Ingresar café verde a bodega',
  send_roasting: 'Enviar a tostión',
  receive_roast: 'Recibir café tostado',
  store_roasted: 'Almacenar café tostado',
  pack: 'Empacar',
  label: 'Etiquetar',
  cup: 'Catar',
};

const URGENCIA = { late: 'atrasada', now: 'para hoy', waiting: 'en espera', anytime: 'cuando se pueda' };

const ETIQUETA_EVENTO = {
  harvest: 'Cosecha',
  green_in: 'Ingreso a bodega (verde)',
  sent_roasting: 'Enviado a tostión',
  roast_received: 'Tostado recibido',
  roasted_in: 'Tostado almacenado',
  packed: 'Empacado',
  labeled: 'Etiquetado',
  cupping: 'Catación',
};

/** Datos del evento que sirven para responder, sin ubicaciones internas raras. */
function datosEvento(e) {
  const d = e.data ?? {};
  const out = {};
  if (d.kg != null) out.kilos = kg(d.kg);
  if (d.level) out.nivel_tueste = d.level;
  if (d.lossPct != null) out.merma_pct = d.lossPct;
  if (d.days != null) out.dias_en_maquila = d.days;
  if (d.score != null) out.puntaje = d.score;
  if (d.units != null) out.unidades = d.units;
  if (d.packageSize) out.presentacion = d.packageSize;
  if (d.location) out.ubicacion = d.location;
  return out;
}

const enlaceLote = (lotId) => `/admin/produccion?lote=${encodeURIComponent(lotId)}`;

const balance = (b) =>
  b ? { verde_kg: kg(b.greenKg), tostado_kg: kg(b.roastedKg), empacado_kg: kg(b.packedKg) } : null;

export const consultarProduccion = {
  nombre: 'consultar_produccion',
  descripcion:
    'Producción: sin lote, la bandeja de tareas (qué sigue con cada lote y qué está atrasado); con lote, la historia ' +
    'completa del lote (cosecha, bodega, tostión, empaque) y sus kilos. Úsela para "¿qué sigue en producción?" o ' +
    '"¿en qué va el lote COL-HUI-...?". Da los ids que necesitan las acciones de producción.',
  esquema: z.object({
    lote: z.string().max(80).optional().describe('Código del lote (lot_id), por ejemplo COL-HUI-1800-Caturra-Lavado-1A2B.'),
  }),
  roles: ['admin'],
  ejecutar: seguro('consultar_produccion', async (a, ctx) => {
    const user = { id: ctx.usuario.id, role: ctx.usuario.rol };
    if (a.lote) {
      const j = await getLotJourney(a.lote, user);
      if (!j) return fallo(`No encontré el lote ${a.lote}. Revise el código con la bandeja (sin lote).`);
      const ids = await filas(
        `SELECT 'tostion' AS tipo, rb.id, rb.status, rb.quantity_sent_kg AS kilos, rb.created_at FROM roasting_batches rb WHERE rb.lot_id = ?
         UNION ALL
         SELECT 'tostado', rc.id, rc.status, rc.weight_kg, rc.created_at FROM roasted_coffee rc
           JOIN roasting_batches rb ON rb.id = rc.roasting_id WHERE rb.lot_id = ?`,
        [a.lote, a.lote],
      );
      return ok({
        lote: j.lotId,
        finca: j.farmName,
        variedad: j.variety,
        proceso: j.process,
        region: j.region,
        altitud: j.altitude,
        cosechado: fecha(j.harvestedAt),
        kilos_actuales: balance(j.balance),
        eventos: (j.events ?? []).map((e) => ({ evento: ETIQUETA_EVENTO[e.kind] ?? e.kind, fecha: fecha(e.at), ...datosEvento(e) })),
        tareas: (j.tasks ?? []).map((t) => ({ tarea: ETIQUETA_TAREA[t.kind] ?? t.kind, urgencia: URGENCIA[t.urgency] ?? t.urgency })),
        tostiones: ids.filter((x) => x.tipo === 'tostion').map((x) => ({ id_tostion: Number(x.id), estado: x.status, kilos_enviados: kg(x.kilos), fecha: fecha(x.created_at) })),
        tostados: ids.filter((x) => x.tipo === 'tostado').map((x) => ({ id_tostado: Number(x.id), estado: x.status, kilos: kg(x.kilos), fecha: fecha(x.created_at) })),
        enlace: enlaceLote(j.lotId),
      });
    }
    const cola = await getWorkQueue(user);
    return ok({
      conteo: { atrasadas: cola.counts.late, para_hoy: cola.counts.now, en_espera: cola.counts.waiting, cuando_se_pueda: cola.counts.anytime },
      tareas: cola.tasks.slice(0, 20).map((t) => ({
        tarea: ETIQUETA_TAREA[t.kind] ?? t.kind,
        urgencia: URGENCIA[t.urgency] ?? t.urgency,
        lote: t.lot?.lotId,
        finca: t.lot?.farmName,
        kilos: balance(t.lot?.balance),
        enlace: enlaceLote(t.lot?.lotId ?? ''),
      })),
      lotes_en_curso: cola.lots.slice(0, 15).map((l) => ({ lote: l.lotId, finca: l.farmName, ultima_actividad: fecha(l.lastActivityAt), kilos: balance(l.balance) })),
      enlace: '/admin/produccion',
    });
  }),
};

export const miFinca = {
  nombre: 'mi_finca',
  descripcion:
    'Sus fincas y sus lotes: cosechas registradas, café verde guardado y entregas del café verde (envíos a tostión). ' +
    'Úsela para "¿cuánto café verde tengo guardado?" o "¿en qué va mi lote?".',
  esquema: z.object({
    lote: z.string().max(80).optional().describe('Código de uno de sus lotes para ver solo ese.'),
  }),
  roles: ['caficultor'],
  ejecutar: seguro('mi_finca', async (a, ctx) => {
    const fincas = await filas(
      'SELECT name, slug, region, municipality, altitude_min, altitude_max, hectares, varieties, processes FROM farms WHERE caficultor_id = ?',
      [ctx.usuario.id],
    );
    if (!fincas.length) return ok({ fincas: [], lotes: [], nota: 'No hay fincas registradas a su nombre.', enlace: '/admin/mi-finca' });

    const slugs = fincas.map((f) => f.slug);
    const marcas = slugs.map(() => '?').join(',');
    const args = [...slugs];
    let filtroLote = '';
    if (a.lote) { filtroLote = 'AND ch.lot_id = ?'; args.push(a.lote); }

    const cosechas = await filas(
      `SELECT ch.lot_id, ch.farm, ch.variety, ch.process, ch.created_at FROM coffee_harvests ch
        WHERE ch.farm IN (${marcas}) ${filtroLote} ORDER BY ch.created_at DESC LIMIT 20`,
      args,
    );
    if (a.lote && !cosechas.length) return fallo(`El lote ${a.lote} no aparece en sus fincas.`);

    const lotes = await Promise.all(
      cosechas.map(async (c) => {
        const [verde, entregas, etapa] = await Promise.all([
          filas('SELECT COALESCE(SUM(weight_kg), 0) AS kilos, MAX(storage_date) AS ultima FROM green_coffee_inventory WHERE lot_id = ?', [c.lot_id]),
          filas('SELECT quantity_sent_kg, created_at FROM roasting_batches WHERE lot_id = ? ORDER BY created_at', [c.lot_id]),
          getCurrentStage(query, c.lot_id).catch(() => null),
        ]);
        const entregadoKg = entregas.reduce((s, e) => s + (Number(e.quantity_sent_kg) || 0), 0);
        return {
          lote: c.lot_id,
          finca: fincas.find((f) => f.slug === c.farm)?.name ?? c.farm,
          variedad: c.variety,
          proceso: c.process,
          cosechado: fecha(c.created_at),
          etapa: etapa ? STAGE_LABELS[etapa] ?? etapa : null,
          verde_ingresado_kg: kg(verde[0]?.kilos),
          verde_entregado_kg: kg(entregadoKg),
          entregas: entregas.map((e) => ({ fecha: fecha(e.created_at), kilos: kg(e.quantity_sent_kg) })),
          enlace: enlaceLote(c.lot_id),
        };
      }),
    );

    return ok({
      fincas: fincas.map((f) => ({
        nombre: f.name,
        region: [f.municipality, f.region].filter(Boolean).join(', ') || null,
        altitud: f.altitude_min ? `${f.altitude_min}${f.altitude_max ? `-${f.altitude_max}` : ''} m s. n. m.` : null,
        hectareas: f.hectares ?? null,
        variedades: f.varieties ?? null,
        procesos: f.processes ?? null,
      })),
      lotes,
      enlace: '/admin/mi-finca',
    });
  }),
};

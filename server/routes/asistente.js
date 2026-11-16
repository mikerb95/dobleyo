// API del asistente con IA del panel (docs/plan-asistente.md).
//
// Todas las rutas exigen sesión del panel (admin o caficultor). El rol se lee
// de la base en cada petición (motor.usuarioActual), nunca del cuerpo.
//
//   GET  /api/asistente/estado            si la IA está disponible hoy para esta persona
//   GET  /api/asistente/buscar?q=         buscador del panel sin IA
//   GET  /api/asistente/recientes         últimas conversaciones propias
//   GET  /api/asistente/conversacion/:id  una conversación propia, para retomarla
//   POST /api/asistente                   { pregunta, id? }  preguntar o seguir (SSE)
//   POST /api/asistente/decision          { id, aprobado, opciones? }  aprobar o descartar (SSE)
//   GET  /api/asistente/topes             topes y consumo del mes (solo admin)
//   PUT  /api/asistente/topes             { empresaUsd, usuarioUsd } (solo admin)

import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticateToken, requireRole } from '../auth.js';
import { logger } from '../logger.js';
import { logAudit } from '../services/audit.js';
import { transmitir } from '../services/asistente/sse.js';
import * as motor from '../services/asistente/motor.js';
import * as topes from '../services/asistente/topes.js';
import { resumenDelMes } from '../services/asistente/consumo.js';
import { listarRecientes } from '../services/asistente/conversaciones.js';
import { buscarEnPanel } from '../services/asistente/buscador.js';
import { MODELO, TARIFA_VIGENTE_DESDE } from '../services/asistente/costo.js';

export const asistenteRouter = Router();

asistenteRouter.use(authenticateToken, requireRole(['admin', 'caficultor']));

// Rol actual desde la base: si a alguien le quitaron el rol, deja de entrar.
asistenteRouter.use(async (req, res, next) => {
  try {
    const usuario = await motor.usuarioActual(req.user);
    if (!usuario) return res.status(403).json({ success: false, error: 'Permisos insuficientes' });
    req.asistenteUsuario = usuario;
    next();
  } catch (err) {
    logger.error({ err }, '[asistente] No se pudo leer el usuario');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Freno adicional al limitador global: cada pregunta cuesta.
const limitePreguntas = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  // Las pruebas automáticas hacen muchas preguntas seguidas con el modelo simulado.
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => (req.asistenteUsuario ? `u:${req.asistenteUsuario.id}` : ipKeyGenerator(req.ip)),
  message: { success: false, error: 'Demasiadas preguntas seguidas. Espere un minuto.' },
});

const ATAJOS = {
  admin: ['¿Qué está pendiente hoy?', '¿Qué pedidos faltan por despachar?', '¿Cuánto vendimos este mes?', '¿Qué productos se están agotando?'],
  caficultor: ['¿Cuánto café verde tengo guardado?', '¿En qué van mis lotes?', '¿Dónde registro una cosecha?'],
};

function responderError(res, err, contexto) {
  if (err instanceof motor.ErrorAsistente) {
    return res.status(err.status).json({ success: false, error: err.message, ...err.extra });
  }
  logger.error({ err }, `[asistente] ${contexto}`);
  return res.status(500).json({ success: false, error: 'Error interno del servidor' });
}

asistenteRouter.get('/estado', async (req, res) => {
  const usuario = req.asistenteUsuario;
  const modo = motor.modoDelModelo();
  let hoy = null;
  try {
    hoy = await topes.estadoDeHoy(usuario.id);
  } catch (err) {
    logger.error({ err }, '[asistente] No se pudo leer el estado de hoy');
  }
  let motivo = null;
  if (!modo) motivo = 'Por ahora la caja solo busca: el asistente no tiene clave configurada.';
  else if (!hoy) motivo = 'No se pudo comprobar el gasto de hoy; por seguridad la caja solo busca.';
  else if (hoy.agotado === 'usuario') motivo = 'Usted alcanzó su tope de consultas de hoy. Mañana vuelve a estar disponible; la caja sigue buscando.';
  else if (hoy.agotado === 'empresa') motivo = 'Se alcanzó el tope de consultas de hoy del equipo. Mañana vuelve a estar disponible; la caja sigue buscando.';
  res.json({
    success: true,
    data: {
      disponible: !motivo,
      motivo,
      nombre: usuario.nombre,
      rol: usuario.rol,
      atajos: ATAJOS[usuario.rol] ?? [],
    },
  });
});

asistenteRouter.get('/buscar', async (req, res) => {
  try {
    const resultados = await buscarEnPanel(String(req.query.q ?? ''), req.asistenteUsuario);
    res.json({ success: true, data: resultados });
  } catch (err) {
    responderError(res, err, 'Error en el buscador');
  }
});

asistenteRouter.get('/recientes', async (req, res) => {
  try {
    res.json({ success: true, data: await listarRecientes(req.asistenteUsuario.id, 5) });
  } catch (err) {
    responderError(res, err, 'Error listando recientes');
  }
});

asistenteRouter.get('/conversacion/:id', async (req, res) => {
  try {
    const vista = await motor.vistaConversacion(String(req.params.id), req.asistenteUsuario);
    if (!vista) return res.status(404).json({ success: false, error: 'No encontré esa conversación.' });
    res.json({ success: true, data: vista });
  } catch (err) {
    responderError(res, err, 'Error leyendo conversación');
  }
});

asistenteRouter.post('/', limitePreguntas, async (req, res) => {
  const pregunta = typeof req.body?.pregunta === 'string' ? req.body.pregunta.trim() : '';
  const id = typeof req.body?.id === 'string' && req.body.id ? req.body.id : null;
  if (!pregunta || pregunta.length > 2000) {
    return res.status(422).json({ success: false, error: 'Escriba una pregunta de hasta 2.000 caracteres.' });
  }
  let plan;
  try {
    plan = await motor.prepararPregunta({ usuario: req.asistenteUsuario, pregunta, id });
  } catch (err) {
    return responderError(res, err, 'Error preparando la pregunta');
  }
  await transmitir(res, (enviar) => motor.correrPregunta(plan, enviar));
});

asistenteRouter.post('/decision', limitePreguntas, async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : '';
  // Solo `true` explícito aprueba.
  const aprobado = req.body?.aprobado === true;
  const opciones = req.body?.opciones && typeof req.body.opciones === 'object' ? req.body.opciones : {};
  if (!id) return res.status(422).json({ success: false, error: 'Falta la conversación.' });
  let plan;
  try {
    plan = await motor.prepararDecision({ usuario: req.asistenteUsuario, id, aprobado });
  } catch (err) {
    return responderError(res, err, 'Error preparando la decisión');
  }
  await transmitir(res, (enviar) => motor.correrDecision(plan, enviar, opciones));
});

asistenteRouter.get('/topes', requireRole('admin'), async (req, res) => {
  try {
    const [hoy, mes] = await Promise.all([topes.estadoDeHoy(req.asistenteUsuario.id), resumenDelMes()]);
    res.json({
      success: true,
      data: {
        empresaUsd: hoy.empresaUsd,
        usuarioUsd: hoy.usuarioUsd,
        gastoHoyEmpresaUsd: hoy.gastoEmpresaUsd,
        maximoUsd: topes.MAXIMO_USD,
        mes,
        modelo: MODELO,
        tarifaVigenteDesde: TARIFA_VIGENTE_DESDE,
      },
    });
  } catch (err) {
    responderError(res, err, 'Error leyendo topes');
  }
});

asistenteRouter.put('/topes', requireRole('admin'), async (req, res) => {
  try {
    const empresaUsd = Number(req.body?.empresaUsd);
    const usuarioUsd = Number(req.body?.usuarioUsd);
    const error = await topes.guardar({ empresaUsd, usuarioUsd }, req.asistenteUsuario.id);
    if (error) return res.status(422).json({ success: false, error });
    await logAudit(req.asistenteUsuario.id, 'update', 'asistente_topes', 1, { empresaUsd, usuarioUsd });
    res.json({ success: true, data: await topes.leer() });
  } catch (err) {
    responderError(res, err, 'Error guardando topes');
  }
});

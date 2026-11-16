// Catálogo de herramientas de LECTURA del asistente. Ninguna escribe: una
// prueba lo verifica contra una base real (__tests__/lecturas.test.js). Las
// escrituras viven aparte, en ../escrituras/.

import { z } from 'zod';
import { ok, seguro } from './comun.js';
import { buscarEnPanel } from '../buscador.js';
import { consultarPedidos, consultarEnvios, consultarSuscripciones, pendientesDelDia } from './pedidos.js';
import { consultarCrm } from './clientes.js';
import { consultarProduccion, miFinca } from './produccion.js';
import { consultarProductos, consultarInventario } from './catalogo.js';
import { consultarVentas, consultarCostos, consultarFinanzas } from './ventas.js';

export const buscarEnPanelHerramienta = {
  nombre: 'buscar_en_panel',
  descripcion:
    'Busca pantallas del panel y fichas (pedidos, productos, lotes, cuentas) por palabra. Úsela para "¿dónde registro una ' +
    'cosecha?" o "¿dónde veo los envíos?", y para dar el enlace correcto.',
  esquema: z.object({
    texto: z.string().min(2).max(80).describe('Lo que se busca, en pocas palabras.'),
  }),
  roles: ['admin', 'caficultor'],
  ejecutar: seguro('buscar_en_panel', async (a, ctx) => ok({ resultados: await buscarEnPanel(a.texto, ctx.usuario) })),
};

export const HERRAMIENTAS = [
  buscarEnPanelHerramienta,
  pendientesDelDia,
  consultarPedidos,
  consultarEnvios,
  consultarCrm,
  consultarSuscripciones,
  consultarProduccion,
  miFinca,
  consultarInventario,
  consultarProductos,
  consultarVentas,
  consultarCostos,
  consultarFinanzas,
];

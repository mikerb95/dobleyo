// Catálogo de ESCRITURAS del asistente. Todas pasan por la tarjeta de
// aprobación: el bucle pausa al proponerlas y solo se ejecutan tras el clic
// de una persona con el rol que las permite.

import { cambiarEstadoPedido, registrarGuiaManual } from './pedidos.js';
import { ajustarStock, editarProducto } from './catalogo.js';
import { registrarInteraccionCrm, moverEtapaCrm } from './crm.js';
import { almacenarCafeVerde, enviarATostion, recibirTostado, almacenarTostado } from './produccion.js';

export const ESCRITURAS = [
  cambiarEstadoPedido,
  registrarGuiaManual,
  ajustarStock,
  editarProducto,
  registrarInteraccionCrm,
  moverEtapaCrm,
  almacenarCafeVerde,
  enviarATostion,
  recibirTostado,
  almacenarTostado,
];

// Glosario de DobleYo para el asistente del panel: términos del café y reglas
// del negocio, para que entienda cómo habla el equipo ("¿a cómo está la
// carga?", "¿cuánta merma tuvo la maquila?") y responda con las reglas reales.
//
// Todo sale del código o de los documentos del repo, no de suposiciones. Las
// cifras de las políticas se leen de las mismas constantes y variables que usa
// el servidor, para que el glosario no quede desactualizado:
//  - envío: server/services/checkoutShipping.js
//  - suscripciones: server/routes/subscriptions.js (SUBSCRIPTION_DISCOUNT_PERCENT)
//  - contraentrega: server/routes/orders.js (COD_MAX_TOTAL_COP)
// Si cambia una regla allá, se revisa aquí.
//
// El texto va en el system prompt, que se cachea: es estable durante el día.

import { FREE_SHIPPING_FROM_COP, FLAT_SHIPPING_COP } from '../checkoutShipping.js';
import { dinero } from './herramientas/comun.js';

const pesos = (n) => dinero(n).texto;

/** Términos del café y de la producción. Los ven todos los roles. */
export const GLOSARIO_CAFE = `Glosario del café (así habla el equipo de DobleYo):
- Café en cereza: el fruto recién recogido. Pergamino seco: el grano con su cascarilla después de despulpar, fermentar y secar; es lo que cotiza la Federación. Café verde o excelso: el grano ya trillado (sin pergamino), listo para tostar. Pasilla: grano de menor calidad que sale en la selección.
- Trilla: quitar el pergamino al café seco para obtener el verde.
- Carga: unidad de precio de la Federación Nacional de Cafeteros (FNC), 125 kg de pergamino seco. "¿A cómo está la carga?" pregunta por el precio de referencia de la FNC del día.
- Factor de rendimiento: kilos de pergamino seco que se necesitan para sacar un saco de 70 kg de excelso. Cuanto MENOR el factor, mejor rinde el café en la trilla. Si un lote no tiene factor propio se usa el factor base del boletín de la FNC.
- Maquila: la tostión la hace una tostadora externa por un pago; "envío a maquila" es mandar café verde a tostar y "recepción de tostado" es recibirlo de vuelta.
- Merma: peso que se pierde entre etapas. Merma de secado y selección: lo cosechado que no llega a bodega como verde. Merma de tostión: el café pierde agua al tostarse; lo normal es perder menos de un 35 %, y lo tostado siempre pesa menos que lo enviado.
- Nivel de tueste: claro (LIGHT), medio (MEDIUM) u oscuro (DARK).
- Procesos: lavado o húmedo (se despulpa y fermenta antes de secar), natural (se seca en cereza entera) y anaeróbico (fermentación sin oxígeno).
- Variedades que maneja el panel: Caturra, Bourbon, Típica, Geisha y Pacamara.
- Catación (cupping): evaluación de la taza con el protocolo SCA; da un puntaje de 0 a 100. Se registra en /admin/cupping.
- Código de lote: COL-REGIÓN-ALTITUD-VARIEDAD-PROCESO-SUFIJO, por ejemplo COL-HUI-1800-Caturra-Lavado-1A2B (HUI = Huila).
- Etapas de un lote, en orden: cosecha registrada, café verde en almacén (bodega), enviado a tueste (maquila), tostado recibido, tostado en almacén, empacado y etiquetado.
- Presentaciones de empaque: 100 g, 250 g, 500 g y 1 kg. Recipientes de tostado en bodega: bolsa de 1 kg, bolsa de 5 kg, cubeta de 25 kg y saco de 60 kg.
- Ubicaciones de bodega: códigos como GREEN-A-01 (solo café verde) o ROASTED-A-01 (solo tostado). Cada ubicación admite un tipo de café.
- Caficultor: productor dueño de una finca que le vende el café verde a DobleYo. Su parte llega hasta esa venta; de la tostión en adelante es de DobleYo.`;

/** Reglas comerciales y de operación. Solo las ve el admin. */
export function glosarioNegocio(env = process.env) {
  const descuentoSuscripcion = parseInt(env.SUBSCRIPTION_DISCOUNT_PERCENT || '10', 10);
  const topeContraentrega = Number(env.COD_MAX_TOTAL_COP) || 300000;
  return `Reglas del negocio de DobleYo:
- Tienda: vende en Colombia y en pesos colombianos (COP). Hay sitio en español y en inglés (en.dobleyo.cafe, para angloparlantes que viven en Colombia); los dos venden en COP.
- Envío: gratis desde ${pesos(FREE_SHIPPING_FROM_COP)} de compra (después del cupón). Por debajo, se cotiza con Envia.com al municipio del cliente; si no hay cotización se cobra la tarifa fija de ${pesos(FLAT_SHIPPING_COP)}.
- Pagos: la pasarela principal es ePayco y Wompi queda de respaldo. También hay contraentrega, solo en Colombia y hasta ${pesos(topeContraentrega)} por pedido.
- Estados de un pedido: pendiente de pago, pagado, en preparación, enviado, entregado, cancelado y reembolsado. El stock se descuenta cuando el pedido queda pagado; un pedido contraentrega nace "en preparación" y descuenta stock al crearse.
- Suscripciones: café cada 15 o 30 días con ${descuentoSuscripcion} % de descuento. Tras 3 cobros fallidos la suscripción queda en estado de cobro fallido (payment_failed).
- MercadoLibre es otro canal de venta: el inventario del sitio manda y cada ajuste de stock se refleja en las publicaciones. Las publicaciones Full (bodega de MercadoLibre) no se sincronizan.
- Costeo de un lote, por etapa: pago al caficultor, transporte a bodega, transporte a la tostadora, proceso de tostión (maquila), transporte de retorno, empaque y etiqueta. El costo por kilo del verde se calcula con lo que realmente entró a bodega, y el del tostado absorbe la merma de tostión.
- Precio FNC: la Federación publica un boletín diario con el precio de la carga; el panel lo convierte a precio por kilo de excelso para comparar con lo que DobleYo paga.
- CRM (clientes mayoristas): segmentos importador en EE. UU., distribuidor en Colombia, hotel, cafetería, tienda y otro. Etapas del embudo: prospecto, contactado, muestra enviada, negociación, cliente activo y perdido.
- En el sitio público no se muestran todavía la trazabilidad por lote ni las notas de cata: están apagadas a propósito.`;
}

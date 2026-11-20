// Glosario del asistente: cifras sincronizadas con el código, separación por
// rol y convivencia con la guardia de cifras. US$0.

import { describe, it, expect } from 'vitest';
import { GLOSARIO_CAFE, glosarioNegocio } from '../glosario.js';
import { systemPrompt } from '../prompt.js';
import { cifrasPermitidas } from '../motor.js';
import { verificarCifras } from '../guardia.js';
import { FREE_SHIPPING_FROM_COP, FLAT_SHIPPING_COP } from '../../checkoutShipping.js';
import { dinero } from '../herramientas/comun.js';

const RAYA = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);
const admin = { nombre: 'Admin', rol: 'admin', etiquetaRol: 'administrador' };
const caficultor = { nombre: 'Rosa', rol: 'caficultor', etiquetaRol: 'caficultor' };

describe('glosario', () => {
  it('las reglas de envío salen de las constantes del checkout', () => {
    const t = glosarioNegocio({});
    expect(t).toContain(`gratis desde ${dinero(FREE_SHIPPING_FROM_COP).texto}`);
    expect(t).toContain(`tarifa fija de ${dinero(FLAT_SHIPPING_COP).texto}`);
  });

  it('respeta las variables de suscripción y contraentrega', () => {
    const t = glosarioNegocio({ SUBSCRIPTION_DISCOUNT_PERCENT: '15', COD_MAX_TOTAL_COP: '250000' });
    expect(t).toContain('15 % de descuento');
    expect(t).toContain('hasta $250.000 por pedido');
    expect(glosarioNegocio({})).toContain('10 % de descuento');
  });

  it('el caficultor recibe el glosario del café pero no las reglas comerciales', () => {
    const p = systemPrompt('2026-11-19', caficultor, []);
    expect(p).toContain('Factor de rendimiento');
    expect(p).not.toContain('Reglas del negocio de DobleYo');
    expect(p).not.toContain('Envia.com');
  });

  it('el admin recibe los dos', () => {
    const p = systemPrompt('2026-11-19', admin, []);
    expect(p).toContain('Maquila');
    expect(p).toContain('Reglas del negocio de DobleYo');
  });

  it('no tiene rayas ni voseo', () => {
    const texto = `${GLOSARIO_CAFE}\n${glosarioNegocio({})}`;
    expect(texto).not.toMatch(RAYA);
    expect(texto).not.toMatch(/\b(vos|podés|querés|tenés|mirá)\b/i);
  });

  it('la guardia acepta las cifras del glosario del rol, no las de otro rol', () => {
    const respuesta = `El envío es gratis desde ${dinero(FREE_SHIPPING_FROM_COP).texto}.`;
    expect(verificarCifras(respuesta, cifrasPermitidas([], 'admin')).ok).toBe(true);
    expect(verificarCifras(respuesta, cifrasPermitidas([], 'caficultor')).ok).toBe(false);
    expect(verificarCifras('Cuesta $77.777.', cifrasPermitidas([], 'admin')).ok).toBe(false);
  });
});

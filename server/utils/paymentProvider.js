// Pasarela de pagos activa. Módulo puro (solo lee variables de entorno): lo
// importan el servidor y el frontmatter de las páginas Astro.
//
// PAYMENT_PROVIDER=epayco|wompi decide. Si no está definida, se usa ePayco
// cuando sus llaves están cargadas y Wompi en caso contrario, de modo que el
// cambio de pasarela no tumba el checkout mientras se configuran las llaves, y
// volver a Wompi es cambiar una variable.

export const PAYMENT_PROVIDERS = ['epayco', 'wompi'];

export const PAYMENT_PROVIDER_LABEL = { epayco: 'ePayco', wompi: 'Wompi' };

export function activePaymentProvider(env = process.env) {
  const explicit = String(env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (PAYMENT_PROVIDERS.includes(explicit)) return explicit;
  return env.EPAYCO_PUBLIC_KEY && env.EPAYCO_PRIVATE_KEY ? 'epayco' : 'wompi';
}

export function activePaymentProviderLabel(env = process.env) {
  return PAYMENT_PROVIDER_LABEL[activePaymentProvider(env)];
}

/**
 * Mapa de rutas equivalentes ES ↔ EN y construcción de URLs por idioma.
 *
 * Este módulo es ligero (sin diccionarios JSON) para poder importarse tanto
 * en el frontmatter de Astro (SSR) como en los <script> del cliente.
 *
 * En producción los idiomas viven en subdominios distintos:
 *   - ES → dobleyo.cafe
 *   - EN → en.dobleyo.cafe  (vercel.json reescribe /:path → /en/:path)
 * En local / previews de Vercel se usa el prefijo /en sobre el mismo host.
 */

export type Lang = 'es' | 'en';

const APEX = 'dobleyo.cafe';

// Pares de rutas equivalentes [es, en]. Las rutas sin par caen al home del otro idioma.
const ROUTE_PAIRS: Array<[string, string]> = [
  ['/', '/'],
  ['/tienda', '/shop'],
  ['/contacto', '/contact'],
  ['/trazabilidad', '/traceability'],
  ['/mayoristas', '/wholesale'],
  ['/fincas', '/farms'],
  ['/cart', '/cart'],
  ['/checkout', '/checkout'],
  ['/confirmacion', '/confirmation'],
  ['/nosotros', '/about'],
  ['/afiliados', '/affiliates'],
  ['/guias', '/guides'],
  ['/cuenta', '/account'],
  ['/privacidad', '/privacy'],
  ['/terminos', '/terms'],
  ['/envios-devoluciones', '/shipping'],
  ['/accesibilidad', '/accessibility'],
  ['/partners', '/partners'],
  ['/blog', '/blog'],
];

const ES_TO_EN = new Map(ROUTE_PAIRS);
const EN_TO_ES = new Map(ROUTE_PAIRS.map(([es, en]) => [en, es]));

/** Rutas dinámicas que comparten estructura con distinto slug base. */
function dynamicMap(path: string, dir: 'es2en' | 'en2es'): string | null {
  if (dir === 'es2en') {
    const mp = path.match(/^\/producto\/(.+)$/);
    if (mp) return `/product/${mp[1]}`;
    const mf = path.match(/^\/finca\/(.+)$/);
    if (mf) return `/farm/${mf[1]}`;
    const mb = path.match(/^\/blog\/(.+)$/);
    if (mb) return `/blog/${mb[1]}`;
  } else {
    const mp = path.match(/^\/product\/(.+)$/);
    if (mp) return `/producto/${mp[1]}`;
    const mf = path.match(/^\/farm\/(.+)$/);
    if (mf) return `/finca/${mf[1]}`;
    const mb = path.match(/^\/blog\/(.+)$/);
    if (mb) return `/blog/${mb[1]}`;
  }
  return null;
}

function mapEsToEn(path: string): string {
  return ES_TO_EN.get(path) ?? dynamicMap(path, 'es2en') ?? '/';
}

function mapEnToEs(path: string): string {
  return EN_TO_ES.get(path) ?? dynamicMap(path, 'en2es') ?? '/';
}

/** Quita el prefijo /en de una pathname (p.ej. '/en/shop' → '/shop'). */
function stripEnPrefix(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

/**
 * Construye el href hacia un idioma destino a partir de la ubicación actual.
 *
 * @param target       Idioma destino ('es' | 'en')
 * @param currentLang  Idioma de la página actual
 * @param hostname     window.location.hostname / Astro.url.hostname
 * @param pathname     window.location.pathname / Astro.url.pathname
 */
export function buildLangHref(
  target: Lang,
  currentLang: Lang,
  hostname: string,
  pathname: string
): string {
  // Normalizamos la ruta actual a su forma canónica en español.
  const cleanPath = stripEnPrefix(pathname);
  const esCanonical = currentLang === 'en' ? mapEnToEs(cleanPath) : cleanPath;
  const targetPath = target === 'en' ? mapEsToEn(esCanonical) : esCanonical;

  const isProdDomain = hostname === APEX || hostname === `en.${APEX}`;
  if (isProdDomain) {
    const host = target === 'en' ? `en.${APEX}` : APEX;
    return `https://${host}${targetPath}`;
  }

  // Local / preview: prefijo /en sobre el mismo host.
  if (target === 'en') return targetPath === '/' ? '/en' : `/en${targetPath}`;
  return targetPath;
}

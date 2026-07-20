import { rewrite, next } from '@vercel/functions';

const EN_HOST = 'en.dobleyo.cafe';

// El panel admin, la API y los assets no tienen versión /en/ — deben servirse
// tal cual sin importar el subdominio.
const EXCLUDED_PREFIXES = ['/api/', '/assets/', '/_astro/', '/_image', '/admin', '/en/'];

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (request.headers.get('host') !== EN_HOST) {
    return next();
  }

  if (EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return next();
  }

  url.pathname = `/en${url.pathname}`;
  return rewrite(url);
}

export const config = {
  matcher: ['/((?!api/|assets/|_astro/|_image|admin).*)'],
};

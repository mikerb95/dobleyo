import { rewrite, next } from '@vercel/functions';
import { jwtVerify } from 'jose';

const EN_HOST = 'en.dobleyo.cafe';

// El panel admin, la API y los assets no tienen versión /en/: deben servirse
// tal cual sin importar el subdominio.
const EXCLUDED_PREFIXES = ['/api/', '/assets/', '/_astro/', '/_image', '/admin', '/en/'];

// Mismos roles que deja pasar el chequeo de cliente de AdminLayout.
const ADMIN_ROLES = ['admin', 'caficultor'];

// El kanban de iteraciones es documentación pública: vive fuera de /admin.
const MOVED = { '/admin/iteraciones': '/iteraciones' } as Record<string, string>;

// Ingreso al panel (GitHub para admins, enlace a /login para caficultores).
const ADMIN_LOGIN = '/admin/login';

const isAdminPath = (pathname: string) =>
  (pathname === '/admin' || pathname.startsWith('/admin/')) && pathname !== ADMIN_LOGIN;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// Verifica el access token (HS256 con JWT_SECRET, igual que server/auth.js).
// Rechaza tokens de verificación de correo, que llevan `type` y no `role`.
// Sin JWT_SECRET falla cerrado: nadie entra al panel.
async function sessionRole(request: Request): Promise<string | null> {
  const token = readCookie(request, 'auth_token');
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (payload.type) return null;
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (MOVED[pathname]) {
    return Response.redirect(new URL(MOVED[pathname], url), 308);
  }

  // El HTML del panel (menú incluido) no sale sin una sesión válida. Sin token,
  // a /admin/login; con un rol que no es del panel, a la tienda. Ese login (y
  // /login para caficultores) renueva la sesión en silencio antes de pedir
  // credenciales, porque el access token vence a los 15 minutos.
  if (isAdminPath(pathname)) {
    const role = await sessionRole(request);
    if (!role) {
      const login = new URL(ADMIN_LOGIN, url);
      login.searchParams.set('redirect', url.pathname + url.search);
      return Response.redirect(login, 302);
    }
    if (!ADMIN_ROLES.includes(role)) {
      return Response.redirect(new URL('/', url), 302);
    }
    return next();
  }

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
  matcher: ['/((?!api/|assets/|_astro/|_image).*)'],
};

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiters para endpoints críticos de autenticación
 */

// Limiter para login - más estricto (5 intentos por 15 minutos)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos
  message: {
    error: 'Demasiados intentos de login. Por favor, intenta de nuevo en 15 minutos.',
    retryAfter: 900 // segundos
  },
  standardHeaders: true, // Enviar info en headers RateLimit-*
  legacyHeaders: false, // Deshabilitar headers X-RateLimit-*
  skipSuccessfulRequests: false, // Contar todos los intentos
  keyGenerator: ipKeyGenerator
});

// Limiter para registro - moderado (3 registros por hora)
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 registros
  message: {
    error: 'Demasiados intentos de registro. Por favor, intenta de nuevo más tarde.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Solo contar fallos
  keyGenerator: ipKeyGenerator
});

// Limiter para refresh token - detectar uso abusivo
export const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // Máximo 10 refreshes
  message: {
    error: 'Demasiadas solicitudes de refresh. Por favor, espera unos minutos.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator
});

// Limiter general para API - prevenir abuso general
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requests
  message: {
    error: 'Demasiadas solicitudes desde esta IP. Por favor, intenta más tarde.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator
});

// Limiter para el flujo de compra: creación de órdenes y validación de cupones.
// Evita la creación masiva de órdenes 'pending' —bloat de BD, quema de cupones y
// disparo de geocoding externo (Nominatim)— sin estorbar un checkout normal, que
// hace pocas peticiones. Más estricto que el globalLimiter (red amplia).
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Máximo 20 órdenes/validaciones por IP
  message: {
    error: 'Demasiados intentos de compra. Por favor, espere unos minutos e intente de nuevo.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  // En tests el router se monta aislado; el contador en memoria persistiría entre
  // casos y los volvería no deterministas. En producción/dev sí aplica.
  skip: () => process.env.NODE_ENV === 'test',
});

// Limiter global montado en todo /api — red de seguridad contra abuso/scraping.
// Holgado para no romper navegación normal de la SPA (muchos GET por sesión).
// Excluye webhooks server-to-server (Wompi/MercadoPago) y health checks, que no
// deben recibir 429: perder una confirmación de pago o un ping de salud es peor.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600, // Máximo 600 requests por IP
  message: {
    error: 'Demasiadas solicitudes desde esta IP. Por favor, intenta más tarde.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return url.includes('/wompi/webhook') ||
           url.includes('/mp/webhook') ||
           url.endsWith('/health');
  }
});

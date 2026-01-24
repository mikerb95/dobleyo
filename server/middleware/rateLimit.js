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

# Requisitos No Funcionales — DobleYo Café

> Cada requisito tiene ID `RNF-XXX`. Estos definen las cualidades del sistema, no funcionalidades específicas.

---

## 1. Rendimiento

| ID | Requisito | Métrica | Prioridad |
|---|---|---|---|
| RNF-001 | Tiempo de carga inicial (First Contentful Paint) < 2s en conexión 3G | Lighthouse FCP ≤ 2000ms | P1 |
| RNF-002 | Largest Contentful Paint < 3.5s en mobile | Lighthouse LCP ≤ 3500ms | P1 |
| RNF-003 | Cumulative Layout Shift < 0.1 | Lighthouse CLS ≤ 0.1 | P1 |
| RNF-004 | Time to Interactive < 4s en mobile | Lighthouse TTI ≤ 4000ms | P1 |
| RNF-005 | Tiempo de respuesta de API < 500ms para queries simples | p95 latency ≤ 500ms | P1 |
| RNF-006 | Peso total de página inicial < 1.5MB (incluyendo imágenes) | Lighthouse total weight | P2 |
| RNF-007 | Imágenes en formato WebP con lazy loading y srcset responsive | Lighthouse image audit pass | P1 |
| RNF-008 | CSS y JS minificados y comprimidos (gzip/brotli) en producción | Vercel auto-compression | P1 |

---

## 2. Disponibilidad y Confiabilidad

| ID | Requisito | Métrica | Prioridad |
|---|---|---|---|
| RNF-010 | Uptime del sitio ≥ 99.5% mensual | Vercel status / UptimeRobot | P1 |
| RNF-011 | Recuperación ante fallo de BD en < 30 minutos (RPO < 1 hora) | Backup + recovery drill | P1 |
| RNF-012 | Serverless functions tolerantes a cold starts (< 3s warm-up) | Vercel function logs | P2 |
| RNF-013 | Degradación graciosa: si la BD falla, el frontend estático sigue disponible | Astro static output | P2 |
| RNF-014 | Health check endpoint `/api/health` para monitoreo externo | HTTP 200 response | P1 |

---

## 3. Seguridad

| ID | Requisito | Estándar | Prioridad |
|---|---|---|---|
| RNF-020 | HTTPS obligatorio en todos los dominios (dobleyo.cafe, en.dobleyo.cafe) | TLS 1.2+ (Vercel auto) | P1 |
| RNF-021 | Headers HTTP de seguridad: Helmet (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) | OWASP headers | P1 |
| RNF-022 | Contraseñas hasheadas con bcrypt (salt rounds ≥ 10) | bcryptjs implementation | P1 |
| RNF-023 | Tokens JWT con expiración corta (15 min access, 7 días refresh) con rotación | OWASP session | P1 |
| RNF-024 | Rate limiting: 5 intentos login/15min, 3 registros/hora, 100 API calls/15min | express-rate-limit config | P1 |
| RNF-025 | Queries SQL parameterizadas (nunca interpolación de strings) | OWASP SQL injection | P1 |
| RNF-026 | Datos sensibles de pago procesados por Wompi/MercadoPago (PCI DSS compliance delegada) | PCI DSS Level 1 (gateway) | P1 |
| RNF-027 | Dependencias sin vulnerabilidades críticas conocidas | `npm audit` clean | P1 |
| RNF-028 | Secrets exclusivamente en variables de entorno (nunca hardcodeados) | 12-Factor App | P1 |
| RNF-029 | Audit trail de acciones administrativas en tabla `audit_logs` | SOC 2 Type II alignment | P2 |

---

## 4. Usabilidad

| ID | Requisito | Métrica | Prioridad |
|---|---|---|---|
| RNF-030 | Diseño responsive funcional en viewport 320px a 2560px | Manual testing + Lighthouse | P1 |
| RNF-031 | Touch targets mínimo 44px × 44px en dispositivos táctiles | WCAG 2.5.5 | P1 |
| RNF-032 | Formularios con input types correctos para teclado móvil (email, tel, numeric) | HTML5 input types | P1 |
| RNF-033 | Feedback visual en acciones del usuario (loading, success, error states) | Diseño UX | P1 |
| RNF-034 | Navegación consistente en todas las páginas (header, footer idénticos) | Manual audit | P1 |
| RNF-035 | Fuente mínima de 16px para body text (evitar zoom automático en iOS) | CSS audit | P1 |
| RNF-036 | Contraste de color ratio ≥ 4.5:1 (WCAG AA) | Lighthouse accessibility | P1 |
| RNF-037 | Skip to content link para navegación por teclado | WCAG 2.4.1 | P2 |
| RNF-038 | Sistema de temas claro/oscuro funcional y coherente | CSS variables | P3 |

---

## 5. Compatibilidad

| ID | Requisito | Alcance | Prioridad |
|---|---|---|---|
| RNF-040 | Navegadores: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ | Can I Use baseline | P1 |
| RNF-041 | Dispositivos móviles: iOS 15+, Android 10+ | Device lab testing | P1 |
| RNF-042 | Resoluciones: 320px (iPhone SE) a 2560px (4K monitor) | Chrome DevTools emulation | P1 |
| RNF-043 | Impresión: páginas de trazabilidad y confirmación de orden imprimibles | `@media print` | P3 |

---

## 6. SEO y Descubribilidad

| ID | Requisito | Métrica | Prioridad |
|---|---|---|---|
| RNF-050 | Lighthouse SEO score ≥ 90 en todas las páginas públicas | Lighthouse audit | P1 |
| RNF-051 | Sitemap.xml actualizado automáticamente con cada deploy | Astro sitemap plugin | P1 |
| RNF-052 | Structured data válida (Google Rich Results Test sin errores) | Google validation tool | P1 |
| RNF-053 | Meta tags completos: title (50-60 chars), description (120-160 chars), canonical, OG, hreflang | Manual + automated audit | P1 |
| RNF-054 | URLs semánticas y permanentes (no cambiar URLs existentes sin redirect 301) | URL audit | P1 |
| RNF-055 | Core Web Vitals en rango "Good" (verde) para Google Search Console | CWV real user data | P1 |

---

## 7. Internacionalización

| ID | Requisito | Alcance | Prioridad |
|---|---|---|---|
| RNF-060 | Soporte para 2 idiomas: Español (primario) e Inglés | i18n JSON files | P1 |
| RNF-061 | Atributo `lang` correcto en `<html>` por idioma de página | HTML validation | P1 |
| RNF-062 | Formato de moneda localizado: COP (es) / USD (en) con `Intl.NumberFormat` | JavaScript runtime | P1 |
| RNF-063 | Formato de fecha localizado con `Intl.DateTimeFormat` | JavaScript runtime | P2 |
| RNF-064 | `hreflang` tags para indicar alternativas de idioma a motores de búsqueda | SEO audit | P1 |

---

## 8. Mantenibilidad

| ID | Requisito | Práctica | Prioridad |
|---|---|---|---|
| RNF-070 | Código ESM exclusivo (`import`/`export`), nunca CommonJS | Lint rule | P1 |
| RNF-071 | Variables CSS centralizadas, nunca colores/tamaños hardcodeados | CSS audit | P1 |
| RNF-072 | Fuente única de datos: BD para datos dinámicos, un solo archivo para configuración estática | Architecture rule | P1 |
| RNF-073 | Documentación actualizada con cada cambio (CHANGELOG.md + AGENTS.md) | Process rule | P1 |
| RNF-074 | Paridad entre `server/index.js` y `api/index.js` (ambos montan los mismos routers) | Code review rule | P1 |
| RNF-075 | Test coverage: ≥ 60% servicios, ≥ 80% auth routes | Vitest coverage | P2 |
| RNF-076 | Conventional Commits para mensajes de commit | Git hooks | P2 |

---

## 9. Escalabilidad

| ID | Requisito | Consideración | Prioridad |
|---|---|---|---|
| RNF-080 | Connection pooling de BD con máximo 5 conexiones (Vercel serverless) | pg pool config | P1 |
| RNF-081 | Imágenes servidas desde CDN o storage optimizado (no desde servidor Express) | Vercel Edge / Cloudinary | P2 |
| RNF-082 | Consultas SQL con índices apropiados para queries frecuentes | DB index audit | P1 |
| RNF-083 | Sin estado en servidor (stateless) — toda sesión via JWT, no sessions server-side | Architecture constraint | P1 |

---

## 10. Compliance Legal

| ID | Requisito | Norma | Prioridad |
|---|---|---|---|
| RNF-090 | Tratamiento de datos conforme a Ley 1581 de 2012 (Habeas Data Colombia) | Ley colombiana | P1 |
| RNF-091 | Derechos del consumidor conforme a Ley 1480 de 2011 (Estatuto del Consumidor) | Ley colombiana | P1 |
| RNF-092 | Información del vendedor visible según Art. 26 Ley 1480 | Ley colombiana | P1 |
| RNF-093 | Derecho de retracto 5 días hábiles informado en checkout y T&C | Ley colombiana | P1 |
| RNF-094 | Facturación electrónica según normativa DIAN (Resolución 000042/2020) | DIAN Colombia | P2 |
| RNF-095 | Cookies consent banner con opciones de aceptar/rechazar | Ley 1581 + buenas prácticas | P1 |

---

## 11. Observabilidad

| ID | Requisito | Herramienta | Prioridad |
|---|---|---|---|
| RNF-100 | Logs de errores centralizados y accesibles | Vercel Logs / console.error | P1 |
| RNF-101 | Monitoreo de uptime y alertas | UptimeRobot (free tier) | P2 |
| RNF-102 | Analytics de tráfico (privacy-friendly) | Vercel Analytics / Plausible | P2 |
| RNF-103 | Audit logs de acciones admin con usuario, acción, entidad, timestamp | tabla `audit_logs` | P1 |

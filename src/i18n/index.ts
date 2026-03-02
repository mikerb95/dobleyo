/**
 * Sistema de internacionalización (i18n) — DobleYo Café
 * Idiomas soportados: 'es' (español, por defecto) | 'en' (inglés)
 *
 * Uso en frontmatter Astro:
 *   import { t, getLang } from '../../i18n/index.ts';
 *   const lang = getLang(Astro.url);
 *   const title = t('shop.title', lang);
 */

import es from './es.json';
import en from './en.json';

export type Lang = 'es' | 'en';

type TranslationDict = typeof es;

const dictionaries: Record<Lang, TranslationDict> = { es, en };

/**
 * Devuelve el string traducido para una clave dot-notation.
 * Si la clave no existe, devuelve la clave como fallback.
 *
 * @param key   Clave dot-notation, ej: 'shop.title'
 * @param lang  Idioma destino ('es' | 'en'). Por defecto 'es'.
 */
export function t(key: string, lang: Lang = 'es'): string {
    const dict = dictionaries[lang] ?? dictionaries.es;
    const parts = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = dict;
    for (const part of parts) {
        if (value == null || typeof value !== 'object') return key;
        value = value[part];
    }
    if (typeof value === 'string') return value;
    return key;
}

/**
 * Detecta el idioma de la página a partir de la URL.
 * - Rutas que empiezan con /en/ → 'en'
 * - Todo lo demás → 'es'
 */
export function getLang(url: URL): Lang {
    return url.pathname.startsWith('/en/') || url.pathname === '/en' ? 'en' : 'es';
}

/**
 * Formatea un precio según el idioma:
 * - 'es' → COP, es-CO
 * - 'en' → USD, en-US
 */
export function formatPrice(amount: number, lang: Lang = 'es'): string {
    if (lang === 'en') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    }
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Formatea una fecha según el idioma.
 */
export function formatDate(date: Date | string, lang: Lang = 'es'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(d);
}

/**
 * Devuelve la URL canónica de una página.
 * Las páginas /en/* usan en.dobleyo.cafe en producción.
 */
export function getCanonicalUrl(pathname: string, lang: Lang = 'es'): string {
    const base =
        lang === 'en' ? 'https://en.dobleyo.cafe' : 'https://dobleyo.cafe';
    // Para /en/shop → en.dobleyo.cafe/shop (el subdominio ya mapea /en/* → /*)
    const cleanPath =
        lang === 'en' ? pathname.replace(/^\/en/, '') || '/' : pathname;
    return `${base}${cleanPath}`;
}

/**
 * Devuelve el par de URLs alternate hreflang para una página dada su pathname en español.
 * Ej: '/tienda' → { es: 'https://dobleyo.cafe/tienda', en: 'https://en.dobleyo.cafe/shop' }
 *
 * El mapa de equivalencias cubre las páginas con versión en ambos idiomas.
 */
const HREFLANG_MAP: Record<string, string> = {
    '/': '/',
    '/tienda': '/shop',
    '/contacto': '/contact',
    '/trazabilidad': '/traceability',
};

export function getHreflangPair(
    esPath: string
): { es: string; en: string } | null {
    const enPath = HREFLANG_MAP[esPath];
    if (!enPath) return null;
    return {
        es: `https://dobleyo.cafe${esPath}`,
        en: `https://en.dobleyo.cafe${enPath}`,
    };
}

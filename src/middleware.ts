// Middleware de Astro (distinto del middleware.ts de la raíz, que es el de
// enrutamiento de Vercel para el subdominio en.).
//
// Solo lleva el medidor de cómputo (src/lib/medidor.ts, copiado del portafolio
// de codebymike): mide lo que gastan de la cuota de Vercel las páginas que se
// renderizan en el servidor (`prerender = false`) y lo reporta al panel. Las
// prerenderizadas las ignora: se generan en el build, no en cada visita. Sin
// COMPUTO_PROYECTO y COMPUTO_SECRETO no hace nada.
import { medidorDesdeEnv } from './lib/medidor';

export const onRequest = medidorDesdeEnv().astro();

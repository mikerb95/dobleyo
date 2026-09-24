import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://dobleyo.cafe',
  integrations: [react()],
  // `imageService: true` delega la optimización de imágenes al servicio de
  // Vercel en vez de resolverla dentro de la función. Sin esta opción, Astro
  // empaqueta sharp (libvips) en el bundle: 33 MB de los 48 MB que pesaba
  // `_render.func`, y de esos, 17 MB eran la variante `linuxmusl`, un binario
  // que en Vercel (glibc) no se ejecuta nunca. No es peso que se pague una
  // sola vez: Functions Storage guarda una copia por cada deployment retenido,
  // y este proyecto despliega tan poco que la excepción de "los últimos 20 de
  // producción" le ancla la historia entera de forma permanente.
  adapter: vercel({ imageService: true }),
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  },
});

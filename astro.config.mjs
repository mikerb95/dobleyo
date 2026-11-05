import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://dobleyo.cafe',
  integrations: [react()],
  // Astro 7 cambió el valor por defecto a 'jsx', que borra el espacio entre
  // elementos en línea escritos en líneas distintas ("Hola <a>x</a>\n<a>y</a>").
  // El sitio está escrito a mano contando con ese espacio.
  compressHTML: true,
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
    // La CSP pública de vercel.json no permite scripts en línea. Con el límite en
    // 0, Vite emite los <script> de los componentes como archivos en /_astro/ en
    // vez de incrustar los pequeños en el HTML, donde el navegador los bloquea.
    build: { assetsInlineLimit: 0 },
    // Astro usa cookie 2.x (anidado en su node_modules) y Express cookie 0.7 (en
    // la raíz). Si queda externo, el chunk en dist/ resuelve `cookie` desde la
    // raíz, recibe la 0.7 y el build falla por `parseCookie`. Empaquetarlo hace
    // que se resuelva desde Astro, sin depender de cómo npm ordene el árbol.
    // El prerender es un entorno propio de Vite: `ssr.noExternal` no le llega.
    ssr: { noExternal: ['cookie'] },
    environments: {
      prerender: { resolve: { noExternal: ['cookie'] } },
    },
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

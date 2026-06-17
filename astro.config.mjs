import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [react()],
  // imageService: true → usa la optimización de imágenes nativa de Vercel y evita
  // empaquetar sharp (@img/libvips, ~200MB en Linux) en la función SSR, que excedía
  // el límite de 245MB del Lambda.
  adapter: vercel({ imageService: true }),
});

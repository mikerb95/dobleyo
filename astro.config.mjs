import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [react()],
  output: 'hybrid', // Permite mezclar páginas estáticas y SSR
  adapter: vercel(),
});

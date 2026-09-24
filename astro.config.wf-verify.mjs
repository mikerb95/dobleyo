// Temporal: verificación local del flujo guiado contra una BD de prueba. Se borra al terminar.
import base from './astro.config.mjs';
export default { ...base, vite: { ...base.vite, server: { proxy: { '/api': { target: 'http://localhost:4100', changeOrigin: true } } } } };

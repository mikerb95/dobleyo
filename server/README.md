# DobleYo Café - Servidor Node.js

Backend en Node.js/Express que sirve el sitio estático y expone endpoints `/api` para integraciones de pago (Mercado Pago y Wompi) y consulta de órdenes.

## Requisitos
- Node.js 18 o superior (recomendado 20+)
- Windows PowerShell o terminal equivalente

## Configuración
1. Copia `server/.env.example` a `server/.env` y completa las variables según tu entorno.
2. Instala dependencias (ejecuta desde la carpeta `server`):

```
# en PowerShell
npm install
```

## Ejecutar en desarrollo
Desde `server/`:

```
npm run dev
```

El servidor levanta en `http://localhost:4000` por defecto y sirve los archivos estáticos ubicados en la raíz del proyecto (uno arriba de `server/`), por ejemplo `index.html`, `tienda.html`, etc. Los endpoints estarán bajo `/api`.

- Salud: `GET /api/health`
- Crear preferencia MP: `POST /api/mp/create_preference`
- Checkout Wompi: `POST /api/wompi/checkout`
- Webhook MP: `POST /api/mp/webhook`
- Webhook Wompi: `POST /api/wompi/webhook`
- Consultar orden: `GET /api/order/:ref`

## Despliegue (resumen)
- Si usas un hosting con Node.js, define las variables del `.env` como variables de entorno y ejecuta `npm start` en `server/`.
- Asegura HTTPS para webhooks (MP/Wompi requieren URLs públicas seguras).
- Si necesitas proxy (nginx/Apache), redirige tráfico estático al mismo host/puerto o ajusta `SITE_BASE_URL` con la URL pública.

## Notas
- El almacenamiento de órdenes en `src/store.js` es en memoria (solo desarrollo). Para producción, sustituir por base de datos.
- Si el directorio de estáticos cambia, ajusta la ruta en `src/index.js` (`staticDir`).

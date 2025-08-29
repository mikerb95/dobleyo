# DobleYo — Tienda de café de especialidad

Tienda en línea elegante, moderna y acogedora para la marca DobleYo, construida con Next.js (App Router) y Tailwind CSS.

## Requisitos
- Node.js 18+
- Variables de entorno Stripe (para checkout)

Copia `.env.example` a `.env.local` y completa:
- STRIPE_SECRET_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- NEXT_PUBLIC_SITE_URL (por ejemplo: http://localhost:3000)

## Ejecutar localmente
1. Instalar dependencias
2. Levantar servidor de desarrollo

```powershell
npm install
npm run dev
```

Visita http://localhost:3000

## Scripts
- dev: entorno de desarrollo
- build: build de producción
- start: servidor de producción
- lint: ESLint

## Estructura
- src/app: rutas y layout
- src/components: componentes UI
- src/data: datos de productos
- src/lib: utilidades

## Notas
- El checkout usa Stripe Checkout. Si no configuras Stripe, la ruta /api/checkout responderá error.
- Los productos están mockeados en `src/data/products.ts`.
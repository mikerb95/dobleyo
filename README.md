# DobleYo Café - Plataforma de E-commerce

Este repositorio contiene el código fuente para la plataforma de comercio electrónico de **DobleYo Café**, una marca de café de especialidad colombiano. El sistema permite la venta de productos, gestión de inventario, trazabilidad de lotes y administración de contenido.

---

## 📋 Información para Stakeholders

### Descripción del Proyecto

DobleYo Café es una tienda en línea diseñada para ofrecer una experiencia de compra fluida y educativa sobre el café de especialidad. La plataforma no solo facilita la compra de productos, sino que también cuenta la historia detrás de cada grano a través de su módulo de trazabilidad.

### Funcionalidades Principales

- **Catálogo de Productos**: Visualización detallada de cafés, accesorios y otros productos.
- **Carrito de Compras y Checkout**: Proceso de compra integrado con pasarelas de pago (MercadoPago / Wompi).
- **Trazabilidad**: Sección dedicada a mostrar el origen y proceso de cada lote de café.
- **Blog**: Espacio para compartir noticias y cultura cafetera.
- **Panel de Administración**: Herramienta interna para gestionar productos, inventario y ver pedidos.
- **Cuentas de Usuario**: Registro e inicio de sesión para clientes.

---

## 🛠️ Guía para el Equipo de Desarrollo

### Stack Tecnológico

**Frontend:**

- **HTML5**: Estructura semántica.
- **CSS**: TailwindCSS (vía CDN) para estilos rápidos y responsivos.
- **JavaScript**: Vanilla JS (ES6+) para la lógica del cliente.

**Backend:**

- **Runtime**: Node.js.
- **Framework**: Express.js.
- **Seguridad**: Helmet, CORS, Cookie-parser, JWT.

**Base de Datos:**

- **Motor**: PostgreSQL.
- **Driver**: `pg`.

**Servicios Externos:**

- **Pagos**: MercadoPago, Wompi.
- **Email**: Resend.

### Estructura del Proyecto

```
dobleyo/
├── assets/             # Recursos estáticos (CSS, JS del cliente, Imágenes)
│   ├── css/            # Estilos globales
│   ├── js/             # Lógica del frontend (carrito, admin, etc.)
│   └── data/           # Datos estáticos (ej. lotes.json)
├── db/                 # Scripts de base de datos
│   └── schema.sql      # Esquema inicial de la base de datos
├── src/                # Código fuente del Backend
│   ├── routes/         # Definición de rutas de la API
│   ├── services/       # Lógica de negocio y servicios externos
│   ├── index.js        # Punto de entrada del servidor
│   ├── auth.js         # Middleware y lógica de autenticación
│   └── db.js           # Conexión a base de datos
├── *.html              # Vistas del frontend (Páginas)
└── package.json        # Dependencias y scripts del proyecto
```

### Configuración del Entorno Local

#### 1. Prerrequisitos

- Node.js (v20 o superior)
- PostgreSQL instalado y corriendo.

#### 2. Instalación de Dependencias

Navega al directorio del proyecto e instala las dependencias:

```bash
cd dobleyo
npm install
```

> **Nota:** Asegúrate de que las dependencias raíz también estén resueltas si estás trabajando en un entorno monorepo.

#### 3. Variables de Entorno

Crea un archivo `.env` en la raíz de `dobleyo/` basándote en las variables requeridas en `src/index.js`:

```env
# Servidor
PORT=4000
SITE_BASE_URL=http://localhost:4000

# Base de Datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=dobleyo_db
DB_PORT=5432

# Seguridad
JWT_SECRET=tu_secreto_super_seguro

# Pasarelas de Pago
MP_ACCESS_TOKEN=tu_token_mercadopago
WOMPI_PUBLIC_KEY=tu_key_publica
WOMPI_PRIVATE_KEY=tu_key_privada
WOMPI_INTEGRITY_SECRET=tu_secreto_integridad

# Email
RESEND_API_KEY=tu_api_key_resend
```

#### 4. Base de Datos

Ejecuta el script SQL para crear las tablas necesarias:

```bash
psql -U tu_usuario -d dobleyo_db -f db/schema.sql
```

### Ejecución

Para iniciar el servidor en modo desarrollo:

```bash
npm run dev
```

O para producción:

```bash
npm start
```

El servidor estará corriendo en `http://localhost:4000` (o el puerto que hayas configurado).

### Notas Adicionales

- **TailwindCSS**: Se está cargando vía CDN en el `<head>` de los archivos HTML. Para producción, se recomienda configurar un proceso de build para purgar estilos no utilizados.
- **Seguridad**: El backend utiliza `helmet` para headers de seguridad. Si encuentras problemas con scripts externos, revisa la configuración de CSP en `src/index.js`.

# DobleYo Café - Plataforma de E-commerce

Este repositorio contiene el código fuente para la plataforma de comercio electrónico de **DobleYo Café**, una marca de café de especialidad colombiano. El sistema permite la venta de productos, gestión de inventario, trazabilidad de lotes y administración de contenido.

---

## 📋 Información para Stakeholders

### Descripción del Proyecto

DobleYo Café es una tienda en línea diseñada para ofrecer una experiencia de compra fluida y educativa sobre el café de especialidad. La plataforma no solo facilita la compra de productos, sino que también cuenta la historia detrás de cada grano a través de su módulo de trazabilidad.

### Funcionalidades Principales

- **Catálogo de Productos**: Visualización detallada de cafés, accesorios y otros productos.
- **Carrito de Compras y Checkout**: Proceso de compra (métodos de pago próximamente).
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

- **Pagos**: Próximamente.
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
SITE_BASE_URL=https://dobleyo.cafe

# Base de Datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=dobleyo_db
DB_PORT=5432

# Seguridad
JWT_SECRET=tu_secreto_super_seguro

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

El servidor estará corriendo en `https://dobleyo.cafe` (o el puerto que hayas configurado en producción).

### Notas Adicionales

- **TailwindCSS**: Se está cargando vía CDN en el `<head>` de los archivos HTML. Para producción, se recomienda configurar un proceso de build para purgar estilos no utilizados.
- **Seguridad**: El backend utiliza `helmet` para headers de seguridad. Si encuentras problemas con scripts externos, revisa la configuración de CSP en `src/index.js`.

---

## Licencia y derechos de autor

Copyright (c) 2025-2026 Michael David Rodriguez Beltran (codebymike.net), Bogotá D.C., Colombia. **Todos los derechos reservados.**

Software propietario y confidencial. Queda prohibida su reproducción total o parcial, uso, modificación, distribución, ingeniería inversa o uso para entrenar modelos de IA sin autorización previa y por escrito del titular. Ver [`LICENSE`](LICENSE) para los términos completos.

> **Aviso de monitoreo:** este proyecto está bajo monitoreo permanente mediante un agente de IA basado en Claude, que analiza fuentes públicas para detectar despliegues o usos no autorizados del código. Cualquier uso o despliegue sin permiso recibirá un requerimiento formal de cese y desistimiento (*cease and desist*), sin perjuicio de las acciones legales correspondientes.

Contacto: +57 310 464 1228 · mike95@duck.com

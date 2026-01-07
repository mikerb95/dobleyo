# Sistema de Roles - Caficultor

## Overview

DobleYo implementa un sistema de roles con un flujo especial para el rol de **Caficultor**. Todos los usuarios comienzan como `client`, y pueden solicitar el rol de `caficultor` si desean vender sus cosechas a través de la plataforma.

## Flujo de Usuarios

### 1. Registro Inicial (Todos los usuarios)
- Usuario accede a `/registro`
- Completa formulario con: nombre, email, contraseña
- Se crea cuenta con rol `client` por defecto
- Se envía email de verificación
- Usuario verifica email clickeando el link en el correo
- Puede iniciar sesión en `/login`

### 2. Solicitud de Rol Caficultor (Opcional)
- Usuario accede a `/solicitar-caficultor` (requiere estar autenticado)
- Completa formulario con detalles de la finca:
  - Nombre de la finca (obligatorio)
  - Región (obligatorio)
  - Altitud (opcional)
  - Extensión en hectáreas (opcional)
  - Variedades cultivadas (opcional)
  - Certificaciones (opcional)
  - Descripción de la finca (obligatorio)
- Sistema verifica que no tenga solicitud pendiente
- Se crea registro en tabla `caficultor_applications` con status `pending`
- Campo `users.caficultor_status` cambia a `pending`

### 3. Revisión Admin
- Admin accede a dashboard para ver solicitudes pendientes
- Admin revisa detalles de la finca
- Admin puede:
  - **Aprobar**: Usuario recibe rol `caficultor`, status cambia a `approved`
  - **Rechazar**: Usuario mantiene rol `client`, status cambia a `rejected` con motivo

### 4. Estados del Usuario

#### Campo `role` en tabla `users`
- `admin` - Administrador
- `client` - Cliente estándar (puede comprar)
- `provider` - Proveedor externo
- `caficultor` - Productor de café registrado

#### Campo `caficultor_status` en tabla `users`
- `none` - No tiene solicitud (valor por defecto)
- `pending` - Solicitud enviada, en revisión
- `approved` - Solicitud aprobada, es caficultor
- `rejected` - Solicitud rechazada

## Endpoints de API

### Registro e Autenticación

#### `POST /api/auth/register`
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "segura123"
}
```
Response: Usuario creado con rol `client`

#### `GET /api/auth/verify?token=...`
Verifica el email del usuario

#### `POST /api/auth/login`
```json
{
  "email": "juan@example.com",
  "password": "segura123"
}
```

#### `GET /api/auth/me`
Retorna datos del usuario autenticado incluyendo `caficultor_status`

### Solicitudes de Caficultor

#### `POST /api/auth/request-caficultor`
Requiere autenticación. Usuario solicita rol de caficultor.

```json
{
  "farm_name": "Finca La Aurora",
  "region": "Huila",
  "altitude": 1500,
  "hectares": 5.5,
  "varieties_cultivated": "Geisha, Bourbon, Typica",
  "certifications": "Orgánico, Fair Trade",
  "description": "Finca familiar con 30 años de tradición..."
}
```

Response:
```json
{
  "message": "Solicitud enviada...",
  "application_id": 1
}
```

#### `GET /api/auth/caficultor-status`
Requiere autenticación. Usuario consulta el estado de su solicitud.

Response:
```json
{
  "hasApplication": true,
  "application": {
    "id": 1,
    "status": "pending",
    "admin_notes": null,
    "reviewed_at": null
  }
}
```

### Admin - Gestión de Solicitudes

#### `GET /api/caficultor/applications`
Requiere rol `admin`. Lista todas las solicitudes.

Response:
```json
{
  "applications": [
    {
      "id": 1,
      "user_id": 10,
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "farm_name": "Finca La Aurora",
      "region": "Huila",
      "altitude": 1500,
      "status": "pending",
      "created_at": "2026-01-07T10:30:00Z"
    }
  ]
}
```

#### `GET /api/caficultor/applications/:id`
Requiere rol `admin`. Detalle de una solicitud específica.

#### `POST /api/caficultor/applications/:id/approve`
Requiere rol `admin`. Aprueba la solicitud de caficultor.

```json
{
  "notes": "Bienvenido a DobleYo"
}
```

Resultado:
- Usuario obtiene rol `caficultor`
- `caficultor_status` pasa a `approved`
- Aplicación queda con status `approved`

#### `POST /api/caficultor/applications/:id/reject`
Requiere rol `admin`. Rechaza la solicitud.

```json
{
  "reason": "No cumple con certificaciones requeridas"
}
```

Resultado:
- Usuario mantiene rol `client`
- `caficultor_status` pasa a `rejected`
- Aplicación queda con status `rejected` con el motivo

## Base de Datos

### Tabla `users` (cambios)
```sql
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'client', 'provider', 'caficultor');
ALTER TABLE users ADD COLUMN caficultor_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none';
ALTER TABLE users ADD INDEX idx_users_caficultor_status ON caficultor_status;
```

### Tabla `caficultor_applications` (nueva)
```sql
CREATE TABLE caficultor_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    farm_name VARCHAR(160) NOT NULL,
    region VARCHAR(80) NOT NULL,
    altitude INT,
    hectares DECIMAL(10,2),
    varieties_cultivated TEXT,
    certifications TEXT,
    description TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_caficultor_apps_user ON caficultor_applications(user_id);
CREATE INDEX idx_caficultor_apps_status ON caficultor_applications(status);
```

## Páginas Públicas

### `/registro` - Registro de Usuarios
- Acceso público
- Formulario: nombre, email, contraseña, confirmar contraseña
- Crea usuario con rol `client`
- Redirecciona a login después del éxito

### `/login` - Iniciar Sesión
- Acceso público
- Formulario: email, contraseña
- Link para ir a registro si no tiene cuenta
- Redirecciona a `/cuenta` después del éxito

### `/solicitar-caficultor` - Solicitud de Caficultor
- Requiere estar autenticado (redirecciona a login si no)
- Formulario con detalles de la finca
- Validación: no permite múltiples solicitudes pendientes
- Redirecciona a `/cuenta` después del envío

### `/cuenta` - Perfil de Usuario
- Requiere estar autenticado
- Muestra datos del usuario
- **Próxima fase**: Agregar sección para ver estado de solicitud de caficultor
- **Próxima fase**: Link a `/solicitar-caficultor` si el usuario es `client`

## Flujo de Integración en Frontend (Próximas Fases)

### En `/cuenta`:
```javascript
// Obtener datos del usuario
const user = await fetch('/api/auth/me').then(r => r.json());

// Mostrar botón "Solicitar Rol de Caficultor" si es client
if (user.role === 'client' && user.caficultor_status === 'none') {
  showButton("Solicitar Rol de Caficultor", "/solicitar-caficultor");
}

// Mostrar estado si tiene solicitud
if (user.caficultor_status !== 'none') {
  const status = await fetch('/api/auth/caficultor-status').then(r => r.json());
  if (status.hasApplication) {
    showStatus(status.application);
  }
}
```

## Testing

### Test 1: Flujo Completo de Registro a Caficultor
```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"123456"}'

# 2. Verificar email (en producción, usar link del email)
# Usar token del email o generar manualmente para testing

# 3. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' \
  -c cookies.txt

# 4. Solicitar caficultor
curl -X POST http://localhost:3000/api/auth/request-caficultor \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "farm_name":"Test Farm",
    "region":"Huila",
    "description":"Test farm"
  }'

# 5. Ver estado (como usuario)
curl http://localhost:3000/api/auth/caficultor-status \
  -b cookies.txt

# 6. Ver solicitudes (como admin)
curl http://localhost:3000/api/caficultor/applications \
  -b admin_cookies.txt

# 7. Aprobar solicitud (como admin)
curl -X POST http://localhost:3000/api/caficultor/applications/1/approve \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{"notes":"Welcome!"}'
```

## Notas de Seguridad

1. **Rate Limiting**: Endpoints de registro y login tienen rate limiting
2. **Validación**: Todas las solicitudes validadas con `express-validator`
3. **Autenticación**: Endpoints admin requieren rol `admin` explícitamente
4. **Auditoría**: Todas las acciones se registran en `audit_logs`
5. **Email**: Verificación de email requerida antes de poder acceder
6. **Cookies HttpOnly**: Tokens almacenados en cookies HttpOnly seguras

## Próximas Fases

1. **Dashboard Admin de Caficultor**
   - Página para ver todas las solicitudes
   - Interfaz para aprobar/rechazar
   - Filtros por estado, región, fecha

2. **Notificaciones por Email**
   - Email cuando solicitud sea aprobada
   - Email cuando solicitud sea rechazada con motivo
   - Email de bienvenida a caficultor

3. **Perfil Público de Caficultor**
   - Página pública mostrando caficultores registrados
   - Detalles de la finca (región, altitud, variedades)
   - Sistema de reseñas/ratings

4. **Marketplace de Lotes**
   - Caficultores pueden listar sus lotes
   - Precios desde el agricultor
   - Sistema de órdenes directas

5. **Analytics**
   - Dashboard para caficultor viendo sus ventas
   - Reportes de ingresos
   - Historial de lotes vendidos

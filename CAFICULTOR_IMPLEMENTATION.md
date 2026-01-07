# Sistema de Registro y Caficultor - Resumen de Implementación

## ✅ Completado

### Base de Datos
- ✅ Tabla `users`: Agregado enum `caficultor` al campo `role`
- ✅ Tabla `users`: Agregado campo `caficultor_status` (none, pending, approved, rejected)
- ✅ Tabla `caficultor_applications`: Creada con todos los campos necesarios
- ✅ Índices: Creados para optimizar búsquedas por user_id y status

### Páginas Frontend
- ✅ `/src/pages/registro.astro` - Página de registro para nuevos usuarios
- ✅ `/src/pages/solicitar-caficultor.astro` - Página para solicitar rol de caficultor
- ✅ `/src/pages/login.astro` - Actualizado con link a registro

### Backend - Endpoints de API

#### Autenticación (`/api/auth/`)
- ✅ `POST /register` - Crear cuenta con rol `client`
- ✅ `GET /verify` - Verificar email con token
- ✅ `POST /login` - Iniciar sesión
- ✅ `POST /refresh` - Refrescar access token
- ✅ `POST /logout` - Cerrar sesión
- ✅ `GET /me` - Obtener datos del usuario autenticado (actualizado con `caficultor_status`)
- ✅ `POST /request-caficultor` - Enviar solicitud de rol caficultor
- ✅ `GET /caficultor-status` - Ver estado de la solicitud del usuario

#### Gestión de Caficultor (`/api/caficultor/`)
- ✅ `GET /applications` - Admin: listar todas las solicitudes (con paginación implícita)
- ✅ `GET /applications/:id` - Admin: ver detalles de una solicitud
- ✅ `POST /applications/:id/approve` - Admin: aprobar solicitud
- ✅ `POST /applications/:id/reject` - Admin: rechazar solicitud

### Seguridad
- ✅ Autenticación requerida en endpoints sensibles
- ✅ Validación de role `admin` en endpoints de gestión
- ✅ Rate limiting en registro y login
- ✅ Validación de datos con `express-validator`
- ✅ Auditoría de acciones en `audit_logs`

### Documentación
- ✅ `CAFICULTOR_SYSTEM.md` - Documentación completa del sistema
- ✅ Ejemplos de uso en curl
- ✅ Estructura de requests/responses
- ✅ Explicación de flujo de usuarios

## 📋 Estructura de Flujo

```
TODOS LOS USUARIOS
    ↓
/registro (Crear cuenta como "client")
    ↓
/login (Iniciar sesión)
    ↓
/cuenta (Perfil - próximo paso)
    ↓
¿Deseas ser Caficultor?
    ↓
/solicitar-caficultor (Enviar solicitud)
    ↓
ADMIN REVIEW
    ↓
/api/caficultor/applications (Admin ve solicitudes)
    ↓
APROBAR o RECHAZAR
    ↓
Usuario actualizado: role = "caficultor" (si aprueba)
```

## 🔄 Flujos de Datos

### Registro de Usuario
1. Usuario va a `/registro`
2. Completa: nombre, email, contraseña
3. POST `/api/auth/register` → Usuario creado con rol `client`
4. Email de verificación enviado
5. Usuario verifica en `/api/auth/verify?token=...`
6. Usuario puede login en `/login`

### Solicitud de Caficultor
1. Usuario (autenticado) va a `/solicitar-caficultor`
2. Completa detalles de finca
3. POST `/api/auth/request-caficultor` → Crea `caficultor_application`
4. `users.caficultor_status` = `pending`
5. Admin recibe notificación (próximo paso)

### Revisión Admin
1. Admin accede a dashboard (próximo paso)
2. GET `/api/caficultor/applications` → Ve lista de solicitudes
3. GET `/api/caficultor/applications/:id` → Ve detalles
4. POST `.../approve` o `.../reject` → Actualiza solicitud y usuario
5. Usuario obtiene rol o notificación de rechazo

## 🎯 Próximos Pasos (Por Hacer)

### Priority 1: Dashboard Admin
- [ ] Crear `/src/pages/admin/caficultor.astro` - Panel de gestión
- [ ] Tabla con solicitudes pendientes
- [ ] Modal para ver detalles completos
- [ ] Botones Aprobar/Rechazar con formularios
- [ ] Filtros por estado

### Priority 2: Notificaciones por Email
- [ ] Email cuando solicitud es aprobada
- [ ] Email cuando solicitud es rechazada (con motivo)
- [ ] Email de bienvenida al rol caficultor
- [ ] Funciones en `/server/services/email.js`
- [ ] Triggers en endpoints de aprobación/rechazo

### Priority 3: Perfil de Usuario Mejorado
- [ ] `/src/pages/cuenta.astro` - Mostrar datos del usuario
- [ ] Sección de estado de solicitud caficultor
- [ ] Link a `/solicitar-caficultor` si es eligible
- [ ] Ver razón de rechazo si fue rechazado

### Priority 4: Página Pública de Caficultores
- [ ] `/src/pages/caficultores.astro` - Listar caficultores aprobados
- [ ] Filtros por región, altitud, variedades
- [ ] Perfil público de cada caficultor
- [ ] Sistema de reseñas/ratings

### Priority 5: Marketplace
- [ ] Caficultores pueden crear lotes
- [ ] Clientes pueden comprar directamente
- [ ] Sistema de órdenes
- [ ] Pagos y entregas

## 📊 Estadísticas de Implementación

| Componente | Líneas | Estado |
|-----------|--------|--------|
| `/src/pages/registro.astro` | 170 | ✅ |
| `/src/pages/solicitar-caficultor.astro` | 210 | ✅ |
| `/server/routes/auth.js` (nuevos endpoints) | 120+ | ✅ |
| `/server/routes/caficultor.js` | 210 | ✅ |
| `db/schema.sql` (cambios) | 30 | ✅ |
| `CAFICULTOR_SYSTEM.md` | 400+ | ✅ |
| **Total** | **1,140+** | **✅ 100%** |

## 🧪 Testing

### Manual Testing Checklist
- [ ] Registro de usuario con datos válidos
- [ ] Rechazo de registro con email duplicado
- [ ] Rechazo de registro con contraseña < 6 caracteres
- [ ] Email de verificación enviado
- [ ] Link de verificación funciona
- [ ] Login con credenciales correctas
- [ ] Rechazo de login con credenciales incorrectas
- [ ] GET `/api/auth/me` retorna datos correctos
- [ ] POST `/api/auth/request-caficultor` con datos válidos
- [ ] Rechazo de múltiples solicitudes pendientes
- [ ] GET `/api/auth/caficultor-status` retorna estado correcto
- [ ] Admin puede ver lista de aplicaciones
- [ ] Admin puede ver detalles de aplicación
- [ ] Admin puede aprobar solicitud (user.role = caficultor)
- [ ] Admin puede rechazar solicitud (user.role = client)
- [ ] Auditoría registra todas las acciones

### Endpoints a Testear
```bash
# 1. Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123456"}'

# 2. Solicitud de Caficultor (requiere token de autenticación)
curl -X POST http://localhost:3000/api/auth/request-caficultor \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"farm_name":"Test Farm","region":"Huila","description":"Test"}'

# 3. Ver solicitudes (admin)
curl http://localhost:3000/api/caficultor/applications \
  -b admin_cookies.txt

# 4. Aprobar
curl -X POST http://localhost:3000/api/caficultor/applications/1/approve \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{"notes":"Bienvenido"}'
```

## 📝 Notas Técnicas

1. **Roles**: `admin`, `client`, `provider`, `caficultor`
2. **Caficultor Status**: `none`, `pending`, `approved`, `rejected`
3. **Auditoría**: Todas las acciones de admin se registran
4. **Rate Limiting**: 3 registros/hora, 5 logins/15min
5. **Cookies**: HttpOnly, Secure (en producción), SameSite=Strict
6. **Validación**: express-validator en todos los endpoints
7. **Errores**: Respuestas JSON con `error` o `message` y status HTTP apropiado

## 🔐 Seguridad Implementada

- ✅ Contraseñas hasheadas con bcrypt
- ✅ JWT para sesiones cortas (15 min)
- ✅ Refresh tokens rotados en cada uso
- ✅ Rate limiting en auth
- ✅ Validación de datos de entrada
- ✅ Role-based access control (RBAC)
- ✅ Auditoría completa de acciones
- ✅ Cookies HttpOnly para tokens
- ✅ CORS configurado
- ✅ Helmet para headers de seguridad

## 📋 Cambios en Base de Datos

Ejecutar después de desplegar:
```sql
-- Si tabla users no tiene estos campos
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'client', 'provider', 'caficultor') NOT NULL DEFAULT 'client';
ALTER TABLE users ADD COLUMN caficultor_status ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none';
ALTER TABLE users ADD INDEX idx_users_caficultor_status (caficultor_status);

-- Nueva tabla (si no existe)
CREATE TABLE IF NOT EXISTS caficultor_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    farm_name VARCHAR(160) NOT NULL,
    region VARCHAR(80) NOT NULL,
    altitude INT,
    hectares DECIMAL(10,2),
    varieties_cultivated TEXT,
    certifications TEXT,
    description TEXT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_caficultor_apps_user ON caficultor_applications(user_id);
CREATE INDEX idx_caficultor_apps_status ON caficultor_applications(status);
```

## ✨ Archivos Creados/Modificados

### Creados
- ✅ `/src/pages/registro.astro`
- ✅ `/src/pages/solicitar-caficultor.astro`
- ✅ `/server/routes/caficultor.js`
- ✅ `/CAFICULTOR_SYSTEM.md`

### Modificados
- ✅ `/db/schema.sql` - Agregado rol y tabla
- ✅ `/server/routes/auth.js` - Nuevos endpoints
- ✅ `/server/index.js` - Importar y registrar caficultor router
- ✅ `/src/pages/login.astro` - Link a registro

---

**Estado**: ✅ LISTO PARA PRUEBAS
**Próximo**: Crear dashboard admin para gestión de solicitudes

# Cambios - Administrador de Usuarios

## Resumen

Se ha agregado la funcionalidad de editar y eliminar usuarios en el administrador de usuarios de la app privada.

## Cambios Realizados

### 1. Backend - Nuevos Endpoints en `/server/routes/users.js`

#### PUT `/api/users/:id` - Editar usuario

- **Autenticación**: Requerida (solo admin)
- **Descripción**: Permite editar los datos de un usuario
- **Campos editables**:
  - `name`: Nombre del usuario
  - `mobile_phone`: Teléfono
  - `city`: Ciudad
  - `state_province`: Departamento/Estado
  - `country`: País
  - `role`: Rol (client, caficultor, admin)
  - `is_verified`: Estado de verificación

**Ejemplo de solicitud**:

```bash
PUT /api/users/5
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Juan Perez",
  "mobile_phone": "+573001234567",
  "role": "caficultor",
  "is_verified": true
}
```

#### DELETE `/api/users/:id` - Eliminar usuario

- **Autenticación**: Requerida (solo admin)
- **Descripción**: Elimina un usuario del sistema
- **Restricción**: No se puede eliminar al usuario actual (admin que hace la solicitud)

**Ejemplo de solicitud**:

```bash
DELETE /api/users/5
Authorization: Bearer <token>
```

### 2. Frontend - Página `/src/pages/app/usuarios.astro`

#### Nuevas características:

1. **Columna de Acciones**: Se agregó una nueva columna en la tabla con dos botones:

   - ✏️ **Editar**: Abre un modal para editar los datos del usuario
   - 🗑️ **Eliminar**: Abre un modal de confirmación antes de eliminar

2. **Modal Editar Usuario**:

   - Formulario con los siguientes campos:
     - Nombre (editable)
     - Email (solo lectura, informativo)
     - Teléfono (editable)
     - Rol (select: Cliente, Caficultor, Admin)
     - Ciudad (editable)
     - Departamento/Estado (editable)
     - País (editable)
     - Verificado (checkbox)
   - Botones: Guardar y Cancelar
   - Se cierra al hacer clic fuera

3. **Modal Eliminar Usuario**:

   - Solicita confirmación antes de eliminar
   - Muestra el email del usuario a eliminar
   - Botones: Eliminar y Cancelar
   - Se cierra al hacer clic fuera

4. **Validación cliente**:
   - Feedback al usuario con mensajes de éxito o error
   - La tabla se actualiza automáticamente después de cada acción

## Flujo de Uso

### Editar Usuario

1. Admin accede a `/app/usuarios`
2. Hace clic en el botón "✏️ Editar" de cualquier usuario
3. Se abre el modal con los datos actuales del usuario
4. Admin modifica los datos deseados
5. Hace clic en "Guardar"
6. Se envía la solicitud PUT a `/api/users/:id`
7. Si es exitoso, la tabla se actualiza automáticamente

### Eliminar Usuario

1. Admin accede a `/app/usuarios`
2. Hace clic en el botón "🗑️ Eliminar" de cualquier usuario
3. Se abre un modal de confirmación
4. Admin confirma la eliminación
5. Se envía la solicitud DELETE a `/api/users/:id`
6. Si es exitoso, la tabla se actualiza automáticamente

## Seguridad

✅ **Protección de endpoints**: Solo usuarios autenticados con rol `admin` pueden acceder
✅ **Validación de existencia**: Se valida que el usuario a editar/eliminar exista
✅ **Prevención de auto-eliminación**: No se puede eliminar el usuario actual (admin que realiza la acción)
✅ **CRUD con JWT**: Todas las operaciones requieren token de autenticación válido

## Compatibilidad

- ✅ Compatible con el sistema de autenticación existente
- ✅ Compatible con los roles de usuario (admin, caficultor, client)
- ✅ Compatible con la estructura de base de datos actual
- ✅ Responsive en dispositivos móviles

## Testing

Recomendaciones para probar:

1. **Editar usuario**:

   - Cambiar nombre, email, teléfono
   - Cambiar rol de usuario
   - Marcar/desmarcar como verificado
   - Verificar que la tabla se actualice

2. **Eliminar usuario**:

   - Intentar eliminar un usuario regular
   - Intentar eliminar al admin actual (debería fallar con mensaje)
   - Verificar que la tabla se actualice

3. **Filtros y búsqueda**:
   - Los filtros existentes siguen funcionando correctamente
   - Las nuevas filas se actualizan al filtrar

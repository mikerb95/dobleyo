# ✅ FIXES REALIZADOS - 5 de Enero 2026

## 🎯 Problema Identificado

Tu proyecto en **Vercel** + **Aiven MySQL** tenía queries con placeholders PostgreSQL (`$1, $2, $3`) en lugar de MySQL (`?`).

## ✅ Cambios Realizados

### 1. **server/routes/auth.js** - 6 queries corregidas

- ✅ `INSERT INTO refresh_tokens` - `$1, $2, $3` → `?, ?, ?`
- ✅ `UPDATE users SET last_login_at` - `$1` → `?`
- ✅ `SELECT FROM refresh_tokens JOIN users` - `$1` → `?`
- ✅ `UPDATE refresh_tokens` (token rotation) - `$1, $2` → `?, ?`
- ✅ `INSERT INTO refresh_tokens` (token rotation) - `$1, $2, $3` → `?, ?, ?`
- ✅ `UPDATE refresh_tokens` (logout) - `$1` → `?`
- ✅ `SELECT FROM users` (/me endpoint) - `$1` → `?`

### 2. **.env.example** - Actualizado con variables críticas

- ✅ Agregado `DATABASE_URL` para Aiven
- ✅ Agregado `JWT_SECRET` y `JWT_REFRESH_SECRET`
- ✅ Agregado `NODE_ENV`, `RESEND_API_KEY`, `EMAIL_FROM`

### 3. **.env** - Creado con template local

- ✅ Variables de desarrollo configuradas
- ✅ Instrucciones de dónde obtener `DATABASE_URL`

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### **PASO 1: Obtener `DATABASE_URL` de Aiven**

1. Ve a https://console.aiven.io
2. Selecciona tu proyecto MySQL DobleYo
3. Copia la URL de conexión (similar a: `mysql://user:pass@host:port/db`)
4. Pégala en tu archivo `.env` (line: `DATABASE_URL=...`)

### **PASO 2: Configurar JWT Secrets en Vercel**

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   ```
   JWT_SECRET = [genera una cadena aleatoria fuerte]
   JWT_REFRESH_SECRET = [genera otra cadena aleatoria fuerte]
   DATABASE_URL = [la URL de Aiven]
   ```

### **PASO 3: Upgrade de Node.js (LOCAL)**

Tu sistema tiene Node 18, pero el proyecto requiere Node 20+

```bash
nvm install 20
nvm use 20
```

### **PASO 4: Arreglar vulnerabilidades**

```bash
npm audit fix
```

### **PASO 5: Test local de auth**

```bash
# En local, con DATABASE_URL correcto:
npm run dev
# Luego testa: POST /api/auth/register
```

### **PASO 6: Desplegar a Vercel**

```bash
git add .
git commit -m "Fix: Convert PostgreSQL placeholders to MySQL syntax"
git push
```

---

## ⚠️ PROBLEMAS QUE AÚN REQUIEREN ATENCIÓN

### **Altos**

- [ ] **Refresh tokens sin hashear** - Guardarlos como hash en DB (seguridad)
- [ ] **Sin rate limiting** - Agregar `express-rate-limit` en login/register
- [ ] **Admin panel sin protección** - Requiere `authenticateToken + requireRole('admin')`
- [ ] **Sin transacciones de BD** - Órdenes incompletas si algo falla

### **Medianos**

- [x] **Mercado Pago / Wompi removidos**
- [ ] **Email verification no bloqueante** - Usuario no verificado puede comprar
- [ ] **Sin logging centralizado** - Agregar Winston/Pino
- [ ] **Arquitectura confusa** - Mezcla de HTML vanilla + Astro

### **Tests**

```bash
# Testear después de deploy
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Debería retornar: 201 con mensaje de verificación de email
```

---

## 📋 CHECKLIST FINAL

- [x] Placeholders MySQL corregidos
- [x] Variables de entorno documentadas
- [x] .env creado con template
- [ ] DATABASE_URL de Aiven obtenido
- [ ] JWT secrets generados en Vercel
- [ ] Node.js actualizado a v20+
- [ ] `npm audit fix` ejecutado
- [ ] Tests de auth pasando
- [ ] Mercado Pago integrado
- [ ] Rate limiting implementado
- [ ] Refresh tokens hasheados

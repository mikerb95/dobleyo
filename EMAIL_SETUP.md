# Guía de Integración de Emails con Resend

## Configuración

### 1. Variables de Entorno (.env)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@dobleyo.cafe
RESEND_FROM_NAME=DobleYo Café
ADMIN_EMAIL=admin@dobleyo.cafe
```

### 2. Instalar Resend

```bash
npm install resend
```

## Endpoints Disponibles

### 1. Confirmación de Cuenta

**POST** `/api/emails/account-confirmation`

**Body:**
```json
{
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "confirmationToken": "token_generado_aqui"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de confirmación enviado"
}
```

**Uso:** Envía un email cuando el usuario se registra.

---

### 2. Confirmación de Pedido

**POST** `/api/emails/order-confirmation`

**Body:**
```json
{
  "email": "cliente@example.com",
  "customerName": "María González",
  "orderId": "ORD-20250107-001",
  "items": [
    {
      "name": "Café Especial Huila 250g",
      "quantity": 2,
      "price": 45000
    },
    {
      "name": "Prensa Francesa",
      "quantity": 1,
      "price": 120000
    }
  ],
  "subtotal": 210000,
  "shipping": 15000,
  "total": 225000,
  "shippingAddress": "Calle 50 #10-20, Bogotá, Colombia"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de confirmación de pedido enviado"
}
```

**Uso:** Envía un email cuando un cliente realiza una compra.

---

### 3. Contacto (Mensaje al Admin)

**POST** `/api/emails/contact`

**Body:**
```json
{
  "name": "Carlos López",
  "email": "carlos@example.com",
  "phone": "+573001234567",
  "subject": "Consulta sobre café premium",
  "message": "Hola, me gustaría saber más sobre vuestros cafés especiales...",
  "ip": "192.168.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensaje de contacto enviado al administrador"
}
```

**Uso:** Cuando alguien llena el formulario de contacto en tu sitio.

---

### 4. Respuesta a Contacto

**POST** `/api/emails/contact-reply`

**Body:**
```json
{
  "email": "carlos@example.com",
  "clientName": "Carlos",
  "message": "Hola Carlos,\n\nGracias por tu consulta. Nuestros cafés especiales están disponibles en...\n\nSaludos,\nEquipo DobleYo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email de respuesta enviado al cliente"
}
```

**Uso:** Cuando el administrador responde a un mensaje de contacto.

---

### 5. Estado del Servicio

**GET** `/api/emails/health`

**Response:**
```json
{
  "status": "ok",
  "resendConfigured": true,
  "fromEmail": "noreply@dobleyo.cafe"
}
```

---

## Ejemplos de Integración en Frontend

### Registrar usuario y enviar email de confirmación

```javascript
async function registerUser(email, name, password) {
  // 1. Registrar usuario en tu BD
  const userResponse = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password })
  });

  const user = await userResponse.json();

  // 2. Enviar email de confirmación
  await fetch('/api/emails/account-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      name: user.name,
      confirmationToken: user.confirmationToken
    })
  });

  return user;
}
```

### Enviar confirmación de pedido

```javascript
async function completeOrder(orderData) {
  // 1. Guardar pedido en BD
  const orderResponse = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });

  const order = await orderResponse.json();

  // 2. Enviar email de confirmación
  await fetch('/api/emails/order-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: orderData.customerEmail,
      customerName: orderData.customerName,
      orderId: order.id,
      items: orderData.items,
      subtotal: orderData.subtotal,
      shipping: orderData.shipping,
      total: orderData.total,
      shippingAddress: orderData.address
    })
  });

  return order;
}
```

### Enviar mensaje de contacto

```javascript
async function submitContact(formData) {
  const response = await fetch('/api/emails/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      subject: formData.subject,
      message: formData.message
    })
  });

  const result = await response.json();
  
  if (result.success) {
    alert('✅ Tu mensaje ha sido enviado. Nos pondremos en contacto pronto.');
  } else {
    alert('❌ Error al enviar el mensaje.');
  }

  return result;
}
```

---

## Plantillas de Email

Todos los emails incluyen:
- ☕ Branding de DobleYo (colores: #251a14, #c67b4e, #f7f3ef)
- Responsive design (funciona en móvil, tablet, desktop)
- Información clara y estructurada
- Links y CTAs prominentes
- Footer con copyright

---

## Troubleshooting

### "Error: RESEND_API_KEY no configurada"
- Verifica que tu `.env` tiene la API key de Resend
- La API key debe comenzar con `re_`

### "Error: Dominio no verificado"
- Ingresa a tu dashboard de Resend
- Agrega tu dominio `dobleyo.cafe`
- Configura los registros DNS que Resend te proporciona
- Espera a que se verifique (puede tomar 24-48 horas)

### "Email se envía pero no llega a la bandeja de entrada"
- Verifica que el dominio está verificado en Resend
- Revisa la carpeta de spam
- Confirma que el email del destinatario es correcto

---

## Próximos Pasos

1. ✅ Configurar Resend con tu dominio
2. ✅ Agregar variables de entorno
3. ✅ Instalar el paquete `resend`
4. ✅ Integraciones en endpoints de registro, checkout, contacto
5. ⚠️ Probar en desarrollo con tu email
6. ⚠️ Verificar dominio en producción

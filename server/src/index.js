import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import mercadopago from 'mercadopago';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';

const app = express();
app.use(cors());
app.use(express.json());
// servir sitio estatico para tener mismo origen que /api
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '../../static-site');
app.use(express.static(staticDir));

// Configuracion de Mercado Pago
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
if (MP_ACCESS_TOKEN){ mercadopago.configure({ access_token: MP_ACCESS_TOKEN }); }

// Configuracion de Wompi
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const WOMPI_BASE = process.env.WOMPI_ENV === 'prod' ? 'https://production.wompi.co' : 'https://sandbox.wompi.co';

// Util: firma Wompi segun documentacion (hash sha256 de referencia + monto + moneda + integridad)
import crypto from 'crypto';
function wompiIntegrity({ reference, amountInCents, currency, integritySecret }){
  const str = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

app.post('/api/mp/create_preference', async (req, res) => {
  try {
    if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    const { items = [], reference = 'order-'+Date.now(), shipping = {}, total = 0 } = req.body || {};
    // guardar orden preliminar
    store.setOrder(reference, { provider:'mercadopago', status:'created', items, total, shipping });
    const preference = {
      items: items.map(i=>({ title:i.title, quantity:i.quantity, unit_price: i.unit_price, currency_id:'COP' })),
      external_reference: reference,
      payer: { name: shipping.name, email: shipping.email },
      back_urls: {
        success: process.env.SITE_BASE_URL ? `${process.env.SITE_BASE_URL}/confirmacion.html?provider=mp&status=success&ref=${reference}` : `http://localhost:4000/confirmacion.html?provider=mp&status=success&ref=${reference}`,
        failure: process.env.SITE_BASE_URL ? `${process.env.SITE_BASE_URL}/confirmacion.html?provider=mp&status=failure&ref=${reference}` : `http://localhost:4000/confirmacion.html?provider=mp&status=failure&ref=${reference}`,
        pending: process.env.SITE_BASE_URL ? `${process.env.SITE_BASE_URL}/confirmacion.html?provider=mp&status=pending&ref=${reference}` : `http://localhost:4000/confirmacion.html?provider=mp&status=pending&ref=${reference}`
      },
      auto_return: 'approved'
    };
    const result = await mercadopago.preferences.create(preference);
    return res.json({ id: result.body.id, init_point: result.body.init_point, sandbox_init_point: result.body.sandbox_init_point });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/wompi/checkout', async (req, res) => {
  try {
    if (!WOMPI_PUBLIC_KEY || !WOMPI_PRIVATE_KEY || !WOMPI_INTEGRITY_SECRET) return res.status(500).json({ error: 'Llaves Wompi no configuradas' });
    const { items = [], total = 0, reference = 'order-'+Date.now(), shipping = {} } = req.body || {};
    store.setOrder(reference, { provider:'wompi', status:'created', items, total, shipping });

    // Wompi requiere amount_in_cents, currency, reference y firma de integridad
    const amountInCents = Math.round(Number(total||0) * 100);
    const currency = 'COP';
    const integritySignature = wompiIntegrity({ reference, amountInCents, currency, integritySecret: WOMPI_INTEGRITY_SECRET });

    // Crear checkout URL via API de Wompi (Link de pago)
    // Alternativa: redireccionar al widget/checkout web con parametros
    const checkoutReq = {
      amount_in_cents: amountInCents,
      currency,
      reference,
      public_key: WOMPI_PUBLIC_KEY,
      signature: { integrity: integritySignature },
      customer_data: { full_name: shipping.name, email: shipping.email, phone_number: shipping.phone },
      redirect_url: process.env.SITE_BASE_URL ? `${process.env.SITE_BASE_URL}/confirmacion.html?provider=wompi&ref=${reference}` : `http://localhost:4000/confirmacion.html?provider=wompi&ref=${reference}`
    };

    // Wompi no siempre permite crear checkout via API publica; si falla, armamos URL directa
    try {
      const r = await fetch(`${WOMPI_BASE}/v1/checkout`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${WOMPI_PRIVATE_KEY}` }, body: JSON.stringify(checkoutReq) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'No se pudo crear checkout');
      return res.json({ checkout_url: data?.data?.checkout_url || data?.data?.url || `${WOMPI_BASE}/v2/checkout.js` });
    } catch (e) {
      // fallback: construir URL del widget web con firma
      const params = new URLSearchParams({
        public_key: WOMPI_PUBLIC_KEY,
        currency,
        amount_in_cents: String(amountInCents),
        reference,
        signature: integritySignature,
        redirect_url: checkoutReq.redirect_url
      });
      const url = `${WOMPI_BASE}/v1/widget.html?${params.toString()}`;
      return res.json({ checkout_url: url });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Webhook Mercado Pago
app.post('/api/mp/webhook', express.json(), async (req, res) => {
  try{
    const topic = req.query?.type || req.body?.type;
    const data = req.body?.data || {};
    // En produccion consultar al endpoint de MP para traer info completa del pago
    const ref = req.body?.data?.id || req.body?.resource || '';
    // Para demo, marcamos estado por el query "type" si viene y mantenemos referencia externa si llega
    if (req.body && req.body?.external_reference){
      store.update(req.body.external_reference, { status: (req.body.action || topic || 'updated') });
    }
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

// Webhook Wompi
app.post('/api/wompi/webhook', express.json(), (req, res) => {
  try{
    const ev = req.body?.event || req.body; // wompi envia event/data
    const data = req.body?.data || {};
    const ref = data?.transaction?.reference || data?.reference;
    const status = data?.transaction?.status || data?.status || 'updated';
    if (ref) store.update(ref, { status, wompi: data });
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

// Consultar estado por referencia
app.get('/api/order/:ref', (req, res) => {
  const ref = req.params.ref;
  const ord = store.get(ref);
  if (!ord) return res.status(404).json({ error: 'No existe la orden' });
  res.json(ord);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>{
  console.log('Server listening on http://localhost:'+PORT);
});

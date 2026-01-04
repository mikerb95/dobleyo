import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import mercadopago from 'mercadopago';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import crypto from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { stockRouter } from './routes/stock.js';
import { authRouter } from './routes/auth.js';
import { setupRouter } from './routes/setup.js';

const app = express();

// Seguridad: Headers HTTP seguros (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar CSP estricto por ahora si hay scripts inline o externos
}));

// Seguridad: Cookies y Body Parsing
app.use(cookieParser());
app.use(express.json());

// CORS: Configurar origenes permitidos (ajustar segun dominio real)
app.use(cors({
  origin: process.env.SITE_BASE_URL || 'http://localhost:4000',
  credentials: true // Permitir cookies en CORS
}));

app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/setup', setupRouter);

// Directorio de estaticos: carpeta dist (generada por astro build)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '../dist');
app.use(express.static(staticDir));

// Salud
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Mercado Pago
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
if (MP_ACCESS_TOKEN){ mercadopago.configure({ access_token: MP_ACCESS_TOKEN }); }

// Wompi
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || '';
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || '';
const WOMPI_BASE = process.env.WOMPI_ENV === 'prod' ? 'https://production.wompi.co' : 'https://sandbox.wompi.co';

function wompiIntegrity({ reference, amountInCents, currency, integritySecret }){
  const str = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

app.post('/api/mp/create_preference', async (req, res) => {
  try {
    if (!MP_ACCESS_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    const { items = [], reference = 'order-'+Date.now(), shipping = {}, total = 0 } = req.body || {};
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

    const amountInCents = Math.round(Number(total||0) * 100);
    const currency = 'COP';
    const integritySignature = wompiIntegrity({ reference, amountInCents, currency, integritySecret: WOMPI_INTEGRITY_SECRET });

    const checkoutReq = {
      amount_in_cents: amountInCents,
      currency,
      reference,
      public_key: WOMPI_PUBLIC_KEY,
      signature: { integrity: integritySignature },
      customer_data: { full_name: shipping.name, email: shipping.email, phone_number: shipping.phone },
      redirect_url: process.env.SITE_BASE_URL ? `${process.env.SITE_BASE_URL}/confirmacion.html?provider=wompi&ref=${reference}` : `http://localhost:4000/confirmacion.html?provider=wompi&ref=${reference}`
    };

    try {
      const r = await fetch(`${WOMPI_BASE}/v1/checkout`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${WOMPI_PRIVATE_KEY}` }, body: JSON.stringify(checkoutReq) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'No se pudo crear checkout');
      return res.json({ checkout_url: data?.data?.checkout_url || data?.data?.url || `${WOMPI_BASE}/v2/checkout.js` });
    } catch (e) {
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

app.post('/api/mp/webhook', express.json(), async (req, res) => {
  try{
    const topic = req.query?.type || req.body?.type;
    if (req.body && req.body?.external_reference){
      store.update(req.body.external_reference, { status: (req.body.action || topic || 'updated') });
    }
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

app.post('/api/wompi/webhook', express.json(), (req, res) => {
  try{
    const data = req.body?.data || {};
    const ref = data?.transaction?.reference || data?.reference;
    const status = data?.transaction?.status || data?.status || 'updated';
    if (ref) store.update(ref, { status, wompi: data });
    res.sendStatus(200);
  }catch(e){ res.status(200).end(); }
});

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

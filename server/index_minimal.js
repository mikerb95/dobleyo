import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { stockRouter } from './routes/stock.js';
import { authRouter } from './routes/auth.js';
import { setupRouter } from './routes/setup.js';

const app = express();

// Basic Middleware
app.use(cookieParser());
app.use(express.json());

// CORS
app.use(cors({
  origin: process.env.SITE_BASE_URL || 'http://localhost:4000',
  credentials: true
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/stock', stockRouter);
app.use('/api/setup', setupRouter);

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Start Server Logic
const PORT = process.env.PORT || 4000;
if (process.env.START_SERVER === 'true') {
  app.listen(PORT, ()=>{
    console.log('Server listening on http://localhost:'+PORT);
  });
}

export default app;

import pg from 'pg';

export default async function handler(req, res) {
  // Proteger en producción
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Endpoint no disponible en producción' });
  }

  const logs = [];
  const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

  let client;
  try {
    log('Starting DB Diagnostic');

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is missing');
    }

    log('Parsing URL...');
    const dbUrl = new URL(process.env.DATABASE_URL);
    log(`Config: Host=${dbUrl.hostname}, User=${dbUrl.username}, Port=${dbUrl.port}, DB=${dbUrl.pathname.slice(1)}`);

    log('Creating connection...');
    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });
    await client.connect();

    log('Connection established! Running query...');
    const result = await client.query('SELECT 1 as val');
    log(`Query result: ${JSON.stringify(result.rows)}`);

    // Listar tablas existentes
    const tables = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    log(`Tables in DB: ${tables.rows.map(r => r.tablename).join(', ')}`);

    await client.end();
    log('Connection closed.');

    res.status(200).json({ status: 'Success', logs });

  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (error.code) log(`Code: ${error.code}`);
    if (client) try { await client.end(); } catch (_) {}

    res.status(200).json({ status: 'Failed', error: error.message, logs });
  }
}

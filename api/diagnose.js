import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const logs = [];
  const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

  try {
    log("Starting DB Diagnostic");
    
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing");
    }

    log("Parsing URL...");
    const dbUrl = new URL(process.env.DATABASE_URL);
    const config = {
      host: dbUrl.hostname,
      user: dbUrl.username,
      port: Number(dbUrl.port),
      database: dbUrl.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      connectTimeout: 10000
    };
    
    log(`Config: Host=${config.host}, User=${config.user}, Port=${config.port}, DB=${config.database}`);

    log("Creating connection...");
    const connection = await mysql.createConnection({
      ...config,
      password: dbUrl.password
    });

    log("Connection established! Ping...");
    await connection.ping();
    log("Ping successful.");

    log("Running simple query...");
    const [rows] = await connection.execute('SELECT 1 as val');
    log(`Query result: ${JSON.stringify(rows)}`);

    await connection.end();
    log("Connection closed.");

    res.status(200).json({ status: "Success", logs });

  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (error.code) log(`Code: ${error.code}`);
    if (error.stack) log(`Stack: ${error.stack}`);
    
    res.status(200).json({ status: "Failed", error: error.message, logs });
  }
}

export default function handler(req, res) {
  try {
    const envCheck = {
      node_version: process.version,
      has_db_url: !!process.env.DATABASE_URL,
      db_url_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 10) : 'N/A',
      has_jwt: !!process.env.JWT_SECRET,
      vercel_region: process.env.VERCEL_REGION || 'unknown'
    };
    
    res.status(200).json({ 
      status: "Alive", 
      message: "This is a minimal function with NO dependencies",
      env: envCheck
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}

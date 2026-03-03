import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

/**
 * Crear nuevo usuario administrador
 */

async function createAdminUser() {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: dbUrl.hostname,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    port: Number(dbUrl.port),
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('👤 Creando usuario administrador...\n');
    
    const userData = {
      email: 'luis.marquez.ramirez@gmail.com',
      password: 'Lmarquez2026*',
      name: 'Luis Marquez',
      mobile_phone: '+573204981580',
      city: 'Bogota DC',
      state_province: 'Cundinamarca',
      country: 'Colombia',
      role: 'admin'
    };
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);
    
    // Insertar en BD
    await connection.execute(
      `INSERT INTO users (email, password_hash, name, mobile_phone, city, state_province, country, role, is_verified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        userData.email,
        passwordHash,
        userData.name,
        userData.mobile_phone,
        userData.city,
        userData.state_province,
        userData.country,
        userData.role
      ]
    );
    
    console.log('✅ Usuario administrador creado exitosamente:\n');
    console.log(`   Nombre: ${userData.name}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Teléfono: ${userData.mobile_phone}`);
    console.log(`   Ciudad: ${userData.city}`);
    console.log(`   Departamento: ${userData.state_province}`);
    console.log(`   País: ${userData.country}`);
    console.log(`   Rol: ${userData.role}`);
    console.log(`   Contraseña: ${userData.password}\n`);
    
  } catch (error) {
    console.error('❌ Error al crear usuario:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Ejecutar
createAdminUser().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

import { query } from '../db.js';

// Login de administradores con GitHub (/admin/login).
// - users.github_id: id numérico de GitHub (como texto) de la cuenta vinculada.
// - Revoca las sesiones de admins que aún no han entrado por GitHub: venían del
//   login con contraseña, que ya no está permitido para ese rol. Es idempotente:
//   una vez vinculados, los admins tienen github_id y no se tocan.
export async function addGithubAdminAuth() {
  // SQLite no permite ADD COLUMN UNIQUE: la unicidad va en un índice aparte.
  await query(`ALTER TABLE users ADD COLUMN github_id VARCHAR(255)`).catch(err => {
    if (!err.message.includes('duplicate column')) throw err;
  });
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)`);

  await query(
    `UPDATE refresh_tokens SET revoked = 1
     WHERE revoked = 0
       AND user_id IN (SELECT id FROM users WHERE role = 'admin' AND github_id IS NULL)`
  );
  console.log('[Migration] github_id añadido a users y sesiones de admin sin GitHub revocadas.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  import('dotenv/config').then(() =>
    addGithubAdminAuth()
      .then(() => { console.log('OK'); process.exit(0); })
      .catch(err => { console.error(err); process.exit(1); })
  );
}

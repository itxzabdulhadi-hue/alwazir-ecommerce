/* ============================================================
   ALWAZIR — environment variables
   Loads a .env file from the repository root when one exists.
   Locally this is where you put DATABASE_URL (Neon Postgres) or
   BLOB_READ_WRITE_TOKEN (Vercel Blob) — see .env.example.

   On Vercel there is no .env file (environment variables are set
   in the project dashboard), so this is a no-op there. Existing
   environment variables always take precedence over .env values.

   Uses Node 22's built-in process.loadEnvFile — no extra package.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');

if (typeof process.loadEnvFile === 'function' && fs.existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (e) {
    console.warn('Could not load .env file:', e.message);
  }
}

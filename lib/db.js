/* ============================================================
   ALWAZIR — Postgres storage layer (Neon)
   Third storage mode, enabled purely by a DATABASE_URL in the
   environment — locally via a .env file at the repo root (see
   .env.example), on Vercel via a project environment variable.
   No other setup is needed: the schema is created automatically
   and a fresh database is seeded with the default store.

   Schema (auto-created on first use):

     settings  (key TEXT PK, value JSONB)
         → db.settings (brand name, theme, colors, fonts, …)
     products  (id TEXT PK, name, category, description,
                price, image, popular, special, created_at)
         → db.products
     uploads   (name TEXT PK, content_type, data BYTEA,
                uploaded_at)
         → uploaded images. In this mode images live in Postgres
           too, so a single database URL is all the app needs —
           no JSON file and no Blob store.

   This module is only used when storageMode() === 'postgres'
   (see lib/store.js). It mirrors the local/blob layer's data
   shape so the rest of the app doesn't notice the difference.
   ============================================================ */

/* ---------- pg client (lazy, like the blob client) ---------- */
let pgModule = null;
let pgFailed = false;
function pgClient() {
  if (pgModule !== null) return pgModule;
  if (pgFailed) return null;
  try {
    pgModule = require('pg');
  } catch (e) {
    pgFailed = true;
    pgModule = null;
  }
  return pgModule;
}

function configured() {
  return !!(process.env.DATABASE_URL && pgClient());
}

let pool = null;
let readyPromise = null;

function poolInstance() {
  if (!pool) {
    const { Pool } = pgClient();
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    pool.on('error', (e) => console.warn('Postgres pool error:', e.message));
  }
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  popular BOOLEAN NOT NULL DEFAULT FALSE,
  special BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS uploads (
  name TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

/* Create the tables if missing (idempotent). Retried on failure so
   a transient connection drop at startup doesn't stick. */
async function ensureReady() {
  if (!readyPromise) {
    readyPromise = poolInstance()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        readyPromise = null;
        throw e;
      });
  }
  return readyPromise;
}

/* Connectivity probe (used by /api/status). */
async function probeDb() {
  if (!process.env.DATABASE_URL) return { connected: false, error: 'DATABASE_URL is not set' };
  if (!pgClient()) return { connected: false, error: 'pg module is not installed' };
  try {
    await ensureReady();
    const res = await poolInstance().query('SELECT 1 AS ok');
    return { connected: res.rows.length > 0, error: null };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

function toMillis(v) {
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return Number.isFinite(n) ? n : Date.now();
}

/* ---------- read ---------- */

async function fetchDb() {
  await ensureReady();
  const [sRes, pRes] = await Promise.all([
    poolInstance().query('SELECT key, value FROM settings'),
    poolInstance().query(
      'SELECT id, name, category, description, price, image, popular, special, created_at FROM products'
    )
  ]);
  const settings = {};
  for (const row of sRes.rows) settings[row.key] = row.value;
  const products = pRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    image: row.image,
    popular: !!row.popular,
    special: !!row.special,
    createdAt: toMillis(row.created_at)
  }));
  return { settings, products };
}

/* ---------- write (atomic) ---------- */

async function saveDb(nextDb) {
  await ensureReady();
  const client = await poolInstance().connect();
  try {
    await client.query('BEGIN');

    // Settings: full replace (the app always saves the complete
    // settings object, so delete + insert is both simple and safe).
    await client.query('DELETE FROM settings');
    const settings = nextDb.settings || {};
    const keys = Object.keys(settings);
    if (keys.length) {
      const placeholders = [];
      const params = [];
      keys.forEach((k, i) => {
        placeholders.push(`($${i * 2 + 1}, $${i * 2 + 2}::jsonb)`);
        params.push(k, settings[k]);
      });
      await client.query(
        `INSERT INTO settings (key, value) VALUES ${placeholders.join(', ')}`,
        params
      );
    }

    // Products: full replace, preserving created_at.
    await client.query('DELETE FROM products');
    const products = Array.isArray(nextDb.products) ? nextDb.products : [];
    if (products.length) {
      const placeholders = products
        .map((_, i) => `(${[...Array(9)].map((_, j) => '$' + (i * 9 + j + 1)).join(', ')})`)
        .join(', ');
      const params = [];
      for (const p of products) {
        params.push(
          p.id,
          p.name,
          p.category || 'General',
          p.description || '',
          Number(p.price) || 0,
          p.image || '',
          !!p.popular,
          !!p.special,
          new Date(p.createdAt || Date.now())
        );
      }
      await client.query(
        `INSERT INTO products (id, name, category, description, price, image, popular, special, created_at)
         VALUES ${placeholders}`,
        params
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (err) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/* ---------- uploads (images live in Postgres in this mode) ---------- */

async function saveUploadRow(name, buffer, contentType) {
  await ensureReady();
  await poolInstance().query(
    `INSERT INTO uploads (name, content_type, data, uploaded_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (name) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, uploaded_at = NOW()`,
    [name, contentType || 'application/octet-stream', buffer]
  );
}

async function listUploadsRows() {
  await ensureReady();
  const res = await poolInstance().query('SELECT name, uploaded_at FROM uploads ORDER BY uploaded_at ASC');
  return res.rows.map((row) => ({
    name: row.name,
    url: '/uploads/' + row.name,
    uploadedAt: toMillis(row.uploaded_at)
  }));
}

async function deleteUploadRow(name) {
  await ensureReady();
  await poolInstance().query('DELETE FROM uploads WHERE name = $1', [name]);
}

async function getUploadRow(name) {
  await ensureReady();
  const res = await poolInstance().query('SELECT content_type, data FROM uploads WHERE name = $1', [name]);
  if (!res.rows.length) return null;
  return { contentType: res.rows[0].content_type, data: res.rows[0].data };
}

module.exports = {
  configured,
  probeDb,
  fetchDb,
  saveDb,
  saveUploadRow,
  listUploadsRows,
  deleteUploadRow,
  getUploadRow
};

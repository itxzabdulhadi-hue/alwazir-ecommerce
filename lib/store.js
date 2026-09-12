/* ============================================================
   ALWAZIR — storage layer
   Two modes, chosen automatically:
   1. "local" (default): one JSON file `data/db.json` + uploads in
      `public/uploads/`. Works anywhere with a writable disk (npm start).
   2. "blob"  (Vercel): when BLOB_READ_WRITE_TOKEN (or BLOB_STORE_ID) is set,
      the database is stored at `alwazir/db.json` (private) and uploads are
      stored at `alwazir/uploads/<name>` (public) in Vercel Blob.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');

const DB_PATH = 'alwazir/db.json';
const UPLOAD_PREFIX = 'alwazir/uploads/';

const THEMES = ['gold', 'rose', 'emerald', 'midnight', 'ivory', 'royal', 'dark', 'bw', 'blackemerald', 'silveremerald'];

const FONTS = [
  { id: 'default', name: 'Default (Inter)' },
  { id: 'poppins', name: 'Poppins' },
  { id: 'lora', name: 'Lora' },
  { id: 'montserrat', name: 'Montserrat' },
  { id: 'opensans', name: 'Open Sans' },
  { id: 'nunito', name: 'Nunito' },
  { id: 'raleway', name: 'Raleway' }
];

const DEFAULT_DB = {
  settings: {
    brandName: 'alwazir',
    tagline: 'Luxury Perfume Oils',
    logo: '/img/seed/logo.png',
    shareTitle: '',
    shareDescription: '',
    shareImage: '',
    theme: 'gold',
    currency: '$',
    whatsapp: '923174541414',
    mobileColumns: 'double',
    fontFamily: 'default',
    brandFont: 'default',
    textBold: false,
    adminKey: 'evil123'
  },
  products: [
    {
      id: 'p-oud-royale',
      name: 'Oud Royale',
      category: 'Oud',
      description:
        'A regal blend of aged agarwood, warm amber and a whisper of saffron. Oud Royale opens with smoky, resinous depth and settles into a rich, long-lasting trail of leather and golden woods. The signature scent of the Alwazir house — bold, opulent and unmistakably royal.',
      price: 180,
      image: '/img/seed/oud-royale.jpg',
      popular: true,
      special: true,
      createdAt: 1700000000000
    },
    {
      id: 'p-white-musk',
      name: 'White Musk',
      category: 'Musk',
      description:
        'Clean, soft and endlessly elegant. White Musk wraps the skin in powdery musk, delicate white florals and a hint of warm vanilla. A gentle, intimate fragrance that lingers close to the skin all day.',
      price: 95,
      image: '/img/seed/white-musk.jpg',
      popular: true,
      special: false,
      createdAt: 1700000001000
    },
    {
      id: 'p-amber-gold',
      name: 'Amber Gold',
      category: 'Amber',
      description:
        'Liquid gold in a bottle. Warm amber, sweet labdanum and a touch of honeyed vanilla create a glowing, sun-kissed scent that feels luxurious from first drop to final dry-down.',
      price: 140,
      image: '/img/seed/amber-gold.jpg',
      popular: true,
      special: false,
      createdAt: 1700000002000
    },
    {
      id: 'p-rose-oud',
      name: 'Rose Oud',
      category: 'Floral',
      description:
        'Velvet rose meets deep oud in a modern classic. Bulgarian rose petals, dark oud wood and a soft touch of musk create a romantic, sophisticated fragrance that balances floral brightness with smoky richness.',
      price: 150,
      image: '/img/seed/rose-oud.jpg',
      popular: false,
      special: false,
      createdAt: 1700000003000
    },
    {
      id: 'p-saffron-gold',
      name: 'Saffron Gold',
      category: 'Spicy',
      description:
        'Radiant and rare. Precious saffron is layered over creamy sandalwood and warm spices, creating a golden, exotic fragrance that is both vibrant and deeply comforting.',
      price: 165,
      image: '/img/seed/saffron-gold.jpg',
      popular: false,
      special: false,
      createdAt: 1700000004000
    },
    {
      id: 'p-jasmine-white',
      name: 'Jasmine White',
      category: 'Floral',
      description:
        'A bouquet of white jasmine at midnight. Fresh jasmine blossoms, neroli and soft musk mingle in a luminous, clean fragrance that is pure, delicate and effortlessly feminine.',
      price: 85,
      image: '/img/seed/jasmine-white.jpg',
      popular: false,
      special: false,
      createdAt: 1700000005000
    },
    {
      id: 'p-sandalwood',
      name: 'Sandalwood',
      category: 'Woody',
      description:
        'Smooth, creamy and meditative. Pure sandalwood is softened with hints of cardamom and cedar, creating a grounding, spa-like scent that is warm, woody and quietly luxurious.',
      price: 120,
      image: '/img/seed/sandalwood.jpg',
      popular: false,
      special: false,
      createdAt: 1700000006000
    },
    {
      id: 'p-golden-vanilla',
      name: 'Golden Vanilla',
      category: 'Gourmand',
      description:
        'Sweet indulgence. Rich Madagascan vanilla, caramel and a touch of tonka bean melt into a warm, gourmand fragrance that feels like a golden embrace.',
      price: 75,
      image: '/img/seed/golden-vanilla.jpg',
      popular: false,
      special: false,
      createdAt: 1700000007000
    }
  ]
};

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalize(parsed) {
  const p = parsed && typeof parsed === 'object' ? parsed : null;
  if (!p) return deepCopy(DEFAULT_DB);
  return {
    settings: { ...DEFAULT_DB.settings, ...(p.settings || {}) },
    products: Array.isArray(p.products) ? p.products : deepCopy(DEFAULT_DB.products)
  };
}

/* ---------- blob client (lazy) ---------- */
let blob = null;
function blobClient() {
  if (blob === null) {
    try {
      blob = require('@vercel/blob');
    } catch (e) {
      blob = undefined;
    }
  }
  return blob;
}

function storageMode() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if ((token || storeId) && blobClient()) return 'blob';
  return 'local';
}

/* ---------- in-memory cache (shared by both modes) ---------- */
let db = null;
let cacheAt = 0;
const BLOB_TTL = 5000; // ms — how long a warm serverless instance reuses its copy

/* Detected store access type ('private' | 'public'), cached after first success.
   Vercel requires the `access` option to match how the Blob store was created. */
let dbAccess = null;

async function dbGet() {
  const client = blobClient();
  const order = dbAccess ? [dbAccess] : ['private', 'public'];
  let lastErr = null;
  for (const access of order) {
    try {
      // useCache:false — always read the latest version right after a save,
      // so theme/text/product edits show up immediately instead of the
      // Blob CDN serving a stale (up to ~60s old) copy.
      const res = await client.get(DB_PATH, { access, useCache: false });
      dbAccess = access; // a successful read (result or null) means this access works
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Blob read failed');
}

async function dbPut(body) {
  const client = blobClient();
  const order = dbAccess ? [dbAccess] : ['private', 'public'];
  let lastErr = null;
  for (const access of order) {
    try {
      const res = await client.put(DB_PATH, body, {
        access,
        contentType: 'application/json',
        allowOverwrite: true
      });
      dbAccess = access;
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Blob write failed');
}

async function getData() {
  if (storageMode() === 'blob') {
    if (db && Date.now() - cacheAt < BLOB_TTL) return db;
    try {
      const res = await dbGet();
      if (res && res.stream) {
        const text = await new Response(res.stream).text();
        db = normalize(JSON.parse(text));
        cacheAt = Date.now();
        return db;
      }
    } catch (e) {
      console.warn('Could not read database from Blob:', e.message);
    }
    db = deepCopy(DEFAULT_DB);
    cacheAt = Date.now();
    try {
      await saveData(db);
    } catch (e) {
      /* read-only fallback: keep in-memory seed */
    }
    return db;
  }

  /* local file mode */
  if (db) return db;
  try {
    db = normalize(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) {
    db = deepCopy(DEFAULT_DB);
    try {
      await saveData(db);
    } catch (err) {
      /* read-only filesystem: keep the in-memory seed for this run */
    }
  }
  return db;
}

async function saveData(nextDb) {
  db = nextDb;
  cacheAt = Date.now();

  if (storageMode() === 'blob') {
    try {
      await dbPut(JSON.stringify(db, null, 2));
    } catch (e) {
      throw new Error('Could not save to the Blob database: ' + e.message);
    }
    return;
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    // Read-only filesystem (e.g. Vercel without a connected Blob store).
    // Throw so the admin panel shows an error instead of silently reverting.
    throw new Error('Storage is read-only — changes could not be saved. Connect a Vercel Blob store (or run locally with npm start).');
  }
}

/* ---------- uploads ---------- */
function newUploadName(originalName) {
  const ext = (path.extname(originalName || '') || '.jpg').toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
}

/* Connectivity probe: can we actually reach + use the Blob store? */
async function probeBlob() {
  if (storageMode() !== 'blob') return { connected: false, access: null };
  const client = blobClient();
  if (!client) return { connected: false, access: null };
  try {
    await dbGet(); // resolves (result or null) => store reachable with a valid token
    return { connected: true, access: dbAccess };
  } catch (e) {
    return { connected: false, access: null };
  }
}

/* ---------- upload limits (keep at most 5 images) ---------- */
const MAX_UPLOADS = 5;

// Names of uploaded files that are currently referenced by a product, the
// brand logo, or the link-preview image.
function referencedNames(db) {
  const names = new Set();
  const vals = [
    db.settings && db.settings.logo,
    db.settings && db.settings.shareImage,
    ...((db.products || []).map((p) => p.image))
  ];
  for (const v of vals) {
    if (!v) continue;
    const name = String(v).split('/').pop();
    if (name && name !== '.gitkeep') names.add(name);
  }
  return names;
}

async function listUploads() {
  if (storageMode() === 'blob') {
    try {
      const res = await blobClient().list({ prefix: UPLOAD_PREFIX, mode: 'expanded', limit: 1000 });
      return (res.blobs || []).map((b) => ({
        name: String(b.pathname).split('/').pop(),
        url: b.url,
        uploadedAt: new Date(b.uploadedAt || Date.now()).getTime()
      }));
    } catch (e) {
      return [];
    }
  }
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => f !== '.gitkeep');
    return files.map((f) => {
      let uploadedAt = 0;
      try { uploadedAt = fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs; } catch (e) {}
      return { name: f, url: '/uploads/' + f, uploadedAt };
    });
  } catch (e) {
    return [];
  }
}

// Delete the most-unused images until only `limit` remain.
// "Most unused" = not referenced by any product/logo/preview, oldest first.
async function pruneUploads(limit) {
  const uploads = await listUploads();
  if (uploads.length <= limit) return;
  let db;
  try { db = await getData(); } catch (e) { db = DEFAULT_DB; }
  const refs = referencedNames(db);
  uploads.sort((a, b) => {
    const au = refs.has(a.name) ? 1 : 0;
    const bu = refs.has(b.name) ? 1 : 0;
    if (au !== bu) return au - bu; // unreferenced first
    return a.uploadedAt - b.uploadedAt; // then oldest first
  });
  let excess = uploads.length - limit;
  for (const u of uploads) {
    if (excess <= 0) break;
    try {
      if (storageMode() === 'blob') await blobClient().del(u.url);
      else fs.unlinkSync(path.join(UPLOAD_DIR, u.name));
      excess--;
    } catch (e) {
      /* skip individual delete failures */
    }
  }
}

async function saveUpload(name, buffer, contentType) {
  // Make room first (keep at most MAX_UPLOADS - 1 so the new one is the 5th),
  // deleting the most-unused image if we're at the limit.
  try { await pruneUploads(MAX_UPLOADS - 1); } catch (e) { /* non-fatal */ }

  if (storageMode() === 'blob') {
    // Uploads must be public so they can be shown in <img> tags on the store.
    // This requires a "public" Blob store. On a private store this call fails —
    // create a public store to serve product/logo images directly.
    try {
      const res = await blobClient().put(UPLOAD_PREFIX + name, buffer, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        addRandomSuffix: false
      });
      return res.url;
    } catch (e) {
      throw new Error('Could not upload image to Blob: ' + e.message);
    }
  }
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  } catch (e) {
    throw new Error('Storage is read-only — image could not be saved. Connect a Vercel Blob store (or run locally with npm start).');
  }
  return '/uploads/' + name;
}

/* Is data actually persistent in this environment? (used by /api/status) */
let localWritable = null;
function persistable() {
  if (storageMode() === 'blob') return true;
  if (localWritable === null) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const probe = path.join(DATA_DIR, '.probe-' + crypto.randomBytes(4).toString('hex'));
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      localWritable = true;
    } catch (e) {
      localWritable = false;
    }
  }
  return localWritable;
}

module.exports = {
  THEMES,
  FONTS,
  DEFAULT_DB,
  storageMode,
  probeBlob,
  persistable,
  getData,
  saveData,
  saveUpload,
  newUploadName,
  normalize
};

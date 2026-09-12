# Alwazir — Luxury Perfume Oils 🕌✨

A gold & white storefront for a perfume oil business. Built with **Node.js + Express**
and a vanilla-JS frontend — no build step required.

The app has **three storage modes**, chosen automatically (highest priority first):

| Mode | When | Database | Image uploads |
| --- | --- | --- | --- |
| **postgres** | `DATABASE_URL` set | Postgres / [Neon](https://neon.tech) (tables auto-created) | `uploads` table inside Postgres |
| **blob** | no `DATABASE_URL`, but `BLOB_READ_WRITE_TOKEN` set (Vercel) | `alwazir/db.json` in Vercel Blob | `alwazir/uploads/*` in Vercel Blob (public) |
| **local** | neither set (default) | `data/db.json` | `public/uploads/` |

**The Postgres mode is the simplest to run: put one `DATABASE_URL` in a `.env`
file and you're done** — no file system, no Blob store. Tables are created
automatically on first run and a fresh database is seeded with the default store.

---

## Option 1 — Run it locally (easiest)

```bash
npm install
npm start
```

Then open http://localhost:3000. Everything (products, settings, uploaded images)
is saved on disk: `data/db.json` and `public/uploads/`. Admin password: `evil123`.

> **Want a real database instead of files?** See
> [Option 2 — Neon Postgres](#option-2--use-a-neon-postgres-database-recommended):
> add one `DATABASE_URL` to a `.env` file and restart.

---

## Option 2 — Use a Neon Postgres database (recommended)

This is the **simplest setup**: the app stores its database and every uploaded
image inside your Postgres database. All it needs is one environment variable —
`DATABASE_URL` — placed in a `.env` file in the project root. No file system and
no Blob store required.

### Step 1 — Create a free Neon database (~1 minute)

1. Go to [neon.tech](https://neon.tech) and sign up (the free tier is enough).
2. Click **New Project**, choose a name (e.g. `alwazir`) and any region.
3. When the project is ready, open **Connection details** (left sidebar →
   your database → *Connection details*).
4. Copy the **Pooled connection string** — it looks like:

   ```
   postgres://USER:PASSWORD@ep-xxxx-xxxx-pooler.ap-south-1.aws.neon.tech/DBNAME?sslmode=require
   ```

   > Use the **pooled** URL (`…-pooler…`). Neon's pooled connection (PgBouncer)
   > is the right one for serverless/low-traffic apps like this one.

### Step 2 — Put it in a `.env` file

Create a file named `.env` in the project root (next to `package.json`):

```bash
DATABASE_URL=postgres://USER:PASSWORD@ep-xxxx-xxxx-pooler.ap-south-1.aws.neon.tech/DBNAME?sslmode=require
```

You can also use the provided template: `cp .env.example .env`, then paste your
URL in. The `.env` file is already gitignored — the password never gets committed.

> The app loads the file itself (Node 20.6+ `process.loadEnvFile`). No
> `dotenv` package and no config changes are needed. If `DATABASE_URL` is
> already set in the environment (e.g. on Vercel), that value wins.

### Step 3 — Run it

```bash
npm install
npm start
```

On first start the app **creates its own tables** (`settings`, `products`,
`uploads`) and seeds them with the default store — you never have to run SQL.
Open http://localhost:3000.

### Verify the connection

Open `http://localhost:3000/api/status`:

```
{"mode":"postgres","dbConnected":true,"persistable":true}
```

- `dbConnected: true` → ✅ connected, data is in your database.
- `dbConnected: false` → the URL is set but the connection failed; the message
  is in `dbError` (typical causes: wrong password, not using the pooled URL,
  firewall, or missing `?sslmode=require`).

Change something in the admin panel, then open Neon → **Console** (or
**History**) and you'll see the writes — and your products in the `products`
table. If the database is unreachable the store keeps working from memory (and
says so at `/api/status`), but saves will show an error instead of silently
reverting.

### Deploying on Vercel with Postgres

Same code, no changes: add **`DATABASE_URL`** to the Vercel project under
**Settings → Environment Variables** (Production), then **Redeploy**. Because
`DATABASE_URL` takes priority over the Blob token, Vercel instances will read
and write straight to your Neon database — uploads included (served from the
database). You no longer need the Blob store at all.

> Neon free tier: the database **hibernates** after 5 minutes without
> connections; the first request after a pause takes ~1–2 seconds to wake it.
> For a store this is usually imperceptible.

---

## Option 3 — Deploy to Vercel with Blob storage (no database needed)

If you don't want to manage a database, Vercel Blob also works: the app stores
data and uploads in Blob. Setting it up takes ~2 minutes:

### Step 1 — Connect a Blob store

1. Go to [vercel.com](https://vercel.com) → open your project → **Storage** tab.
2. Click **Create Database** → choose **Blob** (or **Create Blob store**).
3. Give it a name (e.g. `alwazir`) and click **Connect** / **Create**.
4. Vercel automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable to
   your project. (You can double-check it under **Settings → Environment Variables**.)

> The app also understands `BLOB_STORE_ID` if you prefer OIDC, but the token is the
> simplest and works everywhere.

### Step 2 — Deploy the code

1. On [vercel.com/new](https://vercel.com/new), **import this repository**.
2. Pick the right branch (the one with your site code).
3. Framework preset: **Other**. Leave build command and output directory **blank**.
4. Click **Deploy**.

### Step 3 — Redeploy after connecting Blob

If you connected the Blob store *after* the first deploy, go to the project →
**Deployments** → **⋯ Redeploy** (latest commit) so the new environment variable
takes effect.

That's it — the admin panel now saves products, settings, and **image uploads**
(they're stored in Blob and served from Vercel's CDN). Open `/admin.html` to manage
the store. Default password: `evil123`.

### Verify the connection

After deploying, open:

```
https://YOUR-SITE.vercel.app/api/status
```

- `{"mode":"blob","blobConnected":true,"storeAccess":"public"}` → ✅ connected to a public store
- `{"mode":"blob","blobConnected":true,"storeAccess":"private"}` → ✅ connected to a private store
- `{"mode":"blob","blobConnected":false,...}` → token set but Blob unreachable (wrong token / not linked)
- `{"mode":"local","blobConnected":false,"persistable":true}` → saving to a local file (normal server)
- `{"mode":"local","blobConnected":false,"persistable":false}` → ❌ read-only (e.g. Vercel without Blob) — changes won't save
- `{"mode":"postgres","dbConnected":true,...}` → ✅ saving to Postgres/Neon
- `{"mode":"postgres","dbConnected":false,...}` → ❌ URL set but unreachable — see `dbError`

The admin panel also shows this status as a colored banner at the top of the dashboard.

### ⚠️ Note about public stores

A **public** Blob store works fine for uploads, but the database file
(`alwazir/db.json`) — which contains your admin password — is then readable by
anyone who knows its URL. For a small demo this is usually fine, but if you want
the admin password to stay private, create a **private** Blob store instead
(the app supports both). Either way, the admin login is a simple password gate and
should not be treated as strong security.

### How the app decides the mode

`lib/store.js` checks the environment, highest priority first:

1. **`DATABASE_URL` set** → `postgres` mode — all data and images live in Postgres
   (tables auto-created; a fresh database is seeded with the defaults).
2. **`BLOB_READ_WRITE_TOKEN` / `BLOB_STORE_ID` set** → `blob` mode (database at
   `alwazir/db.json`, uploads at `alwazir/uploads/<name>`).
3. **Neither set** → `local` mode (JSON file + `public/uploads/`).

So the exact same code runs locally and on Vercel with zero changes.

---

## Pages

| Page | URL | What it does |
| --- | --- | --- |
| Home | `/` | Brand name, search bar, **special offer showcase** (only if one is set), and a 2-products-per-row catalog with image, description, price, **Chat** and **Add to Cart**. |
| Product details | `/product.html?id=…` | Full description + price, and **4 similar products** from the home collection. |
| Admin panel | `/admin.html` | Add / edit / delete products, change brand name, logo, theme, fonts and mobile view, and mark products as **Popular** or **Special Offer**. |

## Admin access

- **Default password:** `evil123`
- Change it from the **Security** tab in the admin panel.

> ⚠️ This is a lightweight single-admin store. The password gate is intentionally
> simple — replace it with real authentication before using it in production.

## Features

- **Popular pin** — popular products are pinned to the top of the list.
- **Special offer** — mark a product as a special offer and it is showcased on the
  home page; if none is set, the section is hidden automatically.
- **Search** — instant search by product name and category, ranked by relevance.
- **Mobile product view** — admin toggle for **Single Mode** (1 per row) or
  **Double Mode** (2 per row) on phones.
- **Theme editor** — fully customize the store from the admin panel: 15 preset
  themes (the 10 classic ones — Gold & White, Rose Gold, Emerald, Midnight Gold,
  Ivory, Royal Blue, Dark Black & Green, Dark Black & White, Black & Emerald,
  Silver & Emerald — plus Ocean, Forest, Purple, Minimal and Professional),
  plus per-color pickers (primary, secondary, accent tint, background, surface,
  soft surface, text, muted text, border, button and danger) with native color
  pickers and validated hex input, live preview, contrast warnings and a
  one-click **Reset to Default**.
- **Text style** — 32 selectable Google Fonts for the **body text**, **brand
  name** and **headings** (each dropdown previews every font in its own
  typeface), and a **bold** toggle. Only the fonts you pick are loaded on the
  storefront.
- **Brand customization** — editable name, tagline, logo, WhatsApp number and
  currency symbol.
- **Product images** — upload an image file **or paste an image URL** (both work),
  directly from the admin panel.
- **Link preview** — when the site link is shared (WhatsApp, Facebook, Twitter),
  it shows the brand name + logo. The preview **title, description and image**
  are customizable from the admin panel (Brand & Theme).
- **Image limit** — at most 5 uploaded images are kept; when a 6th is uploaded,
  the **most-unused** image (not used by any product/logo/preview, oldest first)
  is deleted automatically.
- **Cart** — add to cart, adjust quantities, and order via WhatsApp chat.

## How it's organized

- `dev.js` — starts the server locally (`npm start`).
- `lib/app.js` — the Express application (all routes).
- `lib/env.js` — loads the root `.env` file (Postgres mode needs no dotenv).
- `lib/db.js` — Postgres layer: pool, schema creation, data + upload queries.
- `lib/store.js` — storage layer (Postgres ↔ Vercel Blob ↔ local JSON file).
- `api/index.js` — Vercel serverless entry point.
- `vercel.json` — routes pages + `/api/*` through the function, includes `views/**` and `public/**`.
- `views/` — the three HTML pages (served through Express so the current theme,
  fonts and link-preview tags are injected before first paint — no theme flash).
- `public/` — shared CSS, JS, and seed imagery (static assets).
  - `public/js/theme-engine.js` — theme color engine shared by server and admin
    panel: base tokens, presets, derived values (gradients, shadows, on-button
    color), contrast checks. One implementation, two runtimes.
  - `public/js/fonts.js` — the 32-font Google Fonts catalog (also shared):
    drives which fonts each page loads and how font ids map to CSS stacks.
- `data/db.json` — local database (local mode only; auto-created).
- `.env.example` — copy to `.env` and add `DATABASE_URL` to enable Postgres mode.

## Notes

- **Postgres mode:** everything (products, settings, images) lives in your
  database — `settings`, `products` and `uploads` tables, created automatically.
  Back up by exporting the database in the Neon dashboard → **History**, or use
  Neon's continuous backups. Your `.env` password is gitignored.
- **Local mode:** back up `data/db.json` and `public/uploads/`. Delete `data/db.json`
  to reset to the demo products.
- **Blob mode:** data lives at `alwazir/db.json` (private) and uploads at
  `alwazir/uploads/*` (public) in your Blob store. You can browse them in the
  Vercel dashboard → **Storage** → your Blob store.
- Blob writes propagate within ~60 seconds; this app reads the database with a
  short freshness window so admin changes show up quickly for everyone.
  (Postgres mode has no such window — reads are always live.)

/* Local development launcher (npm start / npm run dev). */

const app = require('./lib/app');
const store = require('./lib/store');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Load (and seed) the data store on startup.
store.getData().catch(() => {});

app.listen(PORT, HOST, () => {
  console.log(`Alwazir server running at http://${HOST}:${PORT}`);
  console.log(`Storage mode: ${store.storageMode()}`);
});

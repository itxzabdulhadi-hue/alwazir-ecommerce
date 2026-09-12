/* Vercel serverless entry point.
   vercel.json rewrites /api/* to this file, which re-exports the Express app
   from lib/app.js. The app receives the original request path (e.g. /api/login). */

module.exports = require('../lib/app');

/* ============================================================
   ALWAZIR — font catalog (single source of truth)
   Shared by the server (lib/app.js) and the admin panel.

   The server uses it to decide WHICH Google Fonts stylesheet each
   page loads — only the families actually in use (never the whole
   catalog). The admin panel uses it to render the font dropdowns
   (each option previews in its own typeface), to resolve the CSS
   font-family stacks, and to validate saved settings.

   To add a font later, append one entry to FONTS below — the
   dropdown, the loading, the validation and the presets all pick
   it up automatically.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlwazirFonts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_WEIGHTS = '400;500;600;700';

  /* id       — stored in settings (persisted)
     name     — shown in the admin dropdown
     family   — Google Fonts / CSS family name
     serif    — serif fallback stack
     mono     — monospace fallback stack
     w        — optional; Google Fonts weights to request
                (defaults to 400;500;600;700; a few families do not
                publish every weight, so pin those explicitly) */
  const FONTS = [
    { id: 'default', name: 'Default (Inter)', family: 'Inter' },
    { id: 'inter', name: 'Inter', family: 'Inter' },
    { id: 'roboto', name: 'Roboto', family: 'Roboto' },
    { id: 'opensans', name: 'Open Sans', family: 'Open Sans' },
    { id: 'lato', name: 'Lato', family: 'Lato', w: '400;700' },
    { id: 'poppins', name: 'Poppins', family: 'Poppins' },
    { id: 'montserrat', name: 'Montserrat', family: 'Montserrat' },
    { id: 'nunito', name: 'Nunito', family: 'Nunito' },
    { id: 'nunitosans', name: 'Nunito Sans', family: 'Nunito Sans' },
    { id: 'raleway', name: 'Raleway', family: 'Raleway' },
    { id: 'ubuntu', name: 'Ubuntu', family: 'Ubuntu', w: '300;400;500;700' },
    { id: 'merriweather', name: 'Merriweather', family: 'Merriweather', serif: true },
    { id: 'playfair', name: 'Playfair Display', family: 'Playfair Display', serif: true },
    { id: 'oswald', name: 'Oswald', family: 'Oswald' },
    { id: 'sourcesans3', name: 'Source Sans 3', family: 'Source Sans 3' },
    { id: 'sourceserif4', name: 'Source Serif 4', family: 'Source Serif 4', serif: true },
    { id: 'dmsans', name: 'DM Sans', family: 'DM Sans', w: '400;500;700' },
    { id: 'manrope', name: 'Manrope', family: 'Manrope' },
    { id: 'jakarta', name: 'Plus Jakarta Sans', family: 'Plus Jakarta Sans' },
    { id: 'worksans', name: 'Work Sans', family: 'Work Sans' },
    { id: 'firasans', name: 'Fira Sans', family: 'Fira Sans' },
    { id: 'firacode', name: 'Fira Code', family: 'Fira Code', mono: true },
    { id: 'plexsans', name: 'IBM Plex Sans', family: 'IBM Plex Sans' },
    { id: 'plexserif', name: 'IBM Plex Serif', family: 'IBM Plex Serif', serif: true },
    { id: 'librebaskerville', name: 'Libre Baskerville', family: 'Libre Baskerville', serif: true, w: '400;700' },
    { id: 'ptsans', name: 'PT Sans', family: 'PT Sans', w: '400;700' },
    { id: 'quicksand', name: 'Quicksand', family: 'Quicksand' },
    { id: 'rubik', name: 'Rubik', family: 'Rubik' },
    { id: 'cabin', name: 'Cabin', family: 'Cabin' },
    { id: 'barlow', name: 'Barlow', family: 'Barlow' },
    { id: 'archivo', name: 'Archivo', family: 'Archivo' },
    { id: 'lora', name: 'Lora', family: 'Lora', serif: true }
  ];

  function resolve(id) {
    return FONTS.find((f) => f.id === id) || FONTS[0];
  }

  function isValid(id) {
    return FONTS.some((f) => f.id === id);
  }

  /* 'default' means "the slot's default" — Inter for body text,
     Playfair Display for the brand/heading slots. */
  function resolveWithDefault(id, defaultId) {
    if (!id || id === 'default') return resolve(defaultId || 'default');
    return resolve(id);
  }

  function stackFor(entry) {
    const e = entry || {};
    const fam = "'" + (e.family || 'Inter') + "'";
    if (e.mono) return fam + ", ui-monospace, 'SF Mono', Consolas, monospace";
    if (e.serif) return fam + ", Georgia, 'Times New Roman', serif";
    if (e.family === 'Inter') return "'Inter', -apple-system, 'Segoe UI', sans-serif";
    return fam + ", 'Inter', -apple-system, 'Segoe UI', sans-serif";
  }

  function stack(id, defaultId) {
    return stackFor(resolveWithDefault(id, defaultId));
  }

  /* Unique family list (the 'default' entry shares Inter with 'inter'). */
  function allFamilies() {
    const seen = new Set();
    const out = [];
    for (const f of FONTS) {
      if (seen.has(f.family)) continue;
      seen.add(f.family);
      out.push(f);
    }
    return out;
  }

  /* One Google Fonts request for the given (deduplicated) entries. */
  function googleFontsUrl(entries) {
    const seen = new Set();
    const parts = [];
    for (const f of entries || []) {
      if (!f || seen.has(f.family)) continue;
      seen.add(f.family);
      parts.push('family=' + f.family.replace(/ /g, '+') + ':wght@' + (f.w || DEFAULT_WEIGHTS));
    }
    if (!parts.length) return '';
    return 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap';
  }

  return {
    FONTS,
    resolve,
    isValid,
    resolveWithDefault,
    stackFor,
    stack,
    allFamilies,
    googleFontsUrl
  };
});

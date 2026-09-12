/* ============================================================
   ALWAZIR — theme engine (single source of truth for colors)
   Shared by the server (lib/app.js) and the admin panel.

   The store's design system is a set of CSS custom properties
   (see public/css/style.css). The ten named themes (gold, rose,
   …) each override a small number of BASE tokens, and every
   other value (button gradient, soft tint, shadows, header
   background, on-button text color, input background) is DERIVED
   from those bases.

   This module mirrors that system in JavaScript so that:
   - the server can inject the resolved CSS variables into <head>
     before first paint (no theme flash),
   - the admin panel can offer a live-previewing color editor,
     presets and contrast warnings,
   - both always agree, because there is one implementation.

   Settings shape (db.settings):
   - theme       — the base named theme (see lib/store.js THEMES)
   - themeColors — null, or a full snapshot of the base tokens
                   below. When present it fully overrides the
                   named theme's colors.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlwazirTheme = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /* ---------- hex utilities ---------- */

  /* Accepts #RGB / #RRGGBB (with or without the #), case-insensitive.
     Returns a normalized lowercase #rrggbb string, or null. */
  function parseHex(raw) {
    if (typeof raw !== 'string') return null;
    let v = raw.trim().toLowerCase();
    if (v.charAt(0) === '#') v = v.slice(1);
    if (!/^[0-9a-f]{3}$/.test(v) && !/^[0-9a-f]{6}$/.test(v)) return null;
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    return '#' + v;
  }

  function hexToRgb(hex) {
    const v = (hex || '#000000').replace('#', '');
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  /* Mix toward white (t>0 → lighter) or black (t<0 → darker). */
  function mix(hex, t) {
    const { r, g, b } = hexToRgb(hex);
    const target = t >= 0 ? 255 : 0;
    const k = Math.abs(t);
    return rgbToHex(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
  }

  function lighten(hex, t) {
    return mix(hex, t);
  }

  function darken(hex, t) {
    return mix(hex, -t);
  }

  function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }

  /* WCAG relative luminance (0 = black, 1 = white). */
  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrastRatio(a, b) {
    const l1 = luminance(a);
    const l2 = luminance(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Pick the more readable label color for text on `hex`.
     Threshold 0.2 comes from equating the WCAG ratios of
     #1c1917 vs #ffffff against a color of luminance L. */
  function readableOn(hex) {
    return luminance(hex) >= 0.2 ? '#1c1917' : '#ffffff';
  }

  /* ---------- base tokens ---------- */

  /* The colors the admin can edit. `key` is stored in
     settings.themeColors, `var` is the CSS custom property the
     design system consumes (see public/css/style.css). */
  const TOKENS = [
    { key: 'primary', label: 'Primary', hint: 'Main brand color — links, focus, highlights' },
    { key: 'secondary', label: 'Secondary', hint: 'Stronger shade — prices and labels' },
    { key: 'accent', label: 'Accent tint', hint: 'Soft fill — pills, chips, hovers' },
    { key: 'background', label: 'Background', hint: 'Page background' },
    { key: 'surface', label: 'Surface / cards', hint: 'Cards, modals, panels' },
    { key: 'surfaceSoft', label: 'Soft surface', hint: 'Image tiles and subtle bands' },
    { key: 'text', label: 'Text', hint: 'Main text' },
    { key: 'muted', label: 'Muted text', hint: 'Secondary text and hints' },
    { key: 'border', label: 'Border', hint: 'Borders and dividers' },
    { key: 'button', label: 'Button', hint: 'Primary buttons (gradient auto-derived)' },
    { key: 'danger', label: 'Danger / badges', hint: 'Special offer badge, delete actions' }
  ];

  /* Presets. `named` presets map 1:1 to the existing named themes in
     lib/store.js THEMES (same ids, same values as the CSS rules);
     the rest are convenience palettes that only set themeColors. */
  const PRESETS = [
    {
      id: 'gold', name: 'Gold & White', named: true,
      tokens: { primary: '#c9a227', secondary: '#a9851a', accent: '#f6ecd2', background: '#ffffff', surface: '#ffffff', surfaceSoft: '#faf6ed', text: '#2b2418', muted: '#8c8170', border: '#eadfc6', button: '#c9a227', danger: '#b23a48' }
    },
    {
      id: 'rose', name: 'Rose Gold', named: true,
      tokens: { primary: '#c4708f', secondary: '#a8556f', accent: '#f7e3ea', background: '#ffffff', surface: '#ffffff', surfaceSoft: '#faf6ed', text: '#2b2418', muted: '#8c8170', border: '#eed7df', button: '#c4708f', danger: '#b23a48' }
    },
    {
      id: 'emerald', name: 'Emerald', named: true,
      tokens: { primary: '#1f7a5c', secondary: '#166048', accent: '#e1efe8', background: '#ffffff', surface: '#ffffff', surfaceSoft: '#faf6ed', text: '#2b2418', muted: '#8c8170', border: '#d7e6dd', button: '#1f7a5c', danger: '#b23a48' }
    },
    {
      id: 'midnight', name: 'Midnight Gold', named: true,
      tokens: { primary: '#d4af37', secondary: '#e6c96a', accent: '#2a2517', background: '#10130f', surface: '#1a1e19', surfaceSoft: '#161a15', text: '#f4efe3', muted: '#a79f8d', border: '#2c2b22', button: '#d4af37', danger: '#e06572' }
    },
    {
      id: 'ivory', name: 'Ivory', named: true,
      tokens: { primary: '#c9a227', secondary: '#a9851a', accent: '#f6ecd2', background: '#fbf7ef', surface: '#fffdf8', surfaceSoft: '#f5eddc', text: '#2b2418', muted: '#93856f', border: '#e7dcc3', button: '#c9a227', danger: '#b23a48' }
    },
    {
      id: 'royal', name: 'Royal Blue', named: true,
      tokens: { primary: '#274c8f', secondary: '#1d3a6e', accent: '#e4eaf6', background: '#ffffff', surface: '#ffffff', surfaceSoft: '#faf6ed', text: '#2b2418', muted: '#8c8170', border: '#d9e0ee', button: '#274c8f', danger: '#b23a48' }
    },
    {
      id: 'dark', name: 'Dark Black & Green', named: true,
      tokens: { primary: '#25d366', secondary: '#4ade80', accent: '#12301d', background: '#0a0e0b', surface: '#121913', surfaceSoft: '#10160f', text: '#eef5ec', muted: '#93a18e', border: '#223024', button: '#25d366', danger: '#ff7a85' }
    },
    {
      id: 'bw', name: 'Dark Black & White', named: true,
      tokens: { primary: '#ffffff', secondary: '#f2f2f2', accent: '#222222', background: '#0a0a0a', surface: '#121212', surfaceSoft: '#141414', text: '#ffffff', muted: '#b5b5b5', border: '#2c2c2c', button: '#ffffff', danger: '#ff7a85' }
    },
    {
      id: 'blackemerald', name: 'Black & Emerald', named: true,
      tokens: { primary: '#10b981', secondary: '#34d399', accent: '#0b2b1e', background: '#060a08', surface: '#0d140f', surfaceSoft: '#0b110e', text: '#e9f6ef', muted: '#94a89d', border: '#1c2f25', button: '#10b981', danger: '#ff7a85' }
    },
    {
      id: 'silveremerald', name: 'Silver & Emerald', named: true,
      tokens: { primary: '#0f9d72', secondary: '#0b7f5c', accent: '#dcebe4', background: '#f2f4f5', surface: '#fbfcfc', surfaceSoft: '#e7ebec', text: '#1e2a25', muted: '#6b7a73', border: '#d3ddd8', button: '#0f9d72', danger: '#c53a48' }
    },
    {
      id: 'ocean', name: 'Ocean',
      tokens: { primary: '#1f6fb2', secondary: '#14507f', accent: '#d8e9f6', background: '#f5f9fc', surface: '#ffffff', surfaceSoft: '#e8f1f8', text: '#122430', muted: '#5b7285', border: '#d4e2ee', button: '#1f6fb2', danger: '#c04455' }
    },
    {
      id: 'forest', name: 'Forest',
      tokens: { primary: '#2f7d4f', secondary: '#1f5c39', accent: '#dcefe2', background: '#f4f8f4', surface: '#ffffff', surfaceSoft: '#e9f2e9', text: '#17251a', muted: '#5f7a66', border: '#d5e4d8', button: '#2f7d4f', danger: '#b23a48' }
    },
    {
      id: 'purple', name: 'Purple',
      tokens: { primary: '#7c3aed', secondary: '#5b21b6', accent: '#ede4fb', background: '#faf8fd', surface: '#ffffff', surfaceSoft: '#f1ebfa', text: '#221a30', muted: '#71688a', border: '#e2d9ef', button: '#7c3aed', danger: '#c04455' }
    },
    {
      id: 'minimal', name: 'Minimal',
      tokens: { primary: '#111111', secondary: '#333333', accent: '#f0f0f1', background: '#ffffff', surface: '#ffffff', surfaceSoft: '#f7f7f8', text: '#111111', muted: '#6b7280', border: '#e5e7eb', button: '#111111', danger: '#dc2626' }
    },
    {
      id: 'professional', name: 'Professional',
      tokens: { primary: '#2563eb', secondary: '#1e40af', accent: '#dbeafe', background: '#f6f8fa', surface: '#ffffff', surfaceSoft: '#eef1f5', text: '#1f2937', muted: '#64748b', border: '#d9e0e8', button: '#2563eb', danger: '#dc2626' }
    }
  ];

  function presetById(id) {
    return PRESETS.find((p) => p.id === id) || PRESETS[0];
  }

  function defaultTokens() {
    return { ...PRESETS[0].tokens };
  }

  /* Effective token set for a set of settings: the base theme's
     values, with any saved custom colors layered on top. */
  function effectiveTokens(settings) {
    const merged = { ...presetById(settings && settings.theme).tokens };
    const custom = (settings && settings.themeColors) || {};
    for (const t of TOKENS) {
      const hex = parseHex(custom[t.key]);
      if (hex) merged[t.key] = hex;
    }
    return merged;
  }

  /* ---------- derived values ---------- */

  /* Values the design system derives from the base tokens
     (same formulas the hand-written CSS themes use). */
  function computeDerived(tokens) {
    const primary = tokens.primary || '#c9a227';
    const btn = tokens.button || primary;
    const bg = tokens.background || '#ffffff';
    const darkBg = luminance(bg) < 0.45;
    const s = hexToRgb(darken(primary, 0.25));
    const shadowBase = darkBg ? '0, 0, 0' : s.r + ', ' + s.g + ', ' + s.b;
    return {
      accentGhost: rgba(primary, 0.1),
      goldGradient:
        'linear-gradient(135deg, ' + lighten(btn, 0.38) + ' 0%, ' + btn + ' 45%, ' + darken(btn, 0.22) + ' 100%)',
      onAccent: readableOn(btn),
      shadow: '0 24px 60px rgba(' + shadowBase + ', ' + (darkBg ? 0.5 : 0.16) + ')',
      shadowSm: '0 8px 24px rgba(' + shadowBase + ', ' + (darkBg ? 0.45 : 0.13) + ')',
      headerBg: rgba(bg, 0.9),
      inputBg: tokens.surface || '#ffffff'
    };
  }

  /* Full CSS variable set for a token map (17 variables). */
  function colorVars(tokens) {
    const d = computeDerived(tokens);
    return {
      '--accent': tokens.primary,
      '--accent-strong': tokens.secondary,
      '--accent-soft': tokens.accent,
      '--accent-ghost': d.accentGhost,
      '--bg': tokens.background,
      '--bg-soft': tokens.surfaceSoft,
      '--card': tokens.surface,
      '--text': tokens.text,
      '--muted': tokens.muted,
      '--border': tokens.border,
      '--gold-gradient': d.goldGradient,
      '--on-accent': d.onAccent,
      '--shadow': d.shadow,
      '--shadow-sm': d.shadowSm,
      '--header-bg': d.headerBg,
      '--input-bg': d.inputBg,
      '--danger': tokens.danger
    };
  }

  function applyVars(el, vars) {
    for (const k in vars) el.style.setProperty(k, vars[k]);
  }

  /* ---------- accessibility: contrast warnings ---------- */

  /* Non-blocking warnings for low-contrast combinations. Returns
     [{ label, ratio }] — the admin is told, never overridden. */
  function contrastWarnings(tokens) {
    const out = [];
    const check = (label, a, b, min) => {
      if (!parseHex(a) || !parseHex(b)) return;
      const r = contrastRatio(a, b);
      if (r < min) out.push({ label, ratio: Math.round(r * 100) / 100, min });
    };
    check('Text on background', tokens.text, tokens.background, 4.5);
    check('Muted text on background', tokens.muted, tokens.background, 3);
    const btn = tokens.button || tokens.primary;
    check('Button label on button', readableOn(btn), btn, 4.5);
    return out;
  }

  return {
    TOKENS,
    PRESETS,
    presetById,
    defaultTokens,
    effectiveTokens,
    computeDerived,
    colorVars,
    applyVars,
    contrastWarnings,
    parseHex,
    hexToRgb,
    rgbToHex,
    lighten,
    darken,
    rgba,
    luminance,
    contrastRatio,
    readableOn
  };
});

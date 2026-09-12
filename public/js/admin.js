/* ============================================================
   ALWAZIR — admin panel logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Alwazir.boot();

  /* Theme editor shared modules (see public/js/* — same code the
     server uses to render each page). */
  const T = window.AlwazirTheme;
  const F = window.AlwazirFonts;
  const HAS_THEME_EDITOR = !!(T && F);

  const AUTH_KEY = 'alwazir-admin-key';
  const loginScreen = document.querySelector('[data-login-screen]');
  const dashboard = document.querySelector('[data-dashboard]');
  const loginForm = document.querySelector('[data-login-form]');
  const productList = document.querySelector('[data-product-list]');

  let products = [];
  let settings = {};
  let editingImageUrl = null; // holds chosen image while editing a product
  let pendingLogoUrl = null;
  let pendingShareImageUrl = null;

  function getAuth() {
    return localStorage.getItem(AUTH_KEY);
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-key': getAuth() || '' };
  }

  // Resolve a named form control safely (avoids collisions with
  // HTMLFormElement built-in props like .name and .id).
  function field(form, name) {
    return form.elements.namedItem(name);
  }

  // Accepts a full http(s) URL or a root-relative path like /uploads/x.png.
  function validImageUrl(raw) {
    const v = (raw || '').trim();
    if (!v) return false;
    if (v.charAt(0) === '/') return true;
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /* ---------- auth flow ---------- */
  function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
    localStorage.removeItem(AUTH_KEY);
  }

  async function tryBootstrap() {
    const key = getAuth();
    if (!key) return showLogin();
    try {
      const res = await fetch('/api/admin', { headers: { 'x-admin-key': key } });
      if (!res.ok) return showLogin();
      const data = await res.json();
      settings = data.settings;
      products = data.products;
      enterDashboard();
    } catch (e) {
      showLogin();
    }
  }

  function enterDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    renderAll();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = field(loginForm, 'key').value.trim();
    if (!key) {
      Alwazir.toast('Please enter the password');
      return;
    }
    let res;
    try {
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
    } catch (err) {
      Alwazir.toast('Could not reach the server. Is the site deployed correctly?');
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg =
        res.status === 401
          ? 'Incorrect password'
          : data.error || `Login failed (HTTP ${res.status})`;
      Alwazir.toast(msg);
      return;
    }

    localStorage.setItem(AUTH_KEY, key);
    try {
      const adminRes = await fetch('/api/admin', { headers: { 'x-admin-key': key } });
      if (!adminRes.ok) {
        const errData = await adminRes.json().catch(() => ({}));
        Alwazir.toast(errData.error || `Could not load data (HTTP ${adminRes.status})`);
        return;
      }
      const data = await adminRes.json();
      settings = data.settings;
      products = data.products;
      enterDashboard();
    } catch (err) {
      Alwazir.toast('Could not load admin data. Is the server running?');
    }
  });

  document.querySelector('[data-logout]').addEventListener('click', () => {
    showLogin();
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('[data-panel]').forEach((p) => p.classList.add('hidden'));
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
    });
  });

  /* ---------- render ---------- */
  function renderAll() {
    renderProducts();
    renderBrandForm();
    renderMobileToggle();
    renderBoldToggle();
    renderLogoPreview();
    syncThemeEditor();
  }

  function renderProducts() {
    if (products.length === 0) {
      productList.innerHTML =
        '<div class="empty-state"><div class="big">&#128722;</div><h3>No products yet</h3><p>Click "Add Product" to create your first fragrance.</p></div>';
      return;
    }
    productList.innerHTML = products
      .map(
        (p) => `
      <div class="admin-product-row" data-id="${p.id}">
        ${
          p.image
            ? `<img class="admin-product-thumb" src="${p.image}" alt="">`
            : `<div class="admin-product-thumb media-placeholder" style="font-size:1.4rem">${(p.name || '?').charAt(0).toUpperCase()}</div>`
        }
        <div class="admin-product-main">
          <div class="name">${Alwazir.escapeHtml(p.name)}</div>
          <div class="meta">${Alwazir.escapeHtml(p.category || 'General')} &middot; ${Alwazir.formatMoney(p.price)}</div>
        </div>
        <button class="toggle-chip ${p.popular ? 'on' : ''}" data-toggle="popular" title="Toggle popular pin">&#9733; Popular</button>
        <button class="toggle-chip ${p.special ? 'special-on' : ''}" data-toggle="special" title="Toggle special offer">&#10024; Special</button>
        <div class="row-actions">
          <button class="icon-btn" data-edit title="Edit">&#9998;</button>
          <button class="icon-btn delete" data-delete title="Delete">&#128465;</button>
        </div>
      </div>`
      )
      .join('');
  }

  function renderBrandForm() {
    const form = document.querySelector('[data-brand-form]');
    field(form, 'brandName').value = settings.brandName || '';
    field(form, 'tagline').value = settings.tagline || '';
    field(form, 'currency').value = settings.currency || '$';
    field(form, 'whatsapp').value = settings.whatsapp || '';
    field(form, 'shareTitle').value = settings.shareTitle || '';
    field(form, 'shareDescription').value = settings.shareDescription || '';
    const shareUrl = document.querySelector('[data-share-image-url]');
    if (shareUrl) shareUrl.value = settings.shareImage || '';
    const sharePrev = document.querySelector('[data-share-image-preview]');
    if (sharePrev) {
      if (settings.shareImage) {
        sharePrev.src = settings.shareImage;
        sharePrev.classList.remove('hidden');
      } else {
        sharePrev.classList.add('hidden');
        sharePrev.removeAttribute('src');
      }
    }
  }

  function renderMobileToggle() {
    const mode = settings.mobileColumns === 'single' ? 'single' : 'double';
    document.querySelectorAll('[data-mobile-toggle] .mode-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.mode === mode);
    });
  }

  function renderBoldToggle() {
    const bold = settings.textBold ? 'true' : 'false';
    document.querySelectorAll('[data-bold-toggle] .mode-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.bold === bold);
    });
  }

  function renderLogoPreview() {
    const img = document.querySelector('[data-logo-preview]');
    if (settings.logo) {
      img.src = settings.logo;
      img.classList.remove('hidden');
    } else {
      img.classList.add('hidden');
    }
    const urlInput = document.querySelector('[data-logo-url]');
    if (urlInput) urlInput.value = settings.logo || '';
  }

  /* ============================================================
     THEME EDITOR — presets, colors, fonts, live preview, reset.
     State lives in `editor`; Save Changes ships it to /api/settings.
     Every change is applied live to <html> (the same CSS variables
     the storefront consumes), so the whole admin page + the preview
     panel re-skin instantly.
     ============================================================ */

  const editor = {
    theme: 'gold',
    colors: T ? T.defaultTokens() : {},
    bodyFont: 'default',
    brandFont: 'default',
    headingFont: 'playfair',
    dirty: false
  };

  const presetRow = document.querySelector('[data-preset-row]');
  const colorGrid = document.querySelector('[data-color-grid]');
  const contrastWarn = document.querySelector('[data-contrast-warn]');
  const unsavedEl = document.querySelector('[data-unsaved]');
  const fontSlotEls = document.querySelectorAll('[data-font-slot]');

  const FONT_SLOTS = [
    { slot: 'body', key: 'bodyFont', label: 'Body font', hint: 'All store text.', defaultId: 'default' },
    { slot: 'brand', key: 'brandFont', label: 'Brand name font', hint: 'Brand name and hero title.', defaultId: 'playfair' },
    { slot: 'heading', key: 'headingFont', label: 'Heading font', hint: 'Section titles, product names, prices.', defaultId: 'playfair' }
  ];

  function defaultNameFor(defaultId) {
    const d = F.resolve(defaultId);
    return 'Default (' + d.name.replace(' (Inter)', '') + ')';
  }

  function syncThemeEditor() {
    if (!HAS_THEME_EDITOR) return;
    editor.theme = settings.theme || 'gold';
    editor.colors = T.effectiveTokens(settings);
    editor.bodyFont = settings.fontFamily || 'default';
    editor.brandFont = settings.brandFont || 'default';
    editor.headingFont = settings.headingFont || 'playfair';
    editor.dirty = false;
    renderPresets();
    renderColors();
    renderFontSelectors();
    applyThemeLive();
    updateUnsaved();
  }

  /* ---------- presets ---------- */
  function renderPresets() {
    if (!presetRow) return;
    presetRow.innerHTML = T.PRESETS.map((p) => {
      const t = p.tokens;
      return (
        '<button type="button" class="preset-chip' + (p.named && p.id === editor.theme ? ' selected' : '') +
        '" data-preset="' + p.id + '" title="' + Alwazir.escapeHtml(p.name) + '">' +
        '<span class="preset-swatches"><i style="background:' + t.background + '"></i>' +
        '<i style="background:' + t.surface + '"></i><i style="background:' + t.primary + '"></i></span>' +
        Alwazir.escapeHtml(p.name) + '</button>'
      );
    }).join('');
  }

  if (presetRow) {
    presetRow.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-preset]');
      if (!chip) return;
      const p = T.presetById(chip.dataset.preset);
      editor.theme = p.named ? p.id : editor.theme;
      editor.colors = { ...p.tokens };
      markDirty();
      renderPresets();
      renderColors();
      applyThemeLive();
    });
  }

  /* ---------- color pickers ---------- */
  function renderColors() {
    if (!colorGrid) return;
    colorGrid.innerHTML = T.TOKENS.map((t) =>
      '<div class="cp" data-token="' + t.key + '">' +
      '<div class="cp-top">' +
      '<label class="cp-label" for="cp-hex-' + t.key + '">' + t.label + '</label>' +
      '<span class="cp-hint">' + t.hint + '</span>' +
      '</div>' +
      '<div class="cp-control">' +
      '<input type="color" class="cp-swatch" data-swatch value="' + editor.colors[t.key] + '" aria-label="' + t.label + ' color picker">' +
      '<input type="text" class="cp-hex" id="cp-hex-' + t.key + '" value="' + editor.colors[t.key].toUpperCase() +
      '" spellcheck="false" autocomplete="off" aria-invalid="false" aria-describedby="cp-err-' + t.key + '">' +
      '</div>' +
      '<span class="cp-err" id="cp-err-' + t.key + '" hidden>Use a hex color like #8B5CF6 or #F00</span>' +
      '</div>'
    ).join('');
    wireColorControls();
  }

  function wireColorControls() {
    if (!colorGrid) return;
    colorGrid.querySelectorAll('[data-token]').forEach((row) => {
      const key = row.dataset.token;
      const swatch = row.querySelector('[data-swatch]');
      const hexInput = row.querySelector('.cp-hex');
      const err = row.querySelector('.cp-err');

      const setValid = (valid) => {
        hexInput.classList.toggle('invalid', !valid);
        hexInput.setAttribute('aria-invalid', valid ? 'false' : 'true');
        err.hidden = valid;
      };

      // Native picker (clicking the swatch opens it) — fires while
      // dragging, so the preview follows the selection live.
      swatch.addEventListener('input', () => {
        editor.colors[key] = swatch.value;
        hexInput.value = swatch.value.toUpperCase();
        setValid(true);
        markDirty();
        applyThemeLive();
      });

      // HEX field — validate on every keystroke; apply immediately
      // when the value is valid (#RGB or #RRGGBB, # optional).
      hexInput.addEventListener('input', () => {
        const norm = T.parseHex(hexInput.value);
        if (norm) {
          editor.colors[key] = norm;
          swatch.value = norm;
          setValid(true);
          markDirty();
          applyThemeLive();
        } else {
          setValid(false);
        }
      });

      // Leaving an invalid value behind restores the last good one.
      hexInput.addEventListener('blur', () => {
        if (!T.parseHex(hexInput.value)) {
          hexInput.value = editor.colors[key].toUpperCase();
          swatch.value = editor.colors[key];
          setValid(true);
        }
      });
    });
  }

  /* ---------- font selectors (comboboxes) ---------- */
  function renderFontSelectors() {
    if (!HAS_THEME_EDITOR) return;
    fontSlotEls.forEach((el) => {
      const meta = FONT_SLOTS.find((s) => s.slot === el.dataset.fontSlot);
      if (!meta) return;
      const currentId = editor[meta.key];
      const current = F.resolveWithDefault(currentId, meta.defaultId);
      const btnName = currentId === 'default' ? defaultNameFor(meta.defaultId) : current.name;
      const stack = F.stackFor(current);
      el.innerHTML =
        '<div class="fs-top">' +
        '<label for="fs-btn-' + meta.slot + '">' + meta.label + '</label>' +
        '<span class="cp-hint">' + meta.hint + '</span>' +
        '</div>' +
        '<div class="fs-combo">' +
        '<button type="button" class="fs-btn" id="fs-btn-' + meta.slot + '" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="fs-btn-name" style="font-family:' + stack + '">' + Alwazir.escapeHtml(btnName) + '</span>' +
        '<span class="fs-caret" aria-hidden="true">&#9662;</span>' +
        '</button>' +
        '<div class="fs-listbox" role="listbox" id="fs-list-' + meta.slot + '" aria-labelledby="fs-btn-' + meta.slot + '" tabindex="-1" hidden>' +
        F.FONTS.map((f) => {
          const isSel = f.id === (currentId === 'default' ? 'default' : currentId);
          const optName = f.id === 'default' ? defaultNameFor(meta.defaultId) : f.name;
          return (
            '<div class="fs-option' + (isSel ? ' selected' : '') + '" role="option" id="fs-opt-' + meta.slot + '-' + f.id +
            '" data-font-id="' + f.id + '" aria-selected="' + isSel + '">' +
            '<span class="fs-opt-sample" style="font-family:' + F.stackFor(f) + '">Ag</span>' +
            '<span class="fs-opt-name">' + Alwazir.escapeHtml(optName) + '</span>' +
            (isSel ? '<span class="fs-check" aria-hidden="true">&#10003;</span>' : '') +
            '</div>'
          );
        }).join('') +
        '</div>' +
        '</div>' +
        '<p class="fs-preview" style="font-family:' + stack + '">The quick brown fox jumps over the lazy dog — 0123</p>';
      wireCombo(el, meta);
    });
  }

  function wireCombo(rootEl, meta) {
    const btn = rootEl.querySelector('.fs-btn');
    const list = rootEl.querySelector('.fs-listbox');
    if (!btn || !list) return;
    let active = null;
    const options = () => Array.from(list.querySelectorAll('.fs-option'));

    function close(refocus) {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      list.removeAttribute('aria-activedescendant');
      if (refocus !== false) btn.focus();
    }

    function setActive(opt) {
      if (!opt) return;
      active = opt;
      list.setAttribute('aria-activedescendant', opt.id);
      options().forEach((o) => o.classList.toggle('active', o === opt));
      opt.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      const opts = options();
      setActive(list.querySelector('.fs-option.selected') || opts[0]);
      list.focus();
    }

    btn.addEventListener('click', () => (list.hidden ? open() : close()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    list.addEventListener('keydown', (e) => {
      const opts = options();
      const i = opts.indexOf(active);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(opts[Math.min(i + 1, opts.length - 1)]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(i > 0 ? opts[i - 1] : opts[0]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(opts[0]);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(opts[opts.length - 1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (active) chooseFont(meta, active.dataset.fontId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab') {
        close(false);
      }
    });

    list.addEventListener('click', (e) => {
      const opt = e.target.closest('.fs-option');
      if (!opt) return;
      chooseFont(meta, opt.dataset.fontId);
    });
  }

  function chooseFont(meta, id) {
    editor[meta.key] = id;
    markDirty();
    renderFontSelectors(); // button label, preview line and check marks
    applyThemeLive();
    const newBtn = document.getElementById('fs-btn-' + meta.slot);
    if (newBtn) newBtn.focus();
  }

  /* One shared handler closes any open listbox when clicking outside
     its combobox (the slots re-render on selection, so per-instance
     document listeners would leak). */
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.fs-listbox:not([hidden])').forEach((list) => {
      const combo = list.closest('.fs-combo');
      if (combo && !combo.contains(e.target)) {
        const btn = combo.querySelector('.fs-btn');
        list.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        list.removeAttribute('aria-activedescendant');
      }
    });
  });

  /* ---------- live preview (whole admin page + preview panel) ---------- */
  function applyThemeLive() {
    if (!HAS_THEME_EDITOR) return;
    const d = document.documentElement;
    d.setAttribute('data-theme', editor.theme); // base named theme
    d.setAttribute('data-custom-theme', '1');
    T.applyVars(d, T.colorVars(editor.colors)); // 17 resolved color vars
    d.style.setProperty('--font-body', F.stack(editor.bodyFont, 'default'));
    d.style.setProperty('--font-brand', F.stack(editor.brandFont, 'playfair'));
    d.style.setProperty('--font-display', F.stack(editor.headingFont, 'playfair'));
    updateContrast();
  }

  /* Non-blocking contrast warnings — informs, never overrides. */
  function updateContrast() {
    if (!contrastWarn) return;
    const issues = T.contrastWarnings(editor.colors);
    if (!issues.length) {
      contrastWarn.hidden = true;
      contrastWarn.innerHTML = '';
      return;
    }
    contrastWarn.hidden = false;
    contrastWarn.innerHTML = issues
      .map(
        (w) =>
          '<span>&#9888; ' + Alwazir.escapeHtml(w.label) + ' — contrast ' + w.ratio + ':1 is low (recommended at least ' +
          w.min + ':1). You can keep it if it looks right for your store.</span>'
      )
      .join('');
  }

  /* ---------- unsaved indicator ---------- */
  function markDirty() {
    editor.dirty = true;
    updateUnsaved();
  }

  function updateUnsaved() {
    if (unsavedEl) unsavedEl.hidden = !editor.dirty;
  }

  /* What to send: a full token snapshot, unless it matches the
     selected named theme exactly (then keep the pure base theme). */
  function themeColorsPayload() {
    if (!HAS_THEME_EDITOR) return null;
    const p = T.presetById(editor.theme);
    const identical = p.named && T.TOKENS.every((t) => (editor.colors[t.key] || '').toLowerCase() === (p.tokens[t.key] || '').toLowerCase());
    return identical ? null : { ...editor.colors };
  }

  /* ---------- reset to default ---------- */
  const resetBtn = document.querySelector('[data-reset-theme]');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset the theme to default?\n\nThis restores the original Gold & White colors and the original fonts.')) return;
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            theme: 'gold',
            themeColors: null,
            fontFamily: 'default',
            brandFont: 'default',
            headingFont: 'playfair'
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          Alwazir.toast(data.error || 'Could not reset theme');
          return;
        }
        Alwazir.toast('Theme reset to default');
        await refresh(); // re-reads settings → editor + preview re-sync
      } catch (err) {
        Alwazir.toast('Could not reset theme');
      }
    });
  }

  /* ---------- product CRUD ---------- */
  async function refresh() {
    const res = await fetch('/api/admin', { headers: { 'x-admin-key': getAuth() } });
    if (res.ok) {
      const data = await res.json();
      settings = data.settings;
      products = data.products;
      renderAll();
    }
  }

  function openProductModal(product = null) {
    const modal = document.querySelector('[data-modal-overlay]');
    const form = document.querySelector('[data-product-form]');
    editingImageUrl = product ? product.image : null;
    form.reset();
    field(form, 'id').value = product ? product.id : '';
    document.querySelector('[data-modal-title]').textContent = product ? 'Edit Product' : 'Add Product';
    field(form, 'name').value = product ? product.name : '';
    field(form, 'category').value = product ? (product.category || '') : '';
    field(form, 'price').value = product ? product.price : '';
    field(form, 'description').value = product ? (product.description || '') : '';
    field(form, 'popular').checked = product ? !!product.popular : false;
    field(form, 'special').checked = product ? !!product.special : false;
    const urlInput = document.querySelector('[data-image-url]');
    if (urlInput) urlInput.value = (product && product.image) || '';
    const preview = document.querySelector('[data-image-preview]');
    if (product && product.image) {
      preview.src = product.image;
      preview.classList.remove('hidden');
    } else {
      preview.classList.add('hidden');
      preview.removeAttribute('src');
    }
    modal.classList.remove('hidden');
  }

  function closeProductModal() {
    document.querySelector('[data-modal-overlay]').classList.add('hidden');
  }

  document.querySelector('[data-add-product]').addEventListener('click', () => openProductModal());
  document.querySelector('[data-modal-close]').addEventListener('click', closeProductModal);
  document.querySelector('[data-modal-overlay]').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  // image upload within product modal
  const imageDrop = document.querySelector('[data-image-drop]');
  const imageFile = document.querySelector('[data-image-file]');
  const imageUrlInput = document.querySelector('[data-image-url]');
  imageDrop.addEventListener('click', () => imageFile.click());
  imageFile.addEventListener('change', async () => {
    const file = imageFile.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      editingImageUrl = url;
      const preview = document.querySelector('[data-image-preview]');
      preview.src = url;
      preview.classList.remove('hidden');
      if (imageUrlInput) imageUrlInput.value = url;
      Alwazir.toast('Image uploaded');
    }
  });
  imageUrlInput.addEventListener('change', () => {
    const v = imageUrlInput.value.trim();
    if (!v) return;
    if (!validImageUrl(v)) {
      Alwazir.toast('Please enter a valid image URL (https://…)');
      return;
    }
    editingImageUrl = v;
    const preview = document.querySelector('[data-image-preview]');
    preview.src = v;
    preview.classList.remove('hidden');
    imageFile.value = '';
    Alwazir.toast('Image URL applied');
  });

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'x-admin-key': getAuth() }, body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alwazir.toast(err.error || 'Upload failed');
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch (e) {
      Alwazir.toast('Upload failed');
      return null;
    }
  }

  document.querySelector('[data-product-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: field(form, 'name').value,
      category: field(form, 'category').value,
      price: field(form, 'price').value,
      description: field(form, 'description').value,
      popular: field(form, 'popular').checked,
      special: field(form, 'special').checked,
      image: editingImageUrl || ''
    };
    const id = field(form, 'id').value;
    try {
      const res = await fetch(id ? `/api/products/${id}` : '/api/products', {
        method: id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alwazir.toast(data.error || 'Could not save product');
        return;
      }
      Alwazir.toast(id ? 'Product updated' : 'Product added');
      closeProductModal();
      await refresh();
    } catch (err) {
      Alwazir.toast('Could not save product');
    }
  });

  // list interactions (delegated)
  productList.addEventListener('click', async (e) => {
    const row = e.target.closest('.admin-product-row');
    if (!row) return;
    const id = row.dataset.id;
    const product = products.find((p) => p.id === id);

    if (e.target.closest('[data-toggle]')) {
      const which = e.target.closest('[data-toggle]').dataset.toggle;
      const patch = {
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description,
        image: product.image,
        popular: product.popular,
        special: product.special
      };
      patch[which] = !product[which];
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch)
      });
      if (res.ok) {
        Alwazir.toast(which === 'popular' ? 'Popular pin updated' : 'Special offer updated');
        await refresh();
      }
    } else if (e.target.closest('[data-edit]')) {
      openProductModal(product);
    } else if (e.target.closest('[data-delete]')) {
      if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': getAuth() }
      });
      if (res.ok) {
        Alwazir.toast('Product deleted');
        await refresh();
      }
    }
  });

  /* ---------- brand form (identity + theme) ---------- */
  document.querySelector('[data-brand-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      brandName: field(form, 'brandName').value,
      tagline: field(form, 'tagline').value,
      currency: field(form, 'currency').value,
      whatsapp: field(form, 'whatsapp').value,
      shareTitle: field(form, 'shareTitle').value,
      shareDescription: field(form, 'shareDescription').value,
      theme: HAS_THEME_EDITOR ? editor.theme : 'gold',
      themeColors: themeColorsPayload(),
      mobileColumns: document.querySelector('[data-mobile-toggle] .mode-card.selected')?.dataset.mode || 'double',
      fontFamily: HAS_THEME_EDITOR ? editor.bodyFont : 'default',
      brandFont: HAS_THEME_EDITOR ? editor.brandFont : 'default',
      headingFont: HAS_THEME_EDITOR ? editor.headingFont : 'playfair',
      textBold: document.querySelector('[data-bold-toggle] .mode-card.selected')?.dataset.bold === 'true'
    };
    if (pendingLogoUrl) payload.logo = pendingLogoUrl;
    if (pendingShareImageUrl) payload.shareImage = pendingShareImageUrl;
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alwazir.toast(data.error || 'Could not save settings');
        return;
      }
      settings = data;
      pendingLogoUrl = null;
      pendingShareImageUrl = null;
      Alwazir.toast('Settings saved');
      renderAll();
      // refresh the storefront theme/font cache and re-apply
      await Alwazir.refreshSettings();
    } catch (err) {
      Alwazir.toast('Could not save settings');
    }
  });

  document.querySelector('[data-mobile-toggle]').addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    document.querySelectorAll('[data-mobile-toggle] .mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
  });

  document.querySelector('[data-bold-toggle]').addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    document.querySelectorAll('[data-bold-toggle] .mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    // live preview the weight on the admin page
    document.documentElement.setAttribute('data-bold', card.dataset.bold === 'true' ? 'true' : 'false');
  });

  const logoDrop = document.querySelector('[data-logo-drop]');
  const logoFile = document.querySelector('[data-logo-file]');
  const logoUrlInput = document.querySelector('[data-logo-url]');
  logoDrop.addEventListener('click', () => logoFile.click());
  logoFile.addEventListener('change', async () => {
    const file = logoFile.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      pendingLogoUrl = url;
      const preview = document.querySelector('[data-logo-preview]');
      preview.src = url;
      preview.classList.remove('hidden');
      if (logoUrlInput) logoUrlInput.value = url;
      Alwazir.toast('Logo uploaded — click Save Changes to apply');
    }
  });
  logoUrlInput.addEventListener('change', () => {
    const v = logoUrlInput.value.trim();
    if (!v) return;
    if (!validImageUrl(v)) {
      Alwazir.toast('Please enter a valid logo URL (https://…)');
      return;
    }
    pendingLogoUrl = v;
    const preview = document.querySelector('[data-logo-preview]');
    preview.src = v;
    preview.classList.remove('hidden');
    logoFile.value = '';
    Alwazir.toast('Logo URL applied — click Save Changes to apply');
  });

  // Link-preview (share) image: upload or URL
  const shareImageDrop = document.querySelector('[data-share-image-drop]');
  const shareImageFile = document.querySelector('[data-share-image-file]');
  const shareImageUrlInput = document.querySelector('[data-share-image-url]');
  shareImageDrop.addEventListener('click', () => shareImageFile.click());
  shareImageFile.addEventListener('change', async () => {
    const file = shareImageFile.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) {
      pendingShareImageUrl = url;
      const preview = document.querySelector('[data-share-image-preview]');
      preview.src = url;
      preview.classList.remove('hidden');
      if (shareImageUrlInput) shareImageUrlInput.value = url;
      Alwazir.toast('Preview image uploaded — click Save Changes to apply');
    }
  });
  shareImageUrlInput.addEventListener('change', () => {
    const v = shareImageUrlInput.value.trim();
    if (!v) return;
    if (!validImageUrl(v)) {
      Alwazir.toast('Please enter a valid preview image URL (https://…)');
      return;
    }
    pendingShareImageUrl = v;
    const preview = document.querySelector('[data-share-image-preview]');
    preview.src = v;
    preview.classList.remove('hidden');
    shareImageFile.value = '';
    Alwazir.toast('Preview image URL applied — click Save Changes to apply');
  });

  /* ---------- security ---------- */
  document.querySelector('[data-security-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const key = field(form, 'adminKey').value.trim();
    if (!key) {
      Alwazir.toast('Enter a new password');
      return;
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ adminKey: key })
      });
      if (!res.ok) {
        Alwazir.toast('Could not update password');
        return;
      }
      localStorage.setItem(AUTH_KEY, key);
      form.reset();
      Alwazir.toast('Password updated');
    } catch (err) {
      Alwazir.toast('Could not update password');
    }
  });

  /* ---------- start ---------- */
  await tryBootstrap();
});

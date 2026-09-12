/* ============================================================
   ALWAZIR — admin panel logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Alwazir.boot();

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
    renderThemePicker();
    renderMobileToggle();
    renderFontPicker();
    renderBrandFontPicker();
    renderBoldToggle();
    renderLogoPreview();
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

  function renderThemePicker() {
    document.querySelectorAll('[data-theme-grid] .theme-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.theme === settings.theme);
    });
  }

  function renderMobileToggle() {
    const mode = settings.mobileColumns === 'single' ? 'single' : 'double';
    document.querySelectorAll('[data-mobile-toggle] .mode-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.mode === mode);
    });
  }

  function renderFontPicker() {
    const font = settings.fontFamily || 'default';
    document.querySelectorAll('[data-font-grid] .font-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.font === font);
    });
  }

  function renderBrandFontPicker() {
    const font = settings.brandFont || 'default';
    document.querySelectorAll('[data-brand-font-grid] .font-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.brandFont === font);
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

  /* ---------- brand form ---------- */
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
      theme: document.querySelector('.theme-card.selected')?.dataset.theme || 'gold',
      mobileColumns: document.querySelector('[data-mobile-toggle] .mode-card.selected')?.dataset.mode || 'double',
      fontFamily: document.querySelector('[data-font-grid] .font-card.selected')?.dataset.font || 'default',
      brandFont: document.querySelector('[data-brand-font-grid] .font-card.selected')?.dataset.brandFont || 'default',
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
      // refresh the storefront theme/font/bold cache and re-apply
      await Alwazir.refreshSettings();
    } catch (err) {
      Alwazir.toast('Could not save settings');
    }
  });

  document.querySelector('[data-theme-grid]').addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (!card) return;
    document.querySelectorAll('[data-theme-grid] .theme-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    // live preview the theme on the admin page
    document.documentElement.setAttribute('data-theme', card.dataset.theme);
  });

  document.querySelector('[data-mobile-toggle]').addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    document.querySelectorAll('[data-mobile-toggle] .mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
  });

  document.querySelector('[data-font-grid]').addEventListener('click', (e) => {
    const card = e.target.closest('.font-card');
    if (!card) return;
    document.querySelectorAll('[data-font-grid] .font-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    // live preview the font on the admin page
    const font = card.dataset.font;
    if (font && font !== 'default') document.documentElement.setAttribute('data-font', font);
    else document.documentElement.removeAttribute('data-font');
  });

  document.querySelector('[data-brand-font-grid]').addEventListener('click', (e) => {
    const card = e.target.closest('.font-card');
    if (!card) return;
    document.querySelectorAll('[data-brand-font-grid] .font-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    // live preview the brand name font on the admin page
    const font = card.dataset.brandFont;
    if (font && font !== 'default') document.documentElement.setAttribute('data-brand-font', font);
    else document.documentElement.removeAttribute('data-brand-font');
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
      Alwazir.toast('Please enter a valid image URL (https://…)');
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

/* ============================================================
   ALWAZIR — shared storefront logic (theme, cart, rendering)
   ============================================================ */

const Alwazir = (() => {
  let settings = { brandName: 'alwazir', tagline: '', logo: '', currency: '$', theme: 'gold', whatsapp: '923174541414', mobileColumns: 'double', fontFamily: 'default', brandFont: 'default', textBold: false };

  /* ---------- whatsapp ---------- */
  const WHATSAPP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function whatsappNumber() {
    const raw = (settings.whatsapp || '923174541414').toString();
    const digits = raw.replace(/\D/g, '');
    return digits || '923174541414';
  }

  function openWhatsApp(text) {
    const url = `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  }

  function chatAboutProduct(product) {
    if (!product) return;
    const brand = settings.brandName || 'alwazir';
    const lines = [];
    lines.push(`🛍️ *New Order — ${brand}*`);
    lines.push('');
    lines.push(`1. ${product.name}`);
    lines.push(`💰 Price: ${formatMoney(product.price)}`);
    lines.push('');
    lines.push(`💳 *Total: ${formatMoney(product.price)}*`);
    openWhatsApp(lines.join('\n'));
  }

  /* ---------- currency formatting ---------- */
  function formatMoney(price) {
    const symbol = settings.currency || '$';
    const num = Number(price) || 0;
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  /* ---------- settings & theme ---------- */
  async function loadSettings() {
    // 1. Server-injected preload (set before first paint) — apply instantly.
    if (window.__ALWAZIR_SETTINGS__) {
      settings = { ...settings, ...window.__ALWAZIR_SETTINGS__ };
      applySettings();
    }
    // 2. Then fetch the freshest values from the API.
    try {
      const res = await fetch('/api/settings');
      if (res.ok) settings = { ...settings, ...(await res.json()) };
    } catch (e) {
      /* offline fallback */
    }
    applySettings();
  }

  function applySettings() {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme || 'gold');
    root.setAttribute('data-mobile-columns', settings.mobileColumns === 'single' ? 'single' : 'double');

    const font = settings.fontFamily && settings.fontFamily !== 'default' ? settings.fontFamily : null;
    if (font) root.setAttribute('data-font', font);
    else root.removeAttribute('data-font');
    const brandFont = settings.brandFont && settings.brandFont !== 'default' ? settings.brandFont : null;
    if (brandFont) root.setAttribute('data-brand-font', brandFont);
    else root.removeAttribute('data-brand-font');
    root.setAttribute('data-bold', settings.textBold ? 'true' : 'false');

    document.querySelectorAll('[data-brand]').forEach((el) => {
      el.textContent = settings.brandName || 'alwazir';
    });
    document.querySelectorAll('[data-logo]').forEach((el) => {
      if (settings.logo) {
        el.src = settings.logo;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
    document.querySelectorAll('[data-tagline]').forEach((el) => {
      el.textContent = settings.tagline || '';
    });
    // Favicon (browser tab icon) follows the brand logo.
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && settings.logo) {
      favicon.href = settings.logo;
    }
    const title = document.querySelector('title');
    if (title && !title.dataset.keep) {
      const page = title.dataset.page ? `${title.dataset.page} — ` : '';
      title.textContent = `${page}${settings.brandName || 'alwazir'}`;
    }
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------- cart ---------- */
  const CART_KEY = 'alwazir-cart';

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCartCount();
  }

  function getCart() {
    return loadCart();
  }

  function cartTotal() {
    return loadCart().reduce((sum, it) => sum + it.price * it.qty, 0);
  }

  function addToCart(product, qty = 1) {
    const items = loadCart();
    const existing = items.find((it) => it.id === product.id);
    if (existing) {
      existing.qty += qty;
      // keep the freshest description / image available
      if (product.description) existing.description = product.description;
      if (product.image) existing.image = product.image;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description || '',
        qty
      });
    }
    saveCart(items);
    toast(`Added "${product.name}" to cart`);
  }

  function updateQty(id, qty) {
    let items = loadCart();
    const item = items.find((it) => it.id === id);
    if (!item) return;
    if (qty <= 0) {
      items = items.filter((it) => it.id !== id);
    } else {
      item.qty = qty;
    }
    saveCart(items);
  }

  function removeFromCart(id) {
    saveCart(loadCart().filter((it) => it.id !== id));
  }

  function clearCart() {
    saveCart([]);
  }

  function renderCartCount() {
    const count = loadCart().reduce((n, it) => n + it.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
    });
  }

  /* ---------- product card rendering ---------- */
  function badgeHtml(p) {
    let html = '';
    if (p.popular) html += '<span class="badge badge-popular">&#9733; Popular</span>';
    if (p.special) html += '<span class="badge badge-special">% Special Offer</span>';
    return html;
  }

  function mediaHtml(p, extraClass) {
    if (p.image) {
      return `<img class="${extraClass || ''}" src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">`;
    }
    const initial = (p.name || '?').charAt(0).toUpperCase();
    return `<div class="media-placeholder">${initial}</div>`;
  }

  function productCardHtml(p) {
    return `
      <article class="product-card" data-id="${p.id}">
        <a class="product-media" href="/product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${escapeHtml(p.name)} details">
          ${badgeHtml(p)}
          ${mediaHtml(p)}
        </a>
        <div class="product-body">
          <div class="product-category">${escapeHtml(p.category || 'General')}</div>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.description || '')}</p>
          <div class="product-foot">
            <div class="product-price">${formatMoney(p.price)}</div>
            <div class="product-actions">
              <button class="btn btn-whatsapp" data-action="chat" data-id="${p.id}">${WHATSAPP_ICON} Chat</button>
              <button class="btn btn-gold" data-action="add" data-id="${p.id}">Add to Cart</button>
            </div>
          </div>
        </div>
      </article>`;
  }

  function miniCardHtml(p) {
    return `
      <article class="mini-card" data-id="${p.id}">
        <a class="mini-media" href="/product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.name)}">
          ${badgeHtml(p)}
          ${mediaHtml(p)}
        </a>
        <div class="mini-body">
          <div class="product-category">${escapeHtml(p.category || 'General')}</div>
          <h4 class="product-name">${escapeHtml(p.name)}</h4>
          <p class="product-desc">${escapeHtml(p.description || '')}</p>
          <div class="product-price">${formatMoney(p.price)}</div>
          <button class="btn btn-gold" data-action="add" data-id="${p.id}">Add to Cart</button>
        </div>
      </article>`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- delegated actions ---------- */
  function wireActions(root = document) {
    root.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-action="add"]');
      const chatBtn = e.target.closest('[data-action="chat"]');
      const detailsBtn = e.target.closest('[data-action="details"]');

      if (addBtn) {
        e.preventDefault();
        const card = addBtn.closest('[data-id]');
        const product = window.__products && window.__products[card && card.dataset.id];
        if (product) {
          addToCart(product);
          return;
        }
        // fallback: fetch by id
        fetch(`/api/products/${card.dataset.id}`)
          .then((r) => r.json())
          .then((p) => addToCart(p));
        return;
      }

      if (chatBtn) {
        e.preventDefault();
        const card = chatBtn.closest('[data-id]');
        const id = (card && card.dataset.id) || chatBtn.dataset.id;
        const product = window.__products && window.__products[id];
        if (product) {
          chatAboutProduct(product);
          return;
        }
        // fallback: fetch by id
        fetch(`/api/products/${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((p) => chatAboutProduct(p))
          .catch(() => toast('Could not load product'));
        return;
      }

      if (detailsBtn) {
        e.preventDefault();
        const card = detailsBtn.closest('[data-id]');
        window.location.href = `/product.html?id=${encodeURIComponent(card.dataset.id)}`;
      }
    });
  }

  /* ---------- boot ---------- */
  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    await loadSettings();
    renderCartCount();
    wireActions();
  }

  async function refreshSettings() {
    await loadSettings();
  }

  return {
    boot,
    refreshSettings,
    settings: () => settings,
    formatMoney,
    whatsappNumber,
    openWhatsApp,
    chatAboutProduct,
    WHATSAPP_ICON,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    getCart,
    cartTotal,
    loadCart,
    saveCart,
    renderCartCount,
    productCardHtml,
    miniCardHtml,
    mediaHtml,
    badgeHtml,
    escapeHtml,
    toast,
    applySettings
  };
})();

if (typeof window !== 'undefined') {
  window.__products = window.__products || {};
  // Boot as soon as the body is available (scripts are at the end of the body),
  // so brand name / tagline / logo are applied before first paint too.
  if (document.body) {
    Alwazir.boot();
  } else {
    document.addEventListener('DOMContentLoaded', () => Alwazir.boot());
  }
}

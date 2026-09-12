/* ============================================================
   ALWAZIR — home page logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Alwazir.boot();

  const grid = document.querySelector('[data-grid]');
  const empty = document.querySelector('[data-empty]');
  const searchForm = document.querySelector('[data-search-form]');
  const searchInput = document.querySelector('[data-search-input]');
  const specialSection = document.querySelector('[data-special-section]');
  const catalogSub = document.querySelector('[data-catalog-sub]');

  let products = [];
  let query = '';
  let special = null;
  const defaultSub = catalogSub ? catalogSub.textContent : '';

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products');
      products = res.ok ? await res.json() : [];
    } catch (e) {
      products = [];
    }
    // expose for add-to-cart resolution
    window.__products = {};
    products.forEach((p) => (window.__products[p.id] = p));
  }

  /* Rank a product against a single search term.
     Highest score = shown first.
     Matches on NAME and CATEGORY only (description is excluded so
     unrelated products don't appear). */
  function matchScore(p, q) {
    const name = (p.name || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const words = name.split(/\s+/);
    let score = 0;
    if (words.some((w) => w === q)) score += 120;   // exact word (e.g. "Gold" in "Amber Gold")
    else if (name.startsWith(q)) score += 100;       // first letter(s) of the name
    else if (name.includes(q)) score += 80;          // half/partial name
    if (category === q) score += 40;                 // exact category (e.g. "Oud", "Floral")
    else if (category.startsWith(q)) score += 30;
    else if (category.includes(q)) score += 20;
    return score;
  }

  function filteredProducts() {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    const terms = q.split(/\s+/).filter(Boolean);
    return products
      .map((p) => ({ p, score: terms.reduce((sum, t) => sum + matchScore(p, t), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.p.name || '').localeCompare(b.p.name || ''))
      .map((x) => x.p);
  }

  function renderCatalog() {
    const q = query.trim();
    const isSearching = q.length > 0;
    const list = filteredProducts();

    grid.innerHTML = list.map((p) => Alwazir.productCardHtml(p)).join('');
    empty.classList.toggle('hidden', list.length > 0);

    // Hide the special offer while searching so only matches show.
    specialSection.classList.toggle('hidden', isSearching || !special);

    if (catalogSub) {
      if (isSearching) {
        catalogSub.textContent =
          list.length === 0
            ? `No results for "${q}"`
            : `${list.length} result${list.length === 1 ? '' : 's'} for "${q}"`;
      } else {
        catalogSub.textContent = defaultSub;
      }
    }
  }

  function renderSpecial() {
    special = products.find((p) => p.special) || null;
    if (!special) {
      specialSection.classList.add('hidden');
      return;
    }
    const detailsUrl = `/product.html?id=${encodeURIComponent(special.id)}`;
    specialSection.querySelector('[data-special-media]').innerHTML =
      `<a class="special-media-link" href="${detailsUrl}" aria-label="View ${Alwazir.escapeHtml(special.name)} details">${Alwazir.mediaHtml(special)}</a>`;
    specialSection.querySelector('[data-special-name]').textContent = special.name;
    specialSection.querySelector('[data-special-desc]').textContent = special.description || '';
    specialSection.querySelector('[data-special-price]').textContent = Alwazir.formatMoney(special.price);
    specialSection.querySelector('[data-special-add]').dataset.id = special.id;
    specialSection.querySelector('[data-special-chat]').dataset.id = special.id;
    specialSection.classList.toggle('hidden', query.trim().length > 0);
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    query = searchInput.value;
    renderCatalog();
  });

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    renderCatalog();
  });

  document.querySelector('[data-year]').textContent = new Date().getFullYear();

  await fetchProducts();
  renderSpecial();
  renderCatalog();
});

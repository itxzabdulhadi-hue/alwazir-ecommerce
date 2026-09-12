/* ============================================================
   ALWAZIR — product details page logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await Alwazir.boot();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const layout = document.querySelector('[data-product-layout]');
  const notFound = document.querySelector('[data-product-notfound]');

  document.querySelector('[data-year]').textContent = new Date().getFullYear();
  document.querySelector('[data-back-home]').addEventListener('click', () => (window.location.href = '/'));

  async function load() {
    let product = null;
    if (id) {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
        if (res.ok) product = await res.json();
      } catch (e) {
        product = null;
      }
    }

    if (!product) {
      layout.classList.add('hidden');
      notFound.classList.remove('hidden');
      return;
    }

    window.__products = { [product.id]: product };

    document.querySelector('[data-breadcrumb]').textContent = product.name;
    document.querySelector('[data-details-media]').innerHTML = Alwazir.mediaHtml(product);
    document.querySelector('[data-details-name]').textContent = product.name;
    document.querySelector('[data-details-category]').textContent = product.category || 'General';
    document.querySelector('[data-details-price]').textContent = Alwazir.formatMoney(product.price);
    document.querySelector('[data-details-desc]').textContent = product.description || '';
    document.querySelector('[data-details-add]').dataset.id = product.id;

    const badges = document.querySelector('[data-details-badges]');
    badges.innerHTML =
      (product.popular ? '<span class="pill pill-popular">&#9733; Popular</span>' : '') +
      (product.special ? '<span class="pill pill-special">% Special Offer</span>' : '');

    await loadSimilar(product.id);
  }

  async function loadSimilar(currentId) {
    try {
      const res = await fetch('/api/products');
      const all = res.ok ? await res.json() : [];
      const others = all.filter((p) => p.id !== currentId);
      // prefer popular first, then category matches, then newest
      const scored = [...others].sort((a, b) => {
        const score = (p) =>
          (p.popular ? 2 : 0) + (p.category === (window.__products[currentId] && window.__products[currentId].category) ? 1 : 0);
        return score(b) - score(a);
      });
      const similar = scored.slice(0, 4);
      similar.forEach((p) => (window.__products[p.id] = p));
      document.querySelector('[data-similar-grid]').innerHTML =
        similar.map((p) => Alwazir.miniCardHtml(p)).join('');
    } catch (e) {
      document.querySelector('[data-similar-grid]').innerHTML = '';
    }
  }

  load();
});

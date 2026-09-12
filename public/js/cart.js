/* ============================================================
   ALWAZIR — cart drawer (home + product pages)
   The cart has a "Chat & Order on WhatsApp" button that sends
   every item (name, price, quantity) to the store's
   WhatsApp number.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.querySelector('[data-cart-drawer]');
  const overlay = document.querySelector('[data-cart-overlay]');
  if (!drawer) return;

  const itemsEl = drawer.querySelector('[data-cart-items]');
  const totalEl = drawer.querySelector('[data-cart-total]');
  const waBtn = drawer.querySelector('[data-whatsapp-order]');
  const clearBtn = drawer.querySelector('[data-cart-clear]');

  function openCart() {
    render();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-cart-open]').forEach((el) => el.addEventListener('click', openCart));
  document.querySelector('[data-cart-close]').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  /* ---------- helpers ---------- */
  function buildOrderMessage() {
    const items = Alwazir.getCart();
    const brand = Alwazir.settings().brandName || 'alwazir';
    const lines = [];
    lines.push(`🛍️ *New Order — ${brand}*`);

    if (items.length === 0) {
      lines.push('');
      lines.push("Hi! I'd like to know more about your perfume oils.");
      return lines.join('\n');
    }

    items.forEach((it, i) => {
      lines.push('');
      lines.push(`${i + 1}. ${it.name}`);
      lines.push(`💰 Price: ${Alwazir.formatMoney(it.price)}  × ${it.qty}`);
    });

    lines.push('');
    lines.push(`💳 *Total: ${Alwazir.formatMoney(Alwazir.cartTotal())}*`);
    return lines.join('\n');
  }

  function openWhatsApp() {
    Alwazir.openWhatsApp(buildOrderMessage());
  }

  /* ---------- render ---------- */
  function render() {
    const items = Alwazir.getCart();
    totalEl.textContent = Alwazir.formatMoney(Alwazir.cartTotal());
    clearBtn.classList.toggle('hidden', items.length === 0);

    if (items.length === 0) {
      itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Add a fragrance to begin.</div>';
      return;
    }

    itemsEl.innerHTML = items
      .map(
        (it) => `
      <div class="cart-item" data-id="${it.id}">
        ${it.image ? `<img class="cart-item-img" src="${it.image}" alt="">` : `<div class="cart-item-img media-placeholder" style="font-size:1.6rem">${(it.name || '?').charAt(0).toUpperCase()}</div>`}
        <div class="cart-item-info">
          <div class="cart-item-name">${Alwazir.escapeHtml(it.name)}</div>
          <div class="cart-item-price">${Alwazir.formatMoney(it.price)}</div>
          <div class="qty-control">
            <button class="qty-btn" data-qty="-1">&#8722;</button>
            <span class="qty-num">${it.qty}</span>
            <button class="qty-btn" data-qty="+1">+</button>
            <button class="cart-remove" data-remove>Remove</button>
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  /* ---------- events ---------- */
  waBtn.addEventListener('click', () => {
    if (Alwazir.getCart().length === 0) {
      Alwazir.toast('Your cart is empty — add a fragrance first');
      return;
    }
    openWhatsApp();
  });

  itemsEl.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.cart-item');
    if (!itemEl) return;
    const id = itemEl.dataset.id;

    if (e.target.closest('[data-qty]')) {
      const delta = Number(e.target.closest('[data-qty]').dataset.qty);
      const current = Alwazir.getCart().find((it) => it.id === id);
      if (current) {
        Alwazir.updateQty(id, current.qty + delta);
        render();
      }
    } else if (e.target.closest('[data-remove]')) {
      Alwazir.removeFromCart(id);
      render();
    }
  });

  clearBtn.addEventListener('click', () => {
    Alwazir.clearCart();
    render();
  });
});

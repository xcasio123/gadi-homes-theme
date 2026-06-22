/* ============================================================
   WeHome theme — global.js
   ============================================================ */
(function () {
  'use strict';

  const T = window.theme || {};
  const money = (cents) => {
    const format = (T.settings && T.settings.moneyFormat) || '${{amount}}';
    const amount = (cents / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return format.replace(/\{\{\s*amount\s*\}\}/, amount).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100));
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Overlay / scroll lock ---------- */
  function lockScroll(on) { document.body.classList.toggle('no-scroll', on); }

  /* ---------- Cart drawer ---------- */
  const CartDrawer = {
    el: null, overlay: null,
    init() {
      this.el = $('#CartDrawer');
      this.overlay = $('#CartOverlay');
      if (!this.el) return;
      $$('[data-cart-close]').forEach(b => b.addEventListener('click', () => this.close()));
      if (this.overlay) this.overlay.addEventListener('click', () => this.close());
      document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    },
    open() {
      if (!this.el) { window.location.href = T.routes.cart_url; return; }
      this.el.classList.add('is-open');
      if (this.overlay) this.overlay.classList.add('is-open');
      lockScroll(true);
    },
    close() {
      if (!this.el) return;
      this.el.classList.remove('is-open');
      if (this.overlay) this.overlay.classList.remove('is-open');
      lockScroll(false);
    },
    async refresh() {
      try {
        const res = await fetch(`${T.routes.cart_url}?section_id=cart-drawer`);
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, 'text/html');
        const fresh = html.querySelector('#CartDrawerContents');
        const current = $('#CartDrawerContents');
        if (fresh && current) current.innerHTML = fresh.innerHTML;
        this.bindItems();
      } catch (e) { console.error('Cart refresh failed', e); }
    },
    bindItems() {
      $$('[data-qty-change]', this.el).forEach(input => {
        input.addEventListener('change', () => updateLine(input.dataset.line, input.value));
      });
      $$('[data-qty-btn]', this.el).forEach(btn => {
        btn.addEventListener('click', () => {
          const input = btn.parentElement.querySelector('input');
          let val = parseInt(input.value, 10) || 1;
          val = btn.dataset.qtyBtn === 'plus' ? val + 1 : Math.max(0, val - 1);
          input.value = val;
          updateLine(input.dataset.line, val);
        });
      });
      $$('[data-cart-remove]', this.el).forEach(btn => {
        btn.addEventListener('click', () => updateLine(btn.dataset.line, 0));
      });
    }
  };

  async function updateLine(line, quantity) {
    try {
      const res = await fetch(T.routes.cart_change_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ line: parseInt(line, 10), quantity: parseInt(quantity, 10) })
      });
      const cart = await res.json();
      updateCartCount(cart.item_count);
      await CartDrawer.refresh();
      updateFreeShip(cart.total_price);
    } catch (e) { console.error(e); }
  }

  function updateCartCount(count) {
    $$('[data-cart-count]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  function updateFreeShip(total) {
    const bar = $('[data-free-ship]');
    if (!bar || !T.settings.freeShippingBar) return;
    const threshold = T.settings.freeShippingThreshold;
    const fill = $('[data-free-ship-fill]', bar);
    const text = $('[data-free-ship-text]', bar);
    const pct = Math.min(100, (total / threshold) * 100);
    if (fill) fill.style.width = pct + '%';
    if (text) {
      if (total >= threshold) {
        text.textContent = T.strings.freeShippingReached;
      } else {
        const remaining = money(threshold - total);
        text.textContent = (T.strings.freeShippingProgress || '').replace('[amount]', remaining);
      }
    }
  }

  /* ---------- Add to cart (forms + quick add) ---------- */
  async function handleAddToCart(form) {
    const btn = form.querySelector('[type="submit"]');
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ...'; }
    try {
      const formData = new FormData(form);
      const res = await fetch(T.routes.cart_add_url, {
        method: 'POST',
        headers: { 'Accept': 'application/javascript' },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.description || 'Could not add to cart');
      }
      const cartRes = await fetch(`${T.routes.cart_url}.js`);
      const cart = await cartRes.json();
      updateCartCount(cart.item_count);
      updateFreeShip(cart.total_price);
      await CartDrawer.refresh();
      CartDrawer.open();
    } catch (e) {
      alert(e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  function bindCartForms() {
    $$('form[action*="/cart/add"]').forEach(form => {
      if (form.dataset.bound) return;
      form.dataset.bound = '1';
      form.addEventListener('submit', e => {
        if (T.settings.cartType === 'page') return; // let it submit normally
        e.preventDefault();
        handleAddToCart(form);
      });
    });
  }

  /* ---------- Header cart trigger ---------- */
  function bindCartTriggers() {
    $$('[data-cart-open]').forEach(b => {
      b.addEventListener('click', e => {
        if (T.settings.cartType === 'page') return;
        e.preventDefault();
        CartDrawer.open();
      });
    });
  }

  /* ---------- Mobile nav ---------- */
  const MobileNav = {
    init() {
      const toggle = $('[data-menu-toggle]');
      const drawer = $('#MobileNav');
      const overlay = $('#MobileNavOverlay');
      if (!toggle || !drawer) return;
      const open = () => { drawer.classList.add('is-open'); if (overlay) overlay.classList.add('is-open'); lockScroll(true); };
      const close = () => { drawer.classList.remove('is-open'); if (overlay) overlay.classList.remove('is-open'); lockScroll(false); };
      toggle.addEventListener('click', open);
      $$('[data-menu-close]', document).forEach(b => b.addEventListener('click', close));
      if (overlay) overlay.addEventListener('click', close);
      $$('[data-subnav-toggle]', drawer).forEach(btn => {
        btn.addEventListener('click', () => {
          const item = btn.closest('.mobile-nav__item');
          const sub = item.querySelector('.mobile-nav__sub');
          item.classList.toggle('is-open');
          if (sub) sub.classList.toggle('is-open');
        });
      });
    }
  };

  /* ---------- Search modal ---------- */
  const Search = {
    init() {
      const modal = $('#SearchModal');
      if (!modal) return;
      const input = $('input[type="search"]', modal);
      $$('[data-search-open]').forEach(b => b.addEventListener('click', e => {
        e.preventDefault();
        modal.classList.add('is-open');
        lockScroll(true);
        if (input) setTimeout(() => input.focus(), 80);
      }));
      $$('[data-search-close]', modal).forEach(b => b.addEventListener('click', () => {
        modal.classList.remove('is-open'); lockScroll(false);
      }));
      modal.addEventListener('click', e => { if (e.target === modal) { modal.classList.remove('is-open'); lockScroll(false); } });
    }
  };

  /* ---------- FAQ tabs + accordion ---------- */
  function bindFaq() {
    $$('[data-faq]').forEach(faq => {
      const tabs = $$('[data-faq-tab]', faq);
      const panels = $$('[data-faq-panel]', faq);
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
          panels.forEach(p => p.classList.remove('is-active'));
          tab.setAttribute('aria-selected', 'true');
          const panel = panels.find(p => p.dataset.faqPanel === tab.dataset.faqTab);
          if (panel) panel.classList.add('is-active');
        });
      });
    });
  }

  /* ---------- Quantity steppers (generic) ---------- */
  function bindQty() {
    $$('.qty').forEach(wrap => {
      if (wrap.dataset.bound) return;
      wrap.dataset.bound = '1';
      const input = wrap.querySelector('input');
      $$('button', wrap).forEach(btn => {
        btn.addEventListener('click', () => {
          let val = parseInt(input.value, 10) || 1;
          val = btn.dataset.qtyBtn === 'plus' || btn.classList.contains('qty__plus') ? val + 1 : Math.max(1, val - 1);
          input.value = val;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    });
  }

  /* ---------- Product gallery ---------- */
  const Gallery = {
    init() {
      const gallery = $('[data-gallery]');
      if (!gallery) return;
      const main = $('[data-gallery-main] img', gallery);
      $$('[data-gallery-thumb]', gallery).forEach(thumb => {
        thumb.addEventListener('click', () => {
          const src = thumb.dataset.full;
          if (main && src) main.src = src;
          $$('[data-gallery-thumb]', gallery).forEach(t => t.classList.remove('is-active'));
          thumb.classList.add('is-active');
        });
      });
    }
  };

  /* ---------- Product variant selection ---------- */
  const VariantSelector = {
    init() {
      const form = $('[data-product-form]');
      if (!form) return;
      const data = $('[data-variant-json]');
      if (!data) return;
      let variants;
      try { variants = JSON.parse(data.textContent); } catch (e) { return; }
      const idInput = form.querySelector('[name="id"]');
      const priceTarget = $('[data-product-price]');
      const addBtn = form.querySelector('[type="submit"]');

      const getSelected = () => $$('[data-option-input]', form)
        .filter(i => i.checked || i.tagName === 'SELECT')
        .map(i => i.tagName === 'SELECT' ? i.value : i.value);

      function update() {
        const selected = [];
        $$('[data-option-position]', form).forEach(group => {
          const pos = group.dataset.optionPosition;
          const checked = group.querySelector('input:checked') || group.querySelector('select');
          if (checked) selected[pos - 1] = checked.value;
        });
        const match = variants.find(v => v.options.every((opt, i) => opt === selected[i]));
        if (match) {
          idInput.value = match.id;
          if (priceTarget) priceTarget.innerHTML = match.price_html || money(match.price);
          if (addBtn) {
            addBtn.disabled = !match.available;
            addBtn.querySelector('[data-btn-text]') &&
              (addBtn.querySelector('[data-btn-text]').textContent = match.available ? T.strings.addToCart : T.strings.soldOut);
          }
        }
      }
      $$('[data-option-input]', form).forEach(i => i.addEventListener('change', update));
      update();
    }
  };

  /* ---------- Collection sort ---------- */
  function bindSort() {
    const sort = $('[data-sort]');
    if (!sort) return;
    sort.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', sort.value);
      url.searchParams.delete('page');
      window.location.href = url.toString();
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    CartDrawer.init();
    CartDrawer.bindItems();
    MobileNav.init();
    Search.init();
    Gallery.init();
    VariantSelector.init();
    bindCartTriggers();
    bindCartForms();
    bindFaq();
    bindQty();
    bindSort();
  });
})();

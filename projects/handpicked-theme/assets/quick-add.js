/* HandPicked — quick-add.js
   Desktop product-card quick add. Posts the chosen variant via HP.cart.add; the cart drawer listens for
   cart:updated (source "add") and opens itself. Delegated, so cards added by facets / load-more just work. */
(function () {
  'use strict';
  var started = false;

  function start() {
    if (started) return;
    var HP = window.HP;
    if (!HP) return;
    started = true;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-quick-add]');
      if (!btn || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;
      var id = Number(btn.getAttribute('data-variant-id'));
      if (!id) return;
      e.preventDefault();
      btn.setAttribute('aria-busy', 'true');
      HP.cart.add([{ id: id, quantity: 1 }], { source: 'add' })
        .then(function () {
          btn.classList.add('is-added');
          setTimeout(function () { btn.classList.remove('is-added'); }, 1600);
        })
        .catch(function (err) {
          HP.toast((err && err.message) || (HP.strings && HP.strings.cartError) || 'Error', { type: 'error' });
        })
        .then(function () { btn.removeAttribute('aria-busy'); });
    });
  }

  if (window.HP && window.HP.cart) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();

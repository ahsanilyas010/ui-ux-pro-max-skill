/* HandPicked Editorial — motion.js (baseline)
   CSS-first reveals via IntersectionObserver. Everything is visible without this file.
   Extended by the motion layer (GSAP on homepage, add-to-cart micro-interactions, social proof). */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const html = document.documentElement;
  const level = html.getAttribute('data-motion') || 'standard';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (level === 'off' || reduced || !('IntersectionObserver' in window)) return;

  html.setAttribute('data-motion-ready', '');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.hasAttribute('data-reveal-stagger')) {
        Array.from(el.children).forEach((child, i) => child.style.setProperty('--i', Math.min(i, 11)));
      }
      el.classList.add('is-revealed');
      io.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  function observe(root) {
    (root || document).querySelectorAll('[data-reveal]:not(.is-revealed), [data-reveal-stagger]:not(.is-revealed)').forEach((el) => {
      // Above-the-fold content reveals immediately to protect LCP.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
        if (el.hasAttribute('data-reveal-stagger')) Array.from(el.children).forEach((child, i) => child.style.setProperty('--i', Math.min(i, 11)));
        requestAnimationFrame(() => el.classList.add('is-revealed'));
      } else {
        io.observe(el);
      }
    });
  }
  HP.motion = HP.motion || {};
  HP.motion.observe = observe;
  HP.motion.level = level;

  const start = () => observe(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  document.addEventListener('hp:section:replaced', (e) => observe(e.detail && e.detail.target));
  document.addEventListener('hp:section:load', (e) => observe(e.detail && e.detail.target));
  document.addEventListener('shopify:section:load', (e) => observe(e.target));
})();

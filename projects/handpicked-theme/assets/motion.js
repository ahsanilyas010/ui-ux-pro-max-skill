/* HandPicked Editorial — motion.js
   1. Baseline: CSS-first reveals via IntersectionObserver (everything is visible without this file).
   2. Injects component-motion.css once and applies the .cv-auto (content-visibility) utility.
   3. Add-to-cart success overlay, header cart-badge bump, cart drawer item stagger.
   4. Homepage only: GSAP 3.13 core + ScrollTrigger (jsDelivr) after window load, idle, level "standard".
   Nothing here blocks first paint, add-to-cart, or the COD form; a failed GSAP load leaves the CSS reveals in charge. */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const html = document.documentElement;
  const doc = document;
  const level = html.getAttribute('data-motion') || 'standard';
  if (level === 'off') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = !reduced;
  const thisScript = doc.currentScript || doc.querySelector('script[src*="motion.js"]');
  const pageType = (HP.shop && HP.shop.pageType) || '';
  const GSAP_VERSION = '3.13.0';

  HP.motion = HP.motion || {};
  HP.motion.level = level;
  HP.motion.observe = function () {};

  /* ---------- 1. Baseline reveals ---------- */
  if (animate && 'IntersectionObserver' in window) {
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

    const observe = function (root) {
      (root || doc).querySelectorAll('[data-reveal]:not(.is-revealed), [data-reveal-stagger]:not(.is-revealed)').forEach((el) => {
        // Above-the-fold content reveals immediately to protect LCP.
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
          if (el.hasAttribute('data-reveal-stagger')) Array.from(el.children).forEach((child, i) => child.style.setProperty('--i', Math.min(i, 11)));
          requestAnimationFrame(() => el.classList.add('is-revealed'));
        } else {
          io.observe(el);
        }
      });
    };
    HP.motion.observe = observe;

    const start = () => observe(doc);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    doc.addEventListener('hp:section:replaced', (e) => observe(e.detail && e.detail.target));
    doc.addEventListener('hp:section:load', (e) => observe(e.detail && e.detail.target));
    doc.addEventListener('shopify:section:load', (e) => observe(e.target));
  }

  /* ---------- 2. Component CSS (injected once) + content-visibility utility ---------- */
  function injectCss() {
    if (doc.querySelector('link[data-hp-motion-css]')) return;
    const src = thisScript && thisScript.getAttribute('src');
    if (!src) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = src.replace(/motion\.js/, 'component-motion.css');
    link.setAttribute('data-hp-motion-css', '');
    doc.head.appendChild(link);
  }

  /* Far-below-the-fold sections skip rendering until near the viewport. Never applied to
     sections that hold drawers, COD slots, sticky bars or the product buy block. */
  function applyCv() {
    const sections = Array.from(doc.querySelectorAll('#MainContent > .shopify-section, .shopify-section-group-footer-group'));
    sections.forEach((sec, i) => {
      const main = sec.parentElement && sec.parentElement.id === 'MainContent';
      if (main && pageType !== 'index' && !/product-recommendations|recently-viewed/.test(sec.className)) return;
      if (main && pageType === 'index' && i < 2) return; // hero + trust strip stay eager
      if (sec.querySelector('hp-drawer, [data-cod-slot], [data-sticky-atc], [data-hero-media], .marquee')) return;
      sec.classList.add('cv-auto');
    });
  }

  const afterParse = function () { injectCss(); applyCv(); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', afterParse, { once: true }); else afterParse();
  doc.addEventListener('shopify:section:load', (e) => { if (e.target && e.target.classList) e.target.classList.remove('cv-auto'); });

  if (!animate) return; // reduced motion: baseline CSS only; no micro-interactions, no GSAP

  /* ---------- 3a. Add-to-cart success overlay + cart badge bump ---------- */
  let lastAdd = null;
  doc.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-add-to-cart], [data-sticky-add], [data-quick-add]');
    if (b) lastAdd = b;
  }, true);

  function checkOverlay(btn) {
    if (!btn || !btn.isConnected || btn.querySelector('.add-check')) return;
    const cs = window.getComputedStyle(btn);
    if (cs.position === 'static') btn.style.position = 'relative';
    const o = doc.createElement('span');
    o.className = 'add-check';
    o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M20 6 9 17l-5-5" pathLength="1"/></svg>';
    btn.appendChild(o);
    setTimeout(() => { o.remove(); }, 1400);
  }

  function bumpBadge() {
    doc.querySelectorAll('.icon-button__count').forEach((el) => {
      el.classList.remove('is-bump');
      void el.offsetWidth; // restart the keyframe
      el.classList.add('is-bump');
      el.addEventListener('animationend', () => el.classList.remove('is-bump'), { once: true });
    });
  }

  if (HP.on) {
    HP.on('cart:updated', (d) => {
      if (!d || d.source !== 'add') return;
      bumpBadge();
      checkOverlay(lastAdd);
      lastAdd = null;
    });
  }

  /* ---------- 3b. Cart drawer item stagger (open + re-render while flagged) ---------- */
  function stamp(root) {
    root.querySelectorAll('.cart-item').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 8)));
  }
  let staggerTimer;
  function bindCartDrawer() {
    const drawer = doc.getElementById('CartDrawer');
    if (!drawer || level !== 'standard') return;
    const rootEl = drawer.querySelector('[data-cart-root]') || drawer;
    new MutationObserver(() => stamp(drawer)).observe(rootEl, { childList: true });
    if (HP.on) {
      HP.on('drawer:open', (d) => {
        if (!d || d.id !== 'CartDrawer') return;
        stamp(drawer);
        drawer.setAttribute('data-stagger', '');
        clearTimeout(staggerTimer);
        staggerTimer = setTimeout(() => drawer.removeAttribute('data-stagger'), 900);
      });
      HP.on('drawer:close', (d) => {
        if (d && d.id === 'CartDrawer') { clearTimeout(staggerTimer); drawer.removeAttribute('data-stagger'); }
      });
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bindCartDrawer, { once: true }); else bindCartDrawer();

  /* ---------- 4. Homepage GSAP (standard level only) ---------- */
  const motionSettings = (HP.settings && HP.settings.motion) || {};
  if (pageType !== 'index' || level !== 'standard' || !motionSettings.gsapHome) return;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = doc.createElement('script');
      s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = reject;
      doc.head.appendChild(s);
    });
  }

  function runHome() {
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    if (!gsap) return;
    if (ST) gsap.registerPlugin(ST);

    // Hero: media settles from 1.04 to 1; content rises. Transform only, so nothing is hidden
    // (the LCP image and headline are already painted by the time this runs).
    const heroMedia = doc.querySelectorAll('[data-hero-media] img, [data-hero-media] video');
    if (heroMedia.length) gsap.fromTo(heroMedia, { scale: 1.04 }, { scale: 1, duration: 0.9, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' });
    const heroContent = doc.querySelector('[data-hero-content]');
    if (heroContent) {
      const kids = Array.from(heroContent.children);
      if (kids.length) gsap.fromTo(kids, { y: 24 }, { y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', clearProps: 'transform' });
    }

    if (!ST) return;

    // Featured grids: reveal starts at "top 85%" (CSS owns the stagger transition, GSAP only triggers it).
    doc.querySelectorAll('[data-reveal-stagger]:not(.is-revealed)').forEach((grid) => {
      ST.create({
        trigger: grid, start: 'top 85%', once: true,
        onEnter: () => {
          Array.from(grid.children).forEach((child, i) => child.style.setProperty('--i', Math.min(i, 11)));
          grid.classList.add('is-revealed');
        }
      });
    });

    // Editorial banner: slow image parallax on tablet and up.
    gsap.matchMedia().add('(min-width: 750px)', () => {
      doc.querySelectorAll('.editorial__media').forEach((media) => {
        const img = media.querySelector('img');
        if (!img) return;
        media.classList.add('hp-gsap-parallax');
        gsap.fromTo(img, { yPercent: 6, scale: 1.14 }, {
          yPercent: -6, scale: 1.14, ease: 'none',
          scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        });
      });
    });
  }

  function loadGsap() {
    const base = 'https://cdn.jsdelivr.net/npm/gsap@' + GSAP_VERSION + '/dist/';
    loadScript(base + 'gsap.min.js')
      .then(() => loadScript(base + 'ScrollTrigger.min.js').catch(() => {}))
      .then(runHome)
      .catch(() => {}); // CDN blocked or offline: CSS reveals already cover everything
  }
  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(loadGsap, { timeout: 3000 });
    else setTimeout(loadGsap, 1000);
  };
  if (doc.readyState === 'complete') schedule(); else window.addEventListener('load', schedule, { once: true });
})();

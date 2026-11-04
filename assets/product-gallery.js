/* HandPicked Editorial — product-gallery.js
   Scroll-snap slider + thumbnails + counter/dots + lightbox (<hp-drawer>, CSS touch-action pinch-zoom, 2x toggle).
   Reacts to HP 'variant:change' by scrolling to variant.featured_media. No third-party libraries. */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const bound = new WeakSet();

  function init(root) {
    if (bound.has(root)) return;
    bound.add(root);
    const sectionId = root.getAttribute('data-section-id');
    const track = root.querySelector('[data-track]');
    if (!track) return;
    const slides = Array.from(track.querySelectorAll('[data-slide]'));
    const thumbsEl = root.querySelector('[data-thumbs]');
    const thumbs = Array.from(root.querySelectorAll('[data-thumb]'));
    const dots = Array.from(root.querySelectorAll('.pgallery__dot'));
    const counter = root.querySelector('[data-counter-current]');
    let active = 0;

    function setActive(i, fromScroll) {
      if (i === active && fromScroll) return;
      active = i;
      thumbs.forEach((t, j) => {
        const on = j === i;
        t.classList.toggle('is-active', on);
        if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
      dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
      if (counter) counter.textContent = String(i + 1);
      if (thumbsEl && thumbs[i] && thumbsEl.scrollHeight > thumbsEl.clientHeight) {
        thumbsEl.scrollTop = thumbs[i].offsetTop - thumbsEl.clientHeight / 2 + thumbs[i].offsetHeight / 2;
      }
      slides.forEach((s, j) => { if (j !== i) { const v = s.querySelector('video'); if (v && !v.paused) v.pause(); } });
    }

    function goTo(i, instant) {
      const idx = Math.max(0, Math.min(slides.length - 1, i));
      const behavior = instant || HP.prefersReducedMotion() ? 'auto' : 'smooth';
      track.scrollTo({ left: idx * track.clientWidth, behavior });
      setActive(idx);
    }

    // Track the slide in view.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(slides.indexOf(e.target), true);
        });
      }, { root: track, threshold: [0.6] });
      slides.forEach((s) => io.observe(s));
    }

    thumbs.forEach((t, i) => {
      t.addEventListener('click', () => goTo(i));
      t.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        let next = null;
        if (e.key in keys) next = i + keys[e.key];
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = thumbs.length - 1;
        if (next === null) return;
        e.preventDefault();
        next = Math.max(0, Math.min(thumbs.length - 1, next));
        thumbs[next].focus();
        goTo(next);
      });
    });
    root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => goTo(active + Number(b.getAttribute('data-nav')))));
    track.addEventListener('keydown', (e) => {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
    });

    // Keep the slide aligned when the viewport size changes.
    window.addEventListener('resize', HP.debounce(() => { track.scrollTo({ left: active * track.clientWidth, behavior: 'auto' }); }, 150));

    /* ---------- Lightbox ---------- */
    const drawer = root.querySelector('[data-lightbox]');
    if (drawer) {
      const id = drawer.id;
      // Move to <body> so the rest of the page can be made inert while it is open.
      const stale = document.body.querySelector(':scope > #' + id);
      if (stale && stale !== drawer) stale.remove();
      document.body.appendChild(drawer);
      const stage = drawer.querySelector('[data-lightbox-stage]');
      const img = drawer.querySelector('[data-lightbox-img]');
      const title = drawer.querySelector('[data-lightbox-title]');
      const zoomBtn = drawer.querySelector('[data-lightbox-zoom]');
      const prev = drawer.querySelector('[data-lightbox-nav="-1"]');
      const next = drawer.querySelector('[data-lightbox-nav="1"]');
      const zoomables = Array.from(track.querySelectorAll('[data-zoom]'));
      let current = 0;

      const setZoom = (on) => {
        stage.classList.toggle('is-zoomed', on);
        zoomBtn.setAttribute('aria-pressed', String(on));
        if (on) requestAnimationFrame(() => {
          stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
          stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
        });
      };
      const show = (i) => {
        current = (i + zoomables.length) % zoomables.length;
        const z = zoomables[current];
        setZoom(false);
        img.src = z.getAttribute('data-zoom-src');
        img.alt = z.getAttribute('data-zoom-alt') || '';
        const slide = z.closest('[data-slide]');
        if (title && slide) title.textContent = slide.getAttribute('aria-label');
        const multi = zoomables.length > 1;
        prev.hidden = !multi; next.hidden = !multi;
      };
      zoomables.forEach((z, i) => z.addEventListener('click', () => {
        show(i);
        HP.openDrawer(id, z);
      }));
      prev.addEventListener('click', () => show(current - 1));
      next.addEventListener('click', () => show(current + 1));
      zoomBtn.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')));
      img.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')));
      drawer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
      });
      HP.on('drawer:close', (d) => {
        if (d && d.id === id) {
          setZoom(false);
          goTo(slides.indexOf(zoomables[current].closest('[data-slide]')), true);
        }
      });
    }

    /* ---------- Variant → featured media ---------- */
    HP.on('variant:change', (d) => {
      if (!d || d.sectionId !== sectionId || !d.variant || !d.variant.featured_media) return;
      const idx = slides.findIndex((s) => Number(s.getAttribute('data-media-id')) === Number(d.variant.featured_media.id));
      if (idx > -1 && idx !== active) goTo(idx, !!d.initial);
    });
  }

  function boot() {
    document.querySelectorAll('[data-gallery]').forEach(init);
    HP.on('section:load', ({ target }) => { if (target) target.querySelectorAll('[data-gallery]').forEach(init); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

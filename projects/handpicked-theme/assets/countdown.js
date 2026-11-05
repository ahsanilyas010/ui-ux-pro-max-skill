/* hp-countdown — counts down to data-end (epoch ms, computed in Asia/Karachi), hides its section when expired. */
(function () {
  if (customElements.get('hp-countdown')) return;
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  class HPCountdown extends HTMLElement {
    connectedCallback() {
      this.end = parseInt(this.getAttribute('data-end'), 10);
      if (!this.end) return;
      this.parts = {
        d: this.querySelector('[data-cd="d"]'),
        h: this.querySelector('[data-cd="h"]'),
        m: this.querySelector('[data-cd="m"]'),
        s: this.querySelector('[data-cd="s"]')
      };
      this.tick = this.tick.bind(this);
      this.tick();
      this.timer = setInterval(this.tick, 1000);
    }
    disconnectedCallback() { clearInterval(this.timer); }
    tick() {
      var left = Math.floor((this.end - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(this.timer);
        var host = this.closest('[data-countdown-section]');
        if (host && !(window.Shopify && Shopify.designMode)) host.hidden = true;
        left = 0;
      }
      var d = Math.floor(left / 86400);
      var h = Math.floor((left % 86400) / 3600);
      var m = Math.floor((left % 3600) / 60);
      var s = left % 60;
      if (this.parts.d) this.parts.d.textContent = pad(d);
      if (this.parts.h) this.parts.h.textContent = pad(h);
      if (this.parts.m) this.parts.m.textContent = pad(m);
      if (this.parts.s) this.parts.s.textContent = pad(s);
    }
  }
  customElements.define('hp-countdown', HPCountdown);
})();

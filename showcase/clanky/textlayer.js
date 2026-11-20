// The overlay's words as real DOM text over the stage canvas (design/RENDERING.md §3): bubbles, task tags, hints,
// chips and the step list stay drawn on the canvas, and their words land here, crisp at any scale. Immediate mode:
// core.js calls begin() before a frame is drawn and end() after; each text() or block() call during the frame takes
// the next pooled element and moves it there; end() hides the ones not used. Only text drawn on the stage canvas comes
// here (on() says so); everything else (the follower's snapshot, cards) still draws its own.
(() => {
  const R = window.Clanky;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true'); // streamed words would be read letter by letter; notch.js announces whole replies
  Object.assign(layer.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', contain: 'layout style' });
  const mount = () => { const st = document.getElementById('stage'); if (st?.parentNode) st.parentNode.insertBefore(layer, st.nextSibling); else document.body.appendChild(layer); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  const pool = [], blocks = [];
  let used = 0, usedB = 0, canvas = null, vx = 0, vy = 0, dpr = 1, active = false;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // A canvas point (in the context's current transform) as whole CSS px on the page.
  const toPage = (c, x, y) => {
    const m = c.getTransform();
    return [Math.round((m.a * x + m.c * y + m.e) / dpr + vx), Math.round((m.b * x + m.d * y + m.f) / dpr + vy)];
  };
  const take = (list, i, make) => {
    let e = list[i];
    if (!e) { e = make(); list.push(e); layer.appendChild(e); }
    return e;
  };
  // Sets a property only when it changed: most frames move nothing, and style writes aren't free.
  const set = (e, k, v) => { if (e._s?.[k] !== v) { (e._s ??= {})[k] = v; if (k === 'html') e.innerHTML = v; else e.style[k] = v; } };
  const span = () => { const e = document.createElement('span'); Object.assign(e.style, { position: 'absolute', left: '0', top: '0', whiteSpace: 'pre', lineHeight: '1' }); return e; };
  const box = () => { const e = document.createElement('div'); Object.assign(e.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden' }); return e; };
  const fontPx = (font) => +(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);

  R.textLayer = {
    begin(cv, x, y, d) { canvas = cv; vx = x; vy = y; dpr = d; used = usedB = 0; active = true; },
    end() {
      active = false;
      for (let i = used; i < pool.length; i++) set(pool[i], 'display', 'none');
      for (let i = usedB; i < blocks.length; i++) set(blocks[i], 'display', 'none');
    },
    clear() { used = usedB = 0; this.end(); },
    /** Is this context drawing the stage right now (so its words belong here)? */
    on: (c) => active && c?.canvas === canvas,
    /**
     * One run of text at (x, y) in the context's coordinates, its left edge at x (callers anchor it themselves).
     * baseline: 'middle' (default), 'alphabetic' or 'top'. html: the inner HTML (escaped by the caller), else str.
     */
    text(c, { str = '', html = null, x, y, font, color, baseline = 'middle', alpha = 1 }) {
      const e = take(pool, used++, span), fs = fontPx(font);
      const dy = baseline === 'top' ? 0 : baseline === 'alphabetic' ? -fs * 0.8 : -fs / 2;
      const [px, py] = toPage(c, x, y + dy);
      set(e, 'display', '');
      set(e, 'font', font); set(e, 'color', color); set(e, 'opacity', String(Math.round(alpha * c.globalAlpha * 100) / 100));
      set(e, 'transform', `translate(${px}px, ${py}px)`);
      set(e, 'html', html ?? esc(str));
    },
    /** A clipped block of ready-made lines (a bubble's words) with its top left at (x, y), w x h, in the context's coordinates. */
    block(c, { x, y, w, h, html, alpha = 1, font }) {
      const e = take(blocks, usedB++, box), [px, py] = toPage(c, x, y);
      set(e, 'display', '');
      set(e, 'font', font); set(e, 'width', `${Math.round(w)}px`); set(e, 'height', `${Math.round(h)}px`);
      set(e, 'opacity', String(Math.round(alpha * c.globalAlpha * 100) / 100));
      set(e, 'transform', `translate(${px}px, ${py}px)`);
      set(e, 'html', html);
    },
    esc,
  };
})();

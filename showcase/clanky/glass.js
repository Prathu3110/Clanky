// The card look shared by the Sidekick's own UI (bubbles, the thinking tag, task tags, the step list) and the drawings'
// cards (ink.js): the design tokens' "pocket handheld" surface (design/DESIGN.md). Solid oat paper, a 1.5 px ink edge,
// radius 6 and a short hard shadow; no blur, no glass, no glow. Tangerine marks the one thing to look at, never body text.
(() => {
  const R = window.Clanky;
  if (!R || typeof document === 'undefined') return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Tokens (design/tokens.json): oat paper, ink text and edges, tangerine accent, rust for errors.
  const OAT = '#F3EBDD', OAT2 = '#E8DFCF', INK = '#2A2420', INK_SOFT = '#5E5248', TANGERINE = '#F2A65A', RUST = '#B5534A', RUST_TEXT = '#8E3A33';
  const SKY = '#A9CBE3', BUTTER = '#F6E3A1', SAGE = '#A8BFA0';
  // The names the rest of the overlay uses: ACC the accent, HOT the focus ring, MID/DEEP quieter accents, EDGE the
  // pale casing under free strokes, GLASS the card fill, TEXT/DIM body and secondary text, CORAL/NOTE errors.
  const ACC = TANGERINE, HOT = TANGERINE, MID = INK_SOFT, DEEP = OAT2, EDGE = OAT;
  const GLASS = OAT, TEXT = INK, DIM = INK_SOFT, CORAL = RUST, NOTE = RUST_TEXT;
  const SHADOW = 'rgba(42,36,32,0.22)', RADIUS = 6;
  const MONO = '"Martian Mono", "Clanky Arabic", ui-monospace, monospace';
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

  // The outline, clockwise from the top-left; tail: { side: 'top'|'right'|'bottom'|'left', at, to: [x, y] } adds a
  // stepped tail on that side, centred at `at` along it and stepping toward the point `to`.
  function stepped(x, y, w, h, c = 8, tail = null) {
    const s = c / 2, b = y + h, r = x + w;
    const pts = [[x + c, y], [r - c, y], [r - c, y + s], [r - s, y + s], [r - s, y + c], [r, y + c], [r, b - c], [r - s, b - c], [r - s, b - s], [r - c, b - s], [r - c, b],
      [x + c, b], [x + c, b - s], [x + s, b - s], [x + s, b - c], [x, b - c], [x, y + c], [x + s, y + c], [x + s, y + s], [x + c, y + s]];
    if (!tail) return pts;
    // Each side as the path walks it: where it starts, its direction, its outward normal, and the point it follows.
    const SIDE = { top: [[x, y], [1, 0], [0, -1], 0], right: [[r, y], [0, 1], [1, 0], 5], bottom: [[r, b], [-1, 0], [0, 1], 10], left: [[x, b], [0, -1], [-1, 0], 15] }[tail.side];
    if (!SIDE) return pts;
    const [o, e, n, after] = SIDE, len = Math.abs(e[0]) ? w : h;
    // Position along the walked side, kept clear of the corners.
    const w0 = tail.w ?? 12, along = clamp(Math.abs(e[0]) ? (tail.at - o[0]) * e[0] : (tail.at - o[1]) * e[1], c + w0 / 2 + 2, len - c - w0 / 2 - 2);
    const base = [o[0] + e[0] * along, o[1] + e[1] * along];
    const to = tail.to ?? [base[0] + n[0] * 14, base[1] + n[1] * 14];
    const depth = clamp((to[0] - base[0]) * n[0] + (to[1] - base[1]) * n[1], 6, tail.max ?? 18), shift = (to[0] - base[0]) * e[0] + (to[1] - base[1]) * e[1];
    const hs = depth / 3, ws = [w0, w0 * 0.66, w0 * 0.33], ds = [0, shift * 0.45, shift * 0.8];
    const P = (a, d) => [base[0] + e[0] * a + n[0] * d, base[1] + e[1] * a + n[1] * d];
    const t = [P(-ws[0] / 2, 0), P(-ws[0] / 2, hs), P(ds[1] - ws[1] / 2, hs), P(ds[1] - ws[1] / 2, 2 * hs), P(ds[2] - ws[2] / 2, 2 * hs), P(ds[2] - ws[2] / 2, 3 * hs),
      P(ds[2] + ws[2] / 2, 3 * hs), P(ds[2] + ws[2] / 2, 2 * hs), P(ds[1] + ws[1] / 2, 2 * hs), P(ds[1] + ws[1] / 2, hs), P(ws[0] / 2, hs), P(ws[0] / 2, 0)];
    pts.splice(after + 1, 0, ...t);
    return pts;
  }
  // The surface's outline: corners rounded to RADIUS (the `c` callers pass sets the room kept clear for a tail), and
  // the stepped tail (3 pixel steps) where one is asked for.
  const steppedPath = (x, y, w, h, c = 8, tail = null) => {
    const pts = stepped(x, y, w, h, c, tail), r = Math.min(RADIUS, w / 2, h / 2), p = new Path2D();
    // Corner points in stepped(): each corner is the 5 points around one of the box's corners; keep the tail's.
    const box = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const near = (q) => box.findIndex(([bx, by]) => Math.abs(q[0] - bx) <= c + 0.01 && Math.abs(q[1] - by) <= c + 0.01);
    const tailPts = pts.filter((q) => near(q) < 0);
    const tailAfter = tail ? { top: 0, right: 1, bottom: 2, left: 3 }[tail.side] : -1;
    p.moveTo(x + r, y);
    for (let i = 0; i < 4; i++) {
      if (i === tailAfter) for (const q of tailPts) p.lineTo(q[0], q[1]);
      const [ax, ay] = box[(i + 1) % 4], [bx, by] = box[(i + 2) % 4];
      p.arcTo(ax, ay, bx, by, r);
    }
    p.closePath();
    return p;
  };

  // Oat paper with a short hard shadow and a 1.5 px ink edge. strip: a 3 px accent strip along the top inside edge
  // with a 12 px corner tab (the bubble's: the ghost's colour, tangerine for Classic). o.edge overrides the edge colour.
  function chrome(c, x, y, w, h, o = {}) {
    const path = o.path || steppedPath(x, y, w, h, o.corner ?? 8, o.tail), edge = o.edge && o.edge !== ACC ? o.edge : INK;
    c.save();
    c.fillStyle = SHADOW; c.translate(0, 2); c.fill(path); c.translate(0, -2);
    c.fillStyle = o.fill || GLASS; c.fill(path);
    if (o.strip && w > 24) {
      c.save(); c.clip(path); c.fillStyle = o.strip;
      c.fillRect(x, y, w, 3); c.fillRect(x + w - 12, y, 12, 12);
      c.restore();
    }
    c.strokeStyle = edge; c.lineWidth = 1.5; c.stroke(path);
    c.restore();
  }

  const meas = document.createElement('canvas').getContext('2d');
  const textW = (s, font) => { meas.font = font; return meas.measureText(String(s ?? '')).width; };
  // Words typing themselves in; the last couple land white. Returns the full width.
  function typed(c, str, x, y, font, color, u = 1, o = {}) {
    str = String(str ?? '');
    c.save(); c.font = R.rtlFont ? R.rtlFont(str, font) : font; c.textBaseline = o.baseline || 'middle'; c.textAlign = 'left';
    const full = c.measureText(str).width, x0 = o.anchor === 'middle' ? x - full / 2 : o.anchor === 'end' ? x - full : x;
    const n = Math.floor(str.length * clamp(u, 0, 1));
    // On the stage: real DOM text (textlayer.js), the last couple of letters still in the secondary ink.
    const TL = R.textLayer;
    if (TL?.on(c)) {
      const head = n >= str.length ? str : str.slice(0, Math.max(0, n - 2)), tail = n >= str.length ? '' : str.slice(head.length, n);
      if (n > 0) TL.text(c, { html: TL.esc(head) + (tail ? `<span style="color:${INK_SOFT}">${TL.esc(tail)}</span>` : ''), x: x0, y, font: c.font, color, baseline: c.textBaseline });
      c.restore();
      return full;
    }
    if (n >= str.length) { c.fillStyle = color; c.fillText(str, x0, y); }
    else if (n > 0) { const head = str.slice(0, Math.max(0, n - 2)); c.fillStyle = color; c.fillText(head, x0, y); c.fillStyle = INK_SOFT; c.fillText(str.slice(head.length, n), x0 + c.measureText(head).width, y); }
    c.restore();
    return full;
  }
  // Lines of at most w px (a word wider than a line is broken); past max rows the last one ends in an ellipsis.
  function wrapRows(str, w, font, max = Infinity) {
    meas.font = font;
    const fits = (t) => meas.measureText(t).width <= w, rows = [];
    for (const para of String(str ?? '').split('\n')) {
      let row = '';
      for (let wd of para.split(/\s+/).filter(Boolean)) {
        const tr = row ? `${row} ${wd}` : wd;
        if (fits(tr)) { row = tr; continue; }
        if (row) { rows.push(row); row = ''; }
        while (!fits(wd)) { let k = wd.length - 1; while (k > 1 && !fits(wd.slice(0, k))) k--; rows.push(wd.slice(0, k)); wd = wd.slice(k); }
        row = wd;
      }
      rows.push(row);
    }
    if (rows.length > max) {
      const rest = rows.splice(max), full = `${rows[max - 1]} ${rest.join(' ')}`;
      let last = full;
      while (last && !fits(`${last}…`)) last = last.slice(0, -1);
      // End on a whole word when one is close, rather than mid-word.
      const sp = last.lastIndexOf(' ');
      if (full[last.length] !== ' ' && sp > last.length * 0.6) last = last.slice(0, sp);
      rows[max - 1] = `${last.trimEnd()}…`;
    }
    return rows;
  }
  // A hand-drawn ring: a slightly wobbly circle that overshoots where it closes, the same each time for one seed.
  const ringPts = (cx, cy, r, seed = 0) => Array.from({ length: 34 }, (_, i) => {
    const a = -2.2 + (i / 30) * Math.PI * 2, k = 1 + 0.06 * Math.sin(i * 1.7 + seed) + (i > 28 ? 0.08 : 0);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
  // A free stroke, cased: a 6 px oat stroke under the colour (2 px), so it reads on white and on dark; up to u of its length.
  function pen(c, pts, color, w = 2.2, u = 1) {
    const n = Math.max(2, Math.ceil(pts.length * clamp(u, 0, 1)));
    if (u <= 0) return;
    const path = new Path2D(); pts.slice(0, n).forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = EDGE; c.lineWidth = w + 4; c.stroke(path);
    c.strokeStyle = color; c.lineWidth = w; c.stroke(path);
    c.restore();
  }

  // A button like the drawings' chips (ink.js): filled is tangerine with ink text (the primary), otherwise oat with an
  // ink edge. focus adds a tangerine ring, so the keyboard's choice shows; down presses it into its hard shadow.
  const CHIP_F = `700 11px ${MONO}`, INK_DARK = INK;
  const mix = (a, b, k) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(',')})`;
  const chipW = (label) => Math.round(textW(label, CHIP_F) + 22);
  function chip(c, x, y, w, h, label, o = {}) {
    c.save();
    if (o.focus) { c.strokeStyle = HOT; c.lineWidth = 2; c.stroke(steppedPath(x - 3.5, y - 3.5, w + 7, h + 9, 6)); }
    if (o.down) c.translate(0, 2);
    c.fillStyle = SHADOW; c.fill(steppedPath(x, y + (o.down ? 1 : 2), w, h, 4));
    const face = steppedPath(x, y, w, h, 4);
    c.fillStyle = o.filled ? (o.hover ? mix(ACC, '#ffffff', 0.2) : ACC) : o.hover ? OAT2 : GLASS; c.fill(face);
    c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(face);
    c.font = CHIP_F; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK_DARK;
    const s = String(label ?? '');
    if (R.textLayer?.on(c)) R.textLayer.text(c, { str: s, x: x + w / 2 - textW(s, CHIP_F) / 2, y: y + h / 2 + 0.5, font: CHIP_F, color: INK_DARK });
    else c.fillText(s, x + w / 2, y + h / 2 + 0.5);
    c.restore();
  }

  R.glass = { ACC, HOT, MID, DEEP, EDGE, GLASS, TEXT, DIM, CORAL, NOTE, MONO, OAT, OAT2, INK, INK_SOFT, TANGERINE, RUST, SKY, BUTTER, SAGE, SHADOW, rgba, stepped, steppedPath, chrome, textW, typed, wrapRows, ringPts, pen, chip, chipW, CHIP_H: 23 };
})();

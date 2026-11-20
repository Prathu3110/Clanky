// The Clanky ghost: pixel-art sprite sheets from the design handoff (design/DESIGN.md, design/sprites). One sheet per
// ghost colour (the personality picks it: ivory, cobalt, green, pink) and per backdrop (light or dark, by the macOS
// appearance), 4 frames x 16 states of 32x32 cells, each frame with its own time from clanky-sprites.json.
// 10-dither.js draws it in place of the old LED looks; this file only loads sheets, keeps time and draws a frame.
(() => {
  const R = window.Clanky;
  const base = new URL('ghost/', document.currentScript?.src ?? location.href);
  const PERSONA_GHOST = { classic: 'ivory', butler: 'cobalt', sage: 'green', sassy: 'pink' };
  const CURSOR_ROW = { ivory: 0, cobalt: 1, green: 2, pink: 3 };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');

  let man = null;
  const states = new Map();
  fetch(new URL('clanky-sprites.json', base)).then((r) => r.json()).then((j) => {
    man = j;
    for (const s of j.states) states.set(s.id, { ...s, total: s.ms.reduce((a, b) => a + b, 0) });
  }).catch(() => {});
  const sheets = new Map();
  const sheet = (file) => {
    let im = sheets.get(file);
    if (!im) { im = new Image(); im.src = new URL(file, base).href; sheets.set(file, im); }
    return im.complete && im.naturalWidth ? im : null;
  };
  // design/RENDERING.md: on a 2x screen the 64 px ghost is 128 device px, so the 4x sheet is drawn 1:1 (nothing is
  // resampled); 2x likewise. Other sizes scale the 1x sheet by a whole number, smoothing off.
  const PRESCALED = [2, 4];
  const file = (name, s) => (s === 1 ? `${name}.png` : `${s}x/${name}@${s}x.png`);
  const best = (name, n) => {
    if (PRESCALED.includes(n)) { const im = sheet(file(name, n)); if (im) return [im, n]; }
    const im = sheet(file(name, 1));
    return im ? [im, 1] : null;
  };
  // Load every sheet up front, so a personality or appearance switch never shows a blank frame.
  for (const s of [1, ...PRESCALED]) {
    for (const g of Object.keys(CURSOR_ROW)) for (const v of ['light', 'dark']) sheet(file(`clanky-${g}-${v}`, s));
    for (const v of ['light', 'dark']) sheet(file(`clanky-cursor-${v}`, s));
  }

  const G = (R.ghost = {
    color: 'ivory',
    colorOf: (p) => PERSONA_GHOST[p] ?? 'ivory',
    // The bubble's accent strip: the ghost's body colour; tangerine for Classic (its ivory would vanish on oat).
    accent: () => ({ ivory: '#F2A65A', cobalt: '#3468CE', green: '#30945F', pink: '#FF4F9A' })[G.color],
    setPersonality(p) { G.color = G.colorOf(p); },
    // Light or dark sheet by the macOS appearance (design/DESIGN.md).
    dark: () => darkMQ.matches,
    ready: () => !!man,
    // A state's per-frame times (ms), for the native follower to play the same loop; force pins a frame while it's captured.
    timing: (id) => (states.get(id) ?? states.get('idle'))?.ms ?? [500],
    force: null,
    // The frame of a state at time t (seconds), by its own per-frame times; frame 0 under reduced motion.
    frame(id, t, reduced) {
      const s = states.get(id) ?? states.get('idle');
      if (G.force != null) return G.force;
      if (!s || reduced) return 0;
      let ms = (t * 1000) % s.total;
      for (let i = 0; i < s.ms.length; i++) { if (ms < s.ms[i]) return i; ms -= s.ms[i]; }
      return 0;
    },
    // Draws the ghost centred on (x, y) at a whole-number scale. show: 0..1 for a Bayer dither in/out (1 = all of it).
    draw(ctx, x, y, { state = 'idle', t = 0, scale = 2, reduced = false, show = 1, dpr = 1, dark = G.dark(), color = G.color } = {}) {
      const s = states.get(state) ?? states.get('idle');
      if (!s) return null;
      const name = `clanky-${color}-${dark ? 'dark' : 'light'}`, got = best(name, Math.round(scale * dpr));
      if (!got) return null;
      const c = man.cell, f = G.frame(state, t, reduced), size = c * scale;
      // Whole device pixels: a part-pixel spot blurs pixel art even with smoothing off.
      const X = Math.round((x - size / 2) * dpr) / dpr, Y = Math.round((y - size / 2) * dpr) / dpr;
      blit(ctx, got[0], got[1], name, f * c, s.row * c, c, X, Y, size, show);
      return { x: X, y: Y, w: size, h: size, key: s.row * 8 + f };
    },
    // The cursor-size ghost with its top-left on the pointer's tip.
    cursor(ctx, x, y, { t = 0, reduced = false, show = 1, dpr = 1, color = G.color } = {}) {
      if (!man) return null;
      const name = `clanky-cursor-${G.dark() ? 'dark' : 'light'}`, sc = man.cursor.scale, got = best(name, Math.round(sc * dpr));
      if (!got) return null;
      const c = man.cursor.cell, f = reduced ? 0 : Math.floor((t * 1000) / man.cursor.ms) % man.cursor.frames;
      const X = Math.round(x * dpr) / dpr, Y = Math.round(y * dpr) / dpr;
      blit(ctx, got[0], got[1], name, f * c, CURSOR_ROW[color] * c, c, X, Y, c * sc, show);
      return { x: X, y: Y, w: c * sc, h: c * sc, key: 200 + f };
    },
  });

  // One cell (sx, sy, c: in 1x sprite pixels; im is the sheet at scale s), crisp. While it dithers in or out it goes
  // through a Bayer 4x4 threshold per sprite pixel, cut from the 1x sheet.
  const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d', { willReadFrequently: true });
  function blit(ctx, im, s, name, sx, sy, c, X, Y, size, show) {
    if (show <= 0) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (show >= 1) ctx.drawImage(im, sx * s, sy * s, c * s, c * s, X, Y, size, size);
    else {
      const base = sheet(file(name, 1));
      if (!base) { ctx.restore(); return; }
      const sw = c, sh = c;
      tmp.width = sw; tmp.height = sh;
      tctx.clearRect(0, 0, sw, sh); tctx.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
      const d = tctx.getImageData(0, 0, sw, sh), a = d.data, cut = show * 16;
      for (let py = 0; py < sh; py++) for (let px = 0; px < sw; px++) if (BAYER[(py & 3) * 4 + (px & 3)] >= cut) a[(py * sw + px) * 4 + 3] = 0;
      tctx.putImageData(d, 0, 0);
      ctx.drawImage(tmp, 0, 0, sw, sh, X, Y, size, size);
    }
    ctx.restore();
  }
})();

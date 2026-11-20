// The mini agent: the Clanky ghost (ghost.js) at 1x on a small canvas, in the poses of a background agent's life:
// hatch, fly, work, wait, done, fail, stop, as the sprite states (dithering in and out for hatch and stop). Also the
// pixel-art file icons of the "made" shelf and fileKind.
// API: Clanky.minis.draw(ctx, { size, dpr, pose, t, time, glyph, vx, vy, squash, reduce, seed }), .icon(kind),
//      .fileKind(name, dir), .KINDS
(() => {
  const R = window.Clanky;

  // ---------- which icon a file gets ----------
  const EXT = {
    doc: 'txt md markdown rtf doc docx odt pages', pdf: 'pdf', web: 'html htm', image: 'png jpg jpeg gif webp svg bmp tif tiff heic ico avif',
    sheet: 'csv tsv xls xlsx ods numbers', slides: 'ppt pptx key odp',
    code: 'js mjs cjs ts tsx jsx py rb go rs java c cc cpp h hpp cs css scss json yml yaml toml sh bash zsh swift kt php sql xml lua',
    model: 'stl obj glb gltf fbx 3mf usdz ply blend', audio: 'mp3 wav m4a aac flac ogg opus aiff aif', video: 'mp4 mov webm mkv avi m4v',
    archive: 'zip tar gz tgz bz2 xz 7z rar dmg',
  };
  const BY_EXT = new Map(Object.entries(EXT).flatMap(([k, list]) => list.split(' ').map((e) => [e, k])));
  const KINDS = ['folder', 'doc', 'pdf', 'web', 'image', 'sheet', 'slides', 'code', 'model', 'audio', 'video', 'archive', 'other'];
  const fileKind = (name, dir = false) => {
    const n = String(name ?? '');
    if (dir || n.endsWith('/')) return 'folder';
    const m = /\.([a-z0-9]+)$/i.exec(n);
    return (m && BY_EXT.get(m[1].toLowerCase())) || 'other';
  };

  // ---------- pixel-art file icons: 12x12 grids in the design tokens' ink, oat and tangerine ----------
  const INK = { k: '#2a2420', d: '#5e5248', m: '#c9bdad', a: '#f2a65a', h: '#ffffff' };
  const blank = () => Array.from({ length: 12 }, () => Array(12).fill('.'));
  const put = (g, cells, ch) => { for (const [r, c] of cells) if (g[r]?.[c] != null) g[r][c] = ch; };
  const row = (g, r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  const box = (g, r0, c0, r1, c1, fill) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = r === r0 || r === r1 || c === c0 || c === c1 ? 'a' : fill;
  };
  // A page with its corner folded over.
  const PAGE = ['.aaaaaaa....', '.adddddaa...', '.adddddama..', '.adddddaaaa.', ...Array(7).fill('.adddddddda.'), '.aaaaaaaaaa.'];
  const page = () => PAGE.map((r) => r.split(''));
  const GRIDS = {
    doc: () => { const g = page(); row(g, 2, 2, 5, 'h'); row(g, 5, 2, 8, 'm'); row(g, 7, 2, 9, 'm'); row(g, 9, 2, 6, 'm'); return g; },
    pdf: () => { const g = page(); row(g, 2, 2, 5, 'h'); row(g, 5, 2, 8, 'm'); for (let r = 7; r <= 9; r++) row(g, r, 2, 9, 'a'); put(g, [[8, 3], [8, 5], [8, 7]], 'k'); return g; },
    sheet: () => { const g = page(); row(g, 4, 2, 9, 'a'); for (const r of [6, 8]) row(g, r, 2, 9, 'm'); for (let r = 5; r <= 10; r++) put(g, [[r, 4], [r, 7]], 'm'); return g; },
    code: () => { const g = page(); put(g, [[6, 3], [7, 2], [8, 3], [6, 8], [7, 9], [8, 8], [5, 6], [6, 6], [7, 5], [8, 5], [9, 4]], 'h'); return g; },
    audio: () => { const g = page(); put(g, [[4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [4, 8], [5, 9], [8, 5], [8, 6], [9, 4], [9, 5], [9, 6]], 'h'); return g; },
    video: () => { const g = page(); put(g, [[5, 4], [6, 4], [6, 5], [7, 4], [7, 5], [7, 6], [8, 4], [8, 5], [9, 4]], 'h'); return g; },
    archive: () => { const g = page(); for (let r = 1; r <= 7; r++) put(g, [[r, r % 2 ? 5 : 6]], 'h'); for (const r of [8, 9]) row(g, r, 5, 6, 'a'); return g; },
    other: () => { const g = page(); row(g, 5, 2, 8, 'm'); row(g, 7, 2, 7, 'm'); return g; },
    folder: () => { const g = blank(); box(g, 2, 0, 10, 11, 'd'); row(g, 1, 1, 4, 'a'); row(g, 4, 1, 10, 'm'); return g; },
    web: () => {
      const g = blank(); box(g, 1, 0, 10, 11, 'd'); row(g, 2, 1, 10, 'a'); put(g, [[2, 2], [2, 4], [2, 6]], 'k');
      put(g, [[4, 5], [4, 6], [5, 4], [5, 7], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [7, 4], [7, 7], [8, 5], [8, 6]], 'h');
      put(g, [[5, 5], [5, 6], [7, 5], [7, 6]], 'm'); return g;
    },
    image: () => {
      const g = blank(); box(g, 1, 0, 10, 11, 'd'); put(g, [[3, 8], [3, 9], [4, 8], [4, 9]], 'h');
      put(g, [[5, 4], [6, 3], [6, 4], [6, 5], [6, 8]], 'a'); row(g, 7, 2, 6, 'm'); row(g, 7, 7, 9, 'm'); row(g, 8, 1, 10, 'm'); row(g, 9, 1, 10, 'm'); return g;
    },
    slides: () => {
      const g = blank(); box(g, 1, 0, 8, 11, 'd'); put(g, [[6, 2], [7, 2], [5, 4], [6, 4], [7, 4], [6, 8], [7, 8], [5, 8]], 'm');
      put(g, [[3, 6], [4, 6], [5, 6], [6, 6], [7, 6]], 'h'); row(g, 9, 5, 6, 'a'); row(g, 10, 3, 8, 'a'); return g;
    },
    model: () => ['............', '.....hh.....', '...hhhhhh...', '.hhhhhhhhhh.', '.aahhhhhhmm.', '.aaaahhmmmm.', '.aaaaammmmm.', '.aaaaammmmm.', '.aaaaammmmm.', '.aaaaammmmm.', '...aaammm...', '.....am.....'].map((r) => r.split('')),
  };
  const icons = new Map();
  // An inline SVG, one rect per lit cell (crisp at any scale). Decorative: the tile's button carries the name.
  const icon = (kind) => {
    if (icons.has(kind)) return icons.get(kind);
    const g = (GRIDS[kind] ?? GRIDS.other)();
    let rects = '';
    g.forEach((r, y) => r.forEach((ch, x) => { if (INK[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${INK[ch]}"/>`; }));
    const svg = `<svg viewBox="0 0 12 12" width="36" height="36" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
    icons.set(kind, svg);
    return svg;
  };

  // ---------- the mini agent ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Small glyphs (6x6, '#' lit) for what it's doing: writing, the web, a command, reading.
  const GLYPHS = {
    pen: ['....##', '...###', '..###.', '.###..', '##....', '#.....'],
    lens: ['.###..', '#...#.', '#...#.', '.###..', '....#.', '.....#'],
    gear: ['#.##.#', '.####.', '##..##', '##..##', '.####.', '#.##.#'],
    eye: ['......', '.####.', '#.##.#', '#.##.#', '.####.', '......'],
  };
  const bits = (ctx, rows, x, y, px, color) => {
    ctx.fillStyle = color;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(Math.round(x + i * px), Math.round(y + j * px), px, px); });
  };
  // A background agent's pose as the ghost's sprite state; the sprite carries the '?', sparkle and sweat drop.
  const STATE = { hatch: 'idle', fly: 'idle', work: 'working', wait: 'waiting', done: 'done', fail: 'error', stop: 'idle' };

  /** Draws one frame of a mini on a canvas of size x size CSS px. t: seconds in this pose; time: a shared clock. */
  function draw(ctx, { size = 32, dpr = 1, pose = 'work', t = 0, time = 0, glyph = null, reduce = false, seed = 0 } = {}) {
    const G = R.glass;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // hatch dithers in, stop dithers out (200 ms, the design's dither wipe).
    const show = pose === 'hatch' ? (reduce ? 1 : clamp(t / 0.2, 0, 1)) : pose === 'stop' ? (reduce ? 0 : 1 - clamp(t / 0.2, 0, 1)) : 1;
    R.ghost?.draw(ctx, size / 2, size / 2, { state: STATE[pose] ?? 'idle', t: time + seed * 0.37, scale: 1, reduced: reduce, show, dpr });
    if (pose === 'work' && glyph && GLYPHS[glyph]) bits(ctx, GLYPHS[glyph], size - 7, 0, 1, G?.INK ?? '#2A2420');
    // The pen's tick and cross (agent-cards.js draws the same marks).
    if (pose === 'done' && G && size > 24) G.pen(ctx, [[size - 10, 6], [size - 7.5, 8.5], [size - 3, 2.5]], G.INK, 2, reduce ? 1 : clamp((t - 0.4) / 0.3, 0, 1));
    if (pose === 'fail' && G) { G.pen(ctx, [[size - 9, 2.5], [size - 3, 8.5]], G.CORAL, 2, reduce ? 1 : clamp(t / 0.15, 0, 1)); G.pen(ctx, [[size - 3, 2.5], [size - 9, 8.5]], G.CORAL, 2, reduce ? 1 : clamp((t - 0.1) / 0.15, 0, 1)); }
  }

  R.minis = { draw, icon, fileKind, KINDS, GLYPHS: Object.keys(GLYPHS) };
})();

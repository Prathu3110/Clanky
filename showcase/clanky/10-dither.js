// The character kit: the Clanky ghost (ghost.js) with its moves, sizes, acts and presence performances, and a small
// pixel grid in a fixed palette for what plugins and particles draw. Clanky.ditherKit(options) returns a definition.
(() => {
  const bayer = (n) => {
    let M = [[0]];
    while (M.length < n) {
      const s = M.length, Q = [[0, 2], [3, 1]], N = [];
      for (let y = 0; y < s * 2; y++) { N.push([]); for (let x = 0; x < s * 2; x++) N[y][x] = M[y % s][x % s] * 4 + Q[(y / s) | 0][(x / s) | 0]; }
      M = N;
    }
    return { n, t: Float32Array.from(M.flat(), (v) => (v + 0.5) / (n * n)) };
  };
  const fixed = (n, rows) => ({ n, t: Float32Array.from(rows.flat(), (v) => (v + 0.5) / (n * n)) });
  const PATTERNS = {
    bayer4: bayer(4),
    bayer8: bayer(8),
    dots: fixed(4, [[12, 5, 6, 13], [4, 0, 1, 7], [11, 3, 2, 8], [15, 10, 9, 14]]),
    lines: fixed(4, [[0, 0, 0, 0], [8, 8, 8, 8], [4, 4, 4, 4], [12, 12, 12, 12]].map((r, i) => r.map((v) => v + i))),
  };

  Clanky.ditherKit = (o) => ({
    id: o.id,
    label: o.label,
    bg: o.bg ?? `rgb(${o.pal[0].join(',')})`,
    create(env) {
      const { clamp, rand } = Clanky;
      const S = (n) => Clanky.sfx?.play(n);
      const PAL = o.pal, L = PAL.length - 1;
      const { n: PN, t: PT } = PATTERNS[o.pattern ?? 'bayer4'], PM = PN - 1;
      // The dither pattern is pinned to the screen, or to the body while it follows the cursor (tox, toy: its cell),
      // so the shading doesn't crawl across it as it moves.
      let tox = 0, toy = 0;
      const th = (gx, gy) => PT[((gy - toy) & PM) * PN + ((gx - tox) & PM)];
      const K = o.matrix ? 4 : 1;
      const GAP = PAL[0].map((c) => (c * 0.7) | 0);
      const SCAN = o.scan ?? 1;
      const m = new Clanky.Mover(env, { speed: o.speed ?? 95, accel: 2.4 });
      const face = new Clanky.Face();
      const sq = new Clanky.Spring(170, 8);
      const tail = Array.from({ length: 3 }, () => ({ x: m.x, y: m.y, vx: 0, vy: 0 }));
      const ears = o.ears ? [-1, 1].map((s) => ({ s, x: m.x, y: m.y, vx: 0, vy: 0 })) : [];
      const ant = o.antenna ? Array.from({ length: 6 }, () => ({ x: m.x, y: m.y, vx: 0, vy: 0 })) : null;
      const drips = [];
      // Sidekick acts: little performances with pop-out hands, a pixel speech icon and particles.
      const ACTS = ['wave', 'hype', 'remind', 'upset', 'motivate'];
      const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('act') : null;
      // Size: 'default', 'small' (half the body) or 'cursor' (a pixel arrow pointer). Text keeps its size either way.
      let form = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('form')) || 'default', lastEnv = null;
      let userForm = form;
      // The look: the Clanky ghost (ghost.js), coloured by the personality. Moves, sizes and the rest are shared.
      const look = 'ghost';
      const GH = () => Clanky.ghost;
      // Each hand springs to its pose in the body's own space (o: its offset from the body), so it moves with the body
      // however fast that goes, and only eases between poses. x, y: where that puts it now.
      const hands = [-1, 1].map((s) => ({ s, x: m.x, y: m.y, o: { x: 0, y: 0, vx: 0, vy: 0 } }));
      const parts = [];
      let act = null, pending = null, arms = 0, ox = 0, oy = 0, prevHop = 0;
      let actIdx = [...o.id].reduce((a, c) => a + c.charCodeAt(0), 0) % ACTS.length, nextAct = rand(1.2, 3);
      // Presence: 'shown' | 'hidden' | 'in' (entering) | 'out' (leaving); v is the variant playing.
      const pres = { state: 'shown', u: 1, v: null, tx: 0, ty: 0, landed: false, launched: false, crouched: false };
      let mask = null, EW = 800, EH = 600;
      const startAct = (name, quiet) => {
        if (pres.state !== 'shown') { pending = name; return; }
        act = { name, a: 0, dur: name === 'upset' ? 3.4 : name === 'hype' ? 2.8 : 3.1 };
        m.mode = 'rest'; m.rest = act.dur;
        if (name === 'remind') face.set('surprised', 0.3);
        if (!quiet) S(name);
      };
      let wasFlung = false, wasAsleep = false, snoreT = 3;
      const spawn = (x, y, vx, vy, g, lvl, size = 0, rate = 1) => parts.push({ x, y, vx, vy, g, lvl, size, rate, life: 1 });
      let P = 4, gw = 0, gh = 0, IW = 0, IH = 0, R = 40, t = 0, dripT = 0.6;
      const off = document.createElement('canvas');
      const octx = off.getContext('2d');
      const bloom = o.glow ? document.createElement('canvas') : null;
      const bctx = bloom?.getContext('2d');
      let img = null, d = null, clear = false, u32 = null;
      // Cells written this frame (dx/dy), last frame's (pd, cleared before the next), and the patch to show (rect).
      let dx0 = 0, dy0 = 0, dx1 = -1, dy1 = -1, pd = null, rect = null, ready = false;
      const spring = (p, tx, ty, k, c, dt) => { p.vx += ((tx - p.x) * k - p.vx * c) * dt; p.vy += ((ty - p.y) * k - p.vy * c) * dt; p.x += p.vx * dt; p.y += p.vy * dt; };

      // Writes one logical pixel; in matrix mode it becomes a 3x3 dot with a one-subpixel gap.
      const setPx = (gx, gy, c, a = 255, solid = false) => {
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return;
        if (mask) { const r = mask(gx, gy); if (!r) return; if (r === 2) c = PAL[L]; }
        if (gx < dx0) dx0 = gx; if (gx > dx1) dx1 = gx; if (gy < dy0) dy0 = gy; if (gy > dy1) dy1 = gy;
        const f = SCAN !== 1 && gy & 1 ? SCAN : 1;
        const r = c[0] * f, g = c[1] * f, b = c[2] * f;
        if (K === 1) { const i = (gy * IW + gx) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; return; }
        for (let j = 0; j < K; j++) for (let k = 0; k < K; k++) {
          const i = ((gy * K + j) * IW + gx * K + k) * 4;
          const on = j < 3 && k < 3 && !((j !== 1) && (k !== 1) && o.round);
          if (on) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
          else if (!clear || solid) { d[i] = GAP[0]; d[i + 1] = GAP[1]; d[i + 2] = GAP[2]; d[i + 3] = solid ? a : 255; }
        }
      };
      const put = (x, y, lvl = 0) => setPx(x, y, PAL[clamp(lvl, 0, L)]);
      const line = (x0, y0, x1, y1, lvl) => {
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / P));
        for (let i = 0; i <= n; i++) put(Math.round((x0 + ((x1 - x0) * i) / n) / P), Math.round((y0 + ((y1 - y0) * i) / n) / P), lvl);
      };
      const disc = (cx, cy, rx, ry, lvl) => {
        for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++)
          if ((xx * xx) / (rx * rx + 0.5) + (yy * yy) / (ry * ry + 0.5) <= 1) put(cx + xx, cy + yy, lvl);
      };

      // Where the pointer's tip is from the body point, in cells (the pen draws with the tip).
      const AX = 4, AY = 7;

      // ---------- the ghost ----------
      let gpos = null, gstate = 'idle';
      const GSCALE = () => (form === 'small' ? 1 : 2);
      // Its box on screen: centred on the body point, or at cursor size with its top-left on the pointer's tip.
      const ghostBox = (bx, by) => {
        if (form === 'cursor') { const x = bx - AX * P, y = by - AY * P; return [x, y, x + 20, y + 20]; }
        const h = 16 * GSCALE(); return [bx - h, by - h, bx + h, by + h];
      };
      // What it's doing, as one of the sprite sheet's states: an act, else what the agent layer is doing, else its mood.
      const ACT_STATE = { wave: 'wave', hype: 'hype', remind: 'remind', upset: 'error', motivate: 'motivate' };
      const ghostState = (env) => {
        if (act) return ACT_STATE[act.name] ?? 'idle';
        const s = plug?.state?.();
        if (s) return s;
        if (Clanky.offline) return 'offline';
        if ((env.sleepy ?? 0) > 0.5 || (face.sleepy ?? 0) > 0.5) return 'asleep';
        if (face.happy > 0.6) return 'done';
        if (face.dizzy > 0.5) return 'error';
        return 'idle';
      };
      // How much of it shows: a Bayer dither in and out while it materializes or leaves that way (1 = all of it).
      const ghostShow = () => (pres.v === 'materialize' && pres.state === 'in' ? pres.u : pres.v === 'materialize' && pres.state === 'out' ? 1 - pres.u : 1);
      const ghostKey = (env) => {
        const g = GH();
        if (!g) return 0;
        const f = g.frame(gstate, t, env.reduced);
        return (gstate.length * 131 + gstate.charCodeAt(0) * 7 + f * 1009 + (g.dark() ? 7919 : 0) + g.color.charCodeAt(0) * 104729) | 0;
      };
      const drawGhost = (ctx, env) => {
        const g = GH();
        if (!g || !gpos || pres.state === 'hidden') return;
        const o2 = { state: gstate, t, reduced: !!env.reduced, show: ghostShow(), dpr: env.dpr || 1 };
        if (form === 'cursor') g.cursor(ctx, gpos.x - AX * P, gpos.y - AY * P, o2);
        else g.draw(ctx, gpos.x, gpos.y, { ...o2, scale: GSCALE() });
      };

      // ---------- presence performances ----------
      // materialize: LED pixels sparkle in from the centre / beam up and away from the top down
      // crt: a scanline powers on and opens into the body / collapses to a line, then a dot
      // drop: falls in from the top edge and lands / crouches and jumps off the top edge
      const PRES = {
        materialize: { in: 0.72, out: 0.8, sIn: 'materialize', sOut: 'dematerialize' },
        crt: { in: 0.56, out: 0.55, sIn: 'crt_on', sOut: 'crt_off' },
        drop: { in: 0.62, out: 0.66, sIn: 'drop', sOut: null },
      };
      const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const teleport = (x, y) => {
        m.x = x; m.y = y; m.vx = m.vy = 0; m.tx = x; m.ty = y; m.mode = 'rest'; m.rest = 1.5; m.flung = false; m.dragging = false;
        for (const q of tail) { q.x = x; q.y = y; q.vx = q.vy = 0; }
        for (const h of hands) { h.x = x; h.y = y; Object.assign(h.o, { x: 0, y: 0, vx: 0, vy: 0 }); }
        for (const e of ears) { e.x = x; e.y = y - R; e.vx = e.vy = 0; }
        if (ant) for (const q of ant) { q.x = x; q.y = y - R; q.vx = q.vy = 0; }
        drips.length = 0; parts.length = 0; arms = 0; m.stretch = 0;
      };
      const dust = (x, y, n) => {
        for (let i = 0; i < n; i++) {
          const s = i % 2 ? 1 : -1;
          spawn(x + s * rand(0.2, 0.9) * R, y, s * rand(60, 220), rand(-120, -20), 420, rand(0, 1) < 0.5 ? L : L - 1, i % 3 === 0 ? 1 : 0, 1.8);
        }
      };
      const appear = (variant, x = m.x, y = m.y) => {
        if (pres.state === 'shown' || pres.state === 'in') return false;
        const v = PRES[variant] ? variant : 'materialize';
        x = clamp(x, R * 1.5, EW - R * 1.5); y = clamp(y, R * 1.6, EH - R * 1.5);
        Object.assign(pres, { state: 'in', u: 0, v, tx: x, ty: y, landed: false, launched: false, crouched: false });
        act = null;
        teleport(x, v === 'drop' ? -R * 2.4 : y);
        face.set(v === 'drop' ? 'surprised' : null, v === 'drop' ? 0.7 : 0);
        S(PRES[v].sIn);
        return true;
      };
      const vanish = (variant, instant = false) => {
        if (instant) { Object.assign(pres, { state: 'hidden', u: 1 }); act = null; pending = null; parts.length = 0; m.dragging = false; return true; }
        if (pres.state === 'hidden' || pres.state === 'out') return false;
        const v = PRES[variant] ? variant : 'materialize';
        Object.assign(pres, { state: 'out', u: 0, v, tx: m.x, ty: m.y, landed: false, launched: false, crouched: false });
        act = null; pending = null; m.mode = 'rest'; m.vx = m.vy = 0; m.dragging = false; m.flung = false;
        if (PRES[v].sOut) S(PRES[v].sOut);
        if (v === 'materialize') face.set('happy', 0.5);
        return true;
      };
      // Front of the materialize dissolve, shared by the mask and the particle spray.
      const front = () => (pres.state === 'in' ? pres.u * 1.25 - 0.1 : pres.u * 1.2 - 0.05);
      // Keep the goo tail in a tight streak behind a fast vertical move instead of lagging into lobes.
      const streak = (dir) => tail.forEach((q, i) => { q.x = m.x; q.y = m.y + dir * (i + 1) * R * 0.16; q.vx = 0; q.vy = 0; });
      const presStep = (dt) => {
        const p = pres, D = PRES[p.v], u = (p.u = Math.min(1, p.u + dt / (p.state === 'in' ? D.in : D.out)));
        if (p.v === 'drop' && p.state === 'in') {
          const fall = 0.58;
          if (u < fall) {
            const k = u / fall, y0 = -R * 2.4, ny = y0 + (p.ty - y0) * k * k;
            m.y = ny; m.x = p.tx; m.ang = Math.PI / 2; m.stretch = 0.12 + k * 0.38;
            streak(-1);
            if (k > 0.15 && Math.random() < dt * 40) spawn(m.x + rand(-0.4, 0.4) * R, m.y - R * 1.2, rand(-20, 20), rand(-60, -10), 0, L - 1, 0, 2.6);
          } else if (!p.landed) {
            p.landed = true; m.y = p.ty; m.ang = 0; m.stretch = 0; streak(0); sq.kick(26); S('land'); dust(m.x, m.y + R * 0.92, 18); face.set('happy', 0.9);
          }
        } else if (p.v === 'drop') {
          const crouch = 0.3;
          if (u < crouch) {
            m.ang = 0; streak(0); if (!p.crouched) { p.crouched = true; sq.kick(12); face.set('happy', 1); }
          } else {
            if (!p.launched) { p.launched = true; S('jump'); dust(m.x, m.y + R * 0.92, 12); }
            const k = (u - crouch) / (1 - crouch), y1 = -R * 3.2;
            m.y = p.ty + (y1 - p.ty) * Math.pow(k, 1.6); m.ang = Math.PI / 2; m.stretch = 0.18 + k * 0.32;
            streak(1);
            if (Math.random() < dt * 50) spawn(m.x + rand(-0.4, 0.4) * R, m.y + R * 1.1, rand(-20, 20), rand(10, 60), 0, L - 1, 0, 2.6);
          }
        } else {
          m.stretch = Clanky.damp(m.stretch, 0, 8, dt);
          if (p.v === 'materialize' && p.state === 'in' && u < 0.7) {
            // sparks converge on the body from a ring around it
            for (let i = 0; i < Math.ceil(dt * 90); i++) {
              const a = rand(0, Math.PI * 2), r0 = R * rand(1.6, 2.4), sp = r0 / 0.42;
              spawn(m.x + Math.cos(a) * r0, m.y + Math.sin(a) * r0, -Math.cos(a) * sp, -Math.sin(a) * sp, 0, rand(0, 1) < 0.6 ? L : L - 1, 0, 2.4);
            }
          }
          if (p.v === 'materialize' && p.state === 'out' && u > 0.04 && u < 0.95) {
            // pixels lift off the dissolving front and float up
            const fy = m.y - R * 1.3 + clamp(front(), 0, 1) * R * 2.7;
            for (let i = 0; i < Math.ceil(dt * 120); i++) spawn(m.x + rand(-1, 1) * R * 0.95, fy + rand(-0.1, 0.1) * R, rand(-25, 25), rand(-210, -70), -180, rand(0, 1) < 0.55 ? L : L - 1, 0, 1.5);
          }
        }
        if (u >= 1) {
          if (p.state === 'in') {
            p.state = 'shown'; m.y = p.ty; m.x = p.tx; m.vx = m.vy = 0; m.ang = 0; m.mode = 'rest'; m.rest = 1.5;
            if (p.v !== 'drop') sq.kick(p.v === 'crt' ? 5 : 10);
            nextAct = rand(4, 7);
          } else { p.state = 'hidden'; parts.length = 0; }
        }
      };
      // Blink: its screen switches off, mid() runs while nothing is drawn (it is moved somewhere else) and it switches
      // back on there, so it hops between the spots it works on in another app without crossing the screen. The CRT
      // picture of show and hide, quicker. A straight cut under reduced motion, or when it isn't fully shown.
      const BLINK = { out: 0.16, in: 0.2 };
      let bl = null;
      const blinkMid = () => {
        const x0 = m.x, y0 = m.y;
        bl.mid?.();
        // What trails the body arrives with it, instead of stretching over from where it was.
        const dx = m.x - x0, dy = m.y - y0;
        for (const q of [...tail, ...hands, ...ears, ...(ant ?? [])]) { q.x += dx; q.y += dy; }
      };
      const blinkCut = () => { if (!bl) return; if (bl.dir === 'out') blinkMid(); const r = bl.res; bl = null; r(); };
      const blink = (mid) => new Promise((res) => {
        blinkCut(); // one at a time: a hop still playing lands first
        bl = { dir: 'out', u: 0, mid, res };
        if (lastEnv?.reduced || pres.state !== 'shown') blinkCut();
      });
      const blinkStep = (dt) => {
        if (!bl) return;
        if (pres.state !== 'shown') { blinkCut(); return; }
        bl.u = Math.min(1, bl.u + dt / BLINK[bl.dir]);
        if (bl.u < 1) return;
        if (bl.dir === 'out') { blinkMid(); bl.dir = 'in'; bl.u = 0; } else blinkCut();
      };
      // CRT: scale the finished frame around the body; returns null when not playing.
      const crtXform = () => {
        if (!bl && (pres.v !== 'crt' || (pres.state !== 'in' && pres.state !== 'out'))) return null;
        const u = bl ? bl.u : pres.u;
        if ((bl ? bl.dir : pres.state) === 'in') {
          if (u < 0.28) { const a = smooth(u / 0.28); return { sx: a * 1.25, sy: 0.03, line: 1, flash: 1, dot: 0 }; }
          if (u < 0.75) { const b = smooth((u - 0.28) / 0.47); return { sx: 1.25 - 0.29 * b, sy: 0.03 + 1.11 * b, line: 1 - b, flash: 1 - b * 0.7, dot: 0 }; }
          const c = smooth((u - 0.75) / 0.25); return { sx: 0.96 + 0.04 * c, sy: 1.14 - 0.14 * c, line: 0, flash: 0.3 * (1 - c), dot: 0 };
        }
        if (u < 0.42) { const a = smooth(u / 0.42); return { sx: 1 + 0.3 * a, sy: 1 - 0.97 * a, line: a, flash: a * 0.9, dot: 0 }; }
        if (u < 0.78) { const b = smooth((u - 0.42) / 0.36); return { sx: 1.3 * (1 - b), sy: 0.03, line: 1, flash: 0.9, dot: b }; }
        const c = (u - 0.78) / 0.22; return { sx: 0, sy: 0.03, line: 0, flash: 0, dot: 1 - c };
      };

      // Morph between its size and its cursor form (for drawings). The body has no in-between sizes, so the finished
      // frame is scaled, squashed and turned around the body point (like the CRT effect), and the form swaps at the
      // smallest moment. Each morph picks a style other than the last and jitters its timing, so no two look the same;
      // LED sparks gather in (shrinking) or burst out (growing).
      const MORPHS = ['swirl', 'squash', 'shake'], lerp = Clanky.lerp;
      let mo = null, lastMorph = null;
      const mEase = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
      const mBack = (u) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
      const sparks = (inward, n, spread) => {
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), r = rand(spread * 0.6, spread * 1.3), sp = rand(0.7, 1.2) * r / 0.4, lvl = Math.max(1, L - Math.floor(rand(0, 3)));
          if (inward) spawn(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, -Math.cos(a) * sp, -Math.sin(a) * sp, 0, lvl, 0, 2.6);
          else spawn(m.x + Math.cos(a) * R * 0.3, m.y + Math.sin(a) * R * 0.3, Math.cos(a) * sp, Math.sin(a) * sp, 120, lvl, 0, 2);
        }
      };
      const morphStep = (dt) => {
        if (!mo) return;
        if (pres.state !== 'shown' || mo.instant) { if (!mo.swapped) swapForm(mo.to); const r = mo.res; mo = null; r(); return; }
        mo.t += dt;
        if (!mo.swapped && mo.t >= mo.d1) {
          mo.swapped = true; swapForm(mo.to); S(mo.toCursor ? 'pop' : 'expand');
          if (!mo.toCursor) sparks(false, Math.round(rand(16, 26)), R * rand(1.8, 2.6));
        }
        if (mo.t >= mo.d1 + mo.d2) { const r = mo.res; mo = null; sq.kick(rand(8, 14)); face.set('happy', rand(0.7, 1.1)); r(); }
      };
      // { sx, sy, rot, lift } around the body point while morphing, else null.
      const morphXform = () => {
        if (!mo || mo.instant) return null;
        const { style } = mo;
        if (mo.t < mo.d1) {
          const u = mo.t / mo.d1, e = u * u, k = lerp(1, mo.small, e);
          if (style === 'swirl') return { sx: k, sy: k, rot: mo.turn * e, lift: 0 };
          if (style === 'squash') { const q = Math.sin(Math.min(1, u / 0.45) * Math.PI); return { sx: k * (1 + 0.28 * q), sy: k * (1 - 0.32 * q), rot: 0, lift: u > 0.45 ? (u - 0.45) * 40 : 0 }; }
          return { sx: k, sy: k, rot: Math.sin(u * Math.PI * 7) * 0.22 * (1 - u * 0.5), lift: 0 };
        }
        const u = clamp((mo.t - mo.d1) / mo.d2, 0, 1), sc = lerp(mo.start, 1, mBack(u)) + Math.sin(u * Math.PI) * mo.over * (1 - u);
        if (style === 'squash') { const st = Math.sin(u * Math.PI) * 0.22; return { sx: sc * (1 - st * 0.6), sy: sc * (1 + st), rot: 0, lift: Math.sin(u * Math.PI) * mo.hop }; }
        return { sx: sc, sy: sc, rot: style === 'swirl' ? -mo.turn * 0.35 * (1 - mEase(u)) : 0, lift: 0 };
      };
      const morph = (to) => new Promise((res) => {
        const f = ['small', 'cursor'].includes(to) ? to : 'default';
        if (mo) { const r = mo.res; if (!mo.swapped) swapForm(mo.to); mo = null; r(); }
        if (f === form) { res(); return; }
        const toCursor = f === 'cursor', style = MORPHS.filter((x) => x !== lastMorph)[Math.floor(Math.random() * (MORPHS.length - 1))];
        lastMorph = style;
        const small = rand(0.32, 0.45);
        mo = {
          to: f, toCursor, style, t: 0, res, swapped: false, instant: !!lastEnv?.reduced || pres.state !== 'shown',
          d1: rand(0.26, 0.4), d2: rand(0.32, 0.46), small, turn: (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.1) * Math.PI,
          start: toCursor ? rand(0.35, 0.5) : small * rand(0.8, 1), over: rand(0.1, 0.22), hop: rand(10, 16),
        };
        if (mo.instant) return;
        S(toCursor ? 'poof' : 'blip');
        if (toCursor) sparks(true, Math.round(rand(14, 24)), R * rand(1.6, 2.4));
      });

      // Following the cursor: how far the body is from its grid cell (dx, dy in CSS px) and that cell, or null.
      // The cell comes from where it is, not its little gestures (ox, oy: a talking bounce): those moved the
      // cell, and with it the speech bubble and its text, up and down with every bounce.
      const glideSnap = () => {
        if (!m.drive || (pres.state !== 'shown' && pres.state !== 'in') || P <= 0) return null;
        const bx = m.x, by = m.y, cx = Math.round(bx / P), cy = Math.round(by / P);
        return { dx: cx * P - bx, dy: cy * P - by, cx, cy };
      };
      // Moves the body and everything that rides with it (tail, hands, ears, antenna, drips, the agent's bubbles).
      const shiftAll = (dx, dy) => {
        if (!dx && !dy) return;
        m.x += dx; m.y += dy;
        for (const q of tail) { q.x += dx; q.y += dy; }
        for (const q of hands) { q.x += dx; q.y += dy; }
        for (const q of ears) { q.x += dx; q.y += dy; }
        if (ant) for (const q of ant) { q.x += dx; q.y += dy; }
        for (const q of drips) { q.x += dx; q.y += dy; }
        plug?.shift?.(dx, dy);
      };

      // Plugins (the agent layer) get the kit's drawing helpers and can drive the pose.
      const kit = {
        o, m, face, sq, hands, PAL, L, th, put, disc, line, setPx, spawn, S, startAct,
        get P() { return P; }, get R() { return R; }, get gw() { return gw; }, get gh() { return gh; }, get t() { return t; },
        get busy() { return !!act; },
        appear, vanish,
        stopAct: () => { if (act) { act = null; nextAct = rand(3, 6); } },
        get morphing() { return !!mo; },
        blink: (mid) => blink(mid),
        get presence() { return pres.state; }, get presU() { return pres.u; }, get form() { return form; },
        get look() { return look; },
        // From the cursor form's arrow tip to the body point (the pen draws with the tip), and the size the user picked.
        get tip() { return [AX * P, AY * P]; },
        get userForm() { return userForm; },
        morph: (to) => morph(to),
      };
      // Nothing moving on the body itself (no act, particles, squash or strong expression): a still picture of it
      // is all of it, so something else can draw it (the native follower, buddy.swift).
      kit.calmBody = () => pres.state === 'shown' && !bl && !act && !pending && !parts.length && !drips.length && Math.abs(sq.x) < 0.04
        && face.happy < 0.3 && face.wide < 0.3 && face.dizzy < 0.3 && face.sleepy < 0.3 && !m.dragging && !m.flung;
      // The body as drawn right now, eyes open and shut: PNG (base64) at the screen's scale, its size in CSS px and
      // where the body point (m.x, m.y) is in it.
      kit.sprite = () => {
        if (!lastEnv || pres.state !== 'shown') return null;
        const env = lastEnv, dpr = env.dpr || 1, keep = face.open, out = [];
        let r = null;
        for (const open of [1, 0]) {
          face.open = open;
          r = self.prepare(env);
          if (!r) break;
          const cv = document.createElement('canvas');
          cv.width = Math.ceil((r.x1 - r.x0) * dpr); cv.height = Math.ceil((r.y1 - r.y0) * dpr);
          const c2 = cv.getContext('2d');
          c2.setTransform(dpr, 0, 0, dpr, -r.x0 * dpr, -r.y0 * dpr);
          self.draw(c2, env);
          out.push(cv.toDataURL('image/png').slice(22));
        }
        face.open = keep;
        if (!r || out.length < 2) return null;
        return { open: out[0], shut: out[1], w: r.x1 - r.x0, h: r.y1 - r.y0, ax: m.x - r.x0, ay: m.y - r.y0 };
      };
      const swapForm = (f) => { form = f; if (lastEnv) self.resize(lastEnv); };
      const plug = o.plugin ? o.plugin(kit) : null;
      let pose = null;

      const self = {
        mover: m, face, agent: plug?.api, appear, vanish,
        get hidden() { return pres.state === 'hidden' || pres.state === 'out'; },
        // Fully gone (not even leaving): nothing of it is drawn.
        get gone() { return pres.state === 'hidden'; },
        hit: (x, y) => !!plug?.hit?.(x, y),
        press: (x, y) => plug?.press?.(x, y),
        wheel: (dy) => plug?.wheel?.(dy),
        get form() { return form; },
        // The user's size. While a drawing holds it as its cursor, it changes back to this one when it's let go.
        setForm(f) { userForm = ['small', 'cursor'].includes(f) ? f : 'default'; if (!plug?.ghost?.()) swapForm(userForm); },
        ghost: () => !!plug?.ghost?.(),
        morph,
        get look() { return look; },
        setLook() {},
        resize(env) {
          lastEnv = env;
          const S = Clanky.unit(env);
          const base = (S / 110) * (o.pixel ?? 1);
          P = K > 1 ? K * Math.max(1, Math.round(base / K)) : Math.max(o.pixel < 1 ? 2 : 3, Math.round(base));
          gw = Math.ceil(env.w / P); gh = Math.ceil(env.h / P);
          IW = gw * K; IH = gh * K;
          off.width = IW; off.height = IH; img = octx.createImageData(IW, IH); u32 = new Uint32Array(img.data.buffer); pd = null;
          if (bloom) { bloom.width = Math.ceil(gw / 4); bloom.height = Math.ceil(gh / 4); }
          R = form === 'cursor' ? 26 : form === 'small' ? 15 : 30; m.radius = R * (o.ears || o.antenna ? 1.35 : 1.25);
        },
        boop() { sq.kick(11); S('boop'); if (ant) ant.forEach((p, i) => { p.vx += rand(-1, 1) * 260 * i; }); if (!forced) startAct('hype', true); },
        grab() { S('grab'); },
        tap() { S('pip'); },
        bonk() { sq.kick(16); S('bonk'); if (!forced) pending = 'upset'; for (let i = 0; i < 6; i++) drips.push({ x: m.x, y: m.y, vx: rand(-260, 260), vy: rand(-300, 60), r: R * rand(0.12, 0.22), rMax: 0, hold: 0, life: 1 }); },
        update(dt, env) {
          t += dt;
          EW = env.w; EH = env.h;
          if (pres.state === 'hidden') { blinkCut(); plug?.update?.(dt, env); return; }
          const performing = pres.state === 'in' || pres.state === 'out';
          // Popping up beside the cursor: the agent layer keeps it moving with the cursor during the entrance.
          if (performing && pres.state === 'in' && pres.v !== 'drop' && m.drive) { m.drive(dt, env); pres.tx = m.x; pres.ty = m.y; }
          if (performing) presStep(dt); else m.update(dt, env);
          morphStep(dt);
          blinkStep(dt);
          sq.update(dt);
          let px = m.x, py = m.y;
          tail.forEach((s, i) => { spring(s, px, py, 70 - i * 14, 8, dt); px = s.x; py = s.y; });
          if (forced && !act) startAct(forced);
          if (pending && !m.flung && !m.dragging && pres.state === 'shown') { const n = pending; pending = null; startAct(n); }
          if (act && m.dragging) act = null;
          if (act) {
            act.a += dt;
            m.mode = 'rest'; m.rest = Math.max(m.rest, 0.3);
            if (act.a >= act.dur) { act = null; m.rest = rand(0.4, 1.2); nextAct = rand(2.5, 5); }
          } else if (!performing && !m.native && !plug?.busy?.() && env.sleepy < 0.5 && !m.dragging && !m.flung && (nextAct -= dt) <= 0) {
            startAct(ACTS[actIdx++ % ACTS.length]);
          }
          const A = act?.name, a = act?.a ?? 0;
          // A speech bubble is up: keep the gesture, skip the confetti, steam and flames, hop lower.
          const calm = !!plug?.calm?.();
          let tl = [-0.55, 0.2], tr = [0.55, 0.2];
          ox = 0; oy = 0;
          if (A === 'wave') {
            tr = [1.05 + 0.16 * Math.sin(a * 13), -0.62 + 0.05 * Math.cos(a * 13)]; tl = [-1.0, 0.32];
            face.set('happy', 0.15);
          } else if (A === 'hype') {
            const p = Math.sin(a * 10);
            tr = [0.92, -0.95 - 0.3 * Math.max(0, p)]; tl = [-0.92, -0.95 - 0.3 * Math.max(0, -p)];
            const hop = Math.abs(Math.sin(a * 6.5));
            oy = -hop * R * (calm ? 0.1 : 0.26);
            if (hop < 0.12 && prevHop >= 0.12) { sq.kick(6); S('hop'); }
            prevHop = hop;
            face.set('happy', 0.15);
            if (!calm && Math.random() < dt * 30) spawn(m.x + rand(-R, R), m.y - R * 1.1 + oy, rand(-130, 130), rand(-280, -120), 540, [L, L - 1, 1][(Math.random() * 3) | 0], 0, 0.8);
          } else if (A === 'remind') {
            let dx = 1, dy = 0.3;
            if (env.mouse.active) { dx = env.mouse.x - m.x; dy = env.mouse.y - m.y; }
            const dd = Math.hypot(dx, dy) || 1, jab = 1.18 + 0.2 * Math.max(0, Math.sin(a * 11));
            const point = [(dx / dd) * jab, (dy / dd) * jab * 0.8], hip = [-Math.sign(dx || 1) * 0.98, 0.36];
            if (dx >= 0) { tr = point; tl = hip; } else { tl = point; tr = hip; }
            if (Math.sin(a * 11) > 0.97) sq.kick(1.5);
          } else if (A === 'upset') {
            tl = [0.36, 0.56]; tr = [-0.36, 0.62];
            const burst = a % 0.9 < 0.32;
            ox = burst ? Math.sin(a * 48) * R * 0.05 : 0;
            if (burst && !act.stomped) { sq.kick(8); act.stomped = true; S('stomp'); }
            if (!burst) act.stomped = false;
            if (!calm && Math.random() < dt * 16) { const s = Math.random() < 0.5 ? -1 : 1; spawn(m.x + s * R * 0.55, m.y - R * 0.8, s * rand(10, 45), rand(-120, -60), -25, Math.max(1, L - 1), 1, 1.1); }
          } else if (A === 'motivate') {
            const p = Math.max(0, Math.sin(a * 8));
            tr = [0.95, -0.82 - 0.32 * p]; tl = [-0.6, 0.32];
            oy = -p * R * 0.07;
            if (!calm && Math.random() < dt * 14) spawn(m.x + rand(-R * 1.15, R * 1.15), m.y + R * rand(0, 0.7), 0, rand(-170, -80), -30, L, 2, 0.9);
          }
          pose = m.dragging || performing ? null : plug?.pose?.(dt, env) ?? null;
          if (pose) {
            act = null;
            if (pose.tl) tl = pose.tl;
            if (pose.tr) tr = pose.tr;
            ox = pose.ox ?? 0; oy = pose.oy ?? 0;
          }
          arms = Clanky.damp(arms, act ? 1 : pose?.arms ?? 0, act || pose?.arms ? 10 : 6, dt);
          // The gesture offsets (ox, oy: a hop, a shake) move the body, and the hands with it.
          for (const h of hands) { const tg = h.s < 0 ? tl : tr; spring(h.o, tg[0] * R, tg[1] * R, 150, 13, dt); h.x = m.x + ox + h.o.x; h.y = m.y + oy + h.o.y; }
          for (let i = parts.length - 1; i >= 0; i--) {
            const q = parts[i]; q.vy += q.g * dt; q.vx *= 0.985; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * q.rate;
            if (q.life <= 0) parts.splice(i, 1);
          }
          for (const e of ears) spring(e, m.x + ox + e.s * R * 0.68, m.y + oy - R * 1.12 * (1 - sq.x * 0.03), 70, 7, dt);
          if (ant) {
            const seg = R * 0.16;
            ant[0].x = m.x + ox + R * 0.1; ant[0].y = m.y + oy - R * 0.86 * (1 - sq.x * 0.03); ant[0].vx = ant[0].vy = 0;
            for (let i = 1; i < ant.length; i++) spring(ant[i], ant[i - 1].x, ant[i - 1].y - seg, 120 - i * 14, 6, dt);
          }
          if (o.drip && (dripT -= dt) <= 0) {
            dripT = rand(0.5, 1.4);
            drips.push({ ox: rand(-0.4, 0.4) * R, x: m.x, y: m.y, vx: 0, vy: 0, r: 0, rMax: R * rand(0.13, 0.19), hold: 0.55, life: 1 });
          }
          for (let i = drips.length - 1; i >= 0; i--) {
            const q = drips[i];
            if (q.hold > 0) {
              q.hold -= dt;
              const k = 1 - q.hold / 0.55;
              q.r = q.rMax * Math.min(1, k * 1.6);
              q.x = m.x + q.ox; q.y = m.y + R * (0.62 + k * 0.42);
              if (q.hold <= 0) { q.vx = m.vx * 0.4; q.vy = m.vy * 0.4 + 40; }
              continue;
            }
            q.life -= dt * 0.6; q.vy += 500 * dt; q.vx *= 0.98; q.x += q.vx * dt; q.y += q.vy * dt;
            if (q.y > env.h - q.r) { q.y = env.h - q.r; q.vy *= -0.3; }
            if (q.life <= 0) drips.splice(i, 1);
          }
          if (pres.state === 'shown' && pres.u >= 1 && m.flung && !wasFlung) S('whoosh');
          wasFlung = m.flung;
          const asleep = env.sleepy > 0.5;
          if (!performing) {
            if (asleep !== wasAsleep) { S(asleep ? 'yawn' : 'wake'); snoreT = 3; wasAsleep = asleep; }
            else if (asleep && (snoreT -= dt) <= 0) { S('snore'); snoreT = 3.6; }
          }
          face.update(dt, env, m.x, m.y, m);
          plug?.update?.(dt, env);
        },
        // Paints the LED grid and returns the area it covers (CSS px), or null if nothing shows.
        // While it follows the cursor the picture is drawn with the body snapped to its grid cell, so the same dots
        // light up frame after frame, and draw() slides the finished layer the rest of the way. Drawing it at the
        // exact spot instead re-picks the dots every frame, which reads as shimmer.
        prepare(env) {
          const sn = glideSnap();
          if (!sn) { tox = toy = 0; return this.paint(env); }
          tox = sn.cx; toy = sn.cy;
          // Gestures move the body by whole cells here, so the same dots light up and it doesn't shimmer.
          const gx = ox, gy = oy;
          ox = Math.round(ox / P) * P; oy = Math.round(oy / P) * P;
          shiftAll(sn.dx, sn.dy);
          try { return this.paint(env); } finally { shiftAll(-sn.dx, -sn.dy); ox = gx; oy = gy; }
        },
        paint(env) {
          ready = false; rect = null;
          // Drawn natively while it follows (m.native): nothing here until the page takes it back.
          if (!img || pres.state === 'hidden' || m.native) return null;
          d = img.data; clear = !!env.transparent;
          dx0 = gw; dy0 = gh; dx1 = -1; dy1 = -1;
          const performing = pres.state === 'in' || pres.state === 'out';
          const bx = m.x + ox, by = m.y + oy;
          if (clear) {
            // Only last frame's cells hold anything, so only they need wiping.
            if (pd) for (let y = pd[1] * K; y < pd[3] * K; y++) u32.fill(0, y * IW + pd[0] * K, y * IW + pd[2] * K);
            else d.fill(0);
          } else for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) setPx(gx, gy, PAL[0]);
          // The ghost is drawn over the grid in draw(), where it is now (snapped while it follows) and in which state;
          // its box counts as written, so the patch that gets shown covers it.
          gpos = { x: bx, y: by };
          gstate = ghostState(env);
          const gb = ghostBox(bx, by);
          dx0 = Math.min(dx0, Math.max(0, Math.floor(gb[0] / P))); dy0 = Math.min(dy0, Math.max(0, Math.floor(gb[1] / P)));
          dx1 = Math.max(dx1, Math.min(gw - 1, Math.ceil(gb[2] / P))); dy1 = Math.max(dy1, Math.min(gh - 1, Math.ceil(gb[3] / P)));
          mask = null;
          plug?.gridUnder?.(env);
          for (const q of parts) {
            const gx = Math.round(q.x / P), gy = Math.round(q.y / P);
            if (q.size === 1) disc(gx, gy, q.life > 0.5 ? 1 : 0, q.life > 0.5 ? 1 : 0, q.lvl);
            else if (q.size === 2 && q.life > 0.45) { put(gx, gy, q.lvl); put(gx - 1, gy, q.lvl - 1); put(gx + 1, gy, q.lvl - 1); put(gx, gy - 1, q.lvl - 1); put(gx, gy + 1, q.lvl - 1); }
            else put(gx, gy, q.lvl);
          }
          plug?.gridOver?.(env);
          pd = dx1 >= dx0 ? [dx0, dy0, dx1 + 1, dy1 + 1] : null;
          // Tools, guides and cards also draw outside the grid, so they get the whole screen.
          if (!clear || plug?.wide?.()) rect = [0, 0, gw, gh];
          else if (pd) {
            // Four empty cells of margin for the glow, on a 4-cell lattice so the blur sits still as it moves;
            // the CRT effect stretches the picture (up to 1.3x) and glows around the body, so it gets more.
            const a = 4 + (crtXform() || mo ? Math.ceil((R * 1.6 + P * 8) / P) : 0);
            // The lattice starts at the body's cell while it follows, so the glow is worked out the same way each frame.
            rect = [Math.max(0, Math.floor((dx0 - a - tox) / a) * a + tox), Math.max(0, Math.floor((dy0 - a - toy) / a) * a + toy),
              Math.min(gw, Math.ceil((dx1 + 1 + a - tox) / a) * a + tox), Math.min(gh, Math.ceil((dy1 + 1 + a - toy) / a) * a + toy)];
          }
          // What the plugin draws off the grid (glass bubbles, tags, cards) widens the patch to cover it, glow and all.
          const ext = clear && rect ? plug?.extent?.() : null;
          if (ext) {
            const a = Math.ceil(20 / P);
            rect = [Math.max(0, Math.min(rect[0], Math.floor(ext[0] / P) - a)), Math.max(0, Math.min(rect[1], Math.floor(ext[1] / P) - a)),
              Math.min(gw, Math.max(rect[2], Math.ceil(ext[2] / P) + a)), Math.min(gh, Math.max(rect[3], Math.ceil(ext[3] / P) + a))];
          }
          ready = true;
          if (!rect) return null;
          // A fingerprint of the picture: the lit cells, where the patch sits and the glide offset. NaN (never equal)
          // whenever something is also drawn outside the grid or the CRT effect is playing.
          let sig = NaN;
          if (clear && pd && !performing && !crtXform() && !mo && GH()?.ready() && (!plug || plug.quiet?.())) {
            let h = 2166136261 ^ (rect[0] * 73856093) ^ (rect[1] * 19349663) ^ (rect[2] * 83492791) ^ rect[3] ^ ghostKey(env);
            for (let y = pd[1] * K; y < pd[3] * K; y++) for (let i = y * IW + pd[0] * K, e = y * IW + pd[2] * K; i < e; i++) h = Math.imul(h ^ u32[i], 16777619);
            const glide = !!m.drive && pres.state === 'shown';
            const gx = glide ? Math.round((bx - Math.round(bx / P) * P) * 20) : 0, gy = glide ? Math.round((by - Math.round(by / P) * P) * 20) : 0;
            sig = Math.imul(h ^ (gx * 31 + gy * 1009), 16777619);
          }
          // One cell extra each way: following slides the layer by up to half a cell.
          return { x0: rect[0] * P - P, y0: rect[1] * P - P, x1: rect[2] * P + P, y1: rect[3] * P + P, sig };
        },
        draw(ctx, env) {
          if (!ready) this.prepare(env);
          // Reset even when there was nothing to show, or callers that only call draw() never paint again.
          const had = ready; ready = false;
          if (!had || !rect) return;
          const bx = m.x + ox, by = m.y + oy;
          const [cx0, cy0, cx1, cy1] = rect;
          const sx = cx0 * K, sy = cy0 * K, sw = (cx1 - cx0) * K, sh = (cy1 - cy0) * K;
          const X = cx0 * P, Y = cy0 * P, DW = (cx1 - cx0) * P, DH = (cy1 - cy0) * P;
          octx.putImageData(img, 0, 0, sx, sy, sw, sh);
          ctx.imageSmoothingEnabled = false;
          // Following the cursor: the whole LED layer (and the text drawn over it) slides by the part of a cell
          // the body is past its grid cell, so it glides with the cursor instead of hopping a cell at a time.
          const glide = !!m.drive && (pres.state === 'shown' || pres.state === 'in');
          ctx.save();
          // Snapped to whole screen pixels: a part-pixel shift resamples the dots unevenly, so they'd shimmer.
          const dpr = env.dpr || 1;
          if (glide) ctx.translate(Math.round((bx - Math.round(bx / P) * P) * dpr) / dpr, Math.round((by - Math.round(by / P) * P) * dpr) / dpr);
          const crt = crtXform(), mx = morphXform();
          if (crt) {
            ctx.save();
            ctx.translate(bx, by); ctx.scale(Math.max(crt.sx, 0.0001), crt.sy); ctx.translate(-bx, -by);
          } else if (mx) {
            ctx.save();
            ctx.translate(bx, by - mx.lift); ctx.rotate(mx.rot); ctx.scale(Math.max(mx.sx, 0.0001), Math.max(mx.sy, 0.0001)); ctx.translate(-bx, -by);
          }
          if (!crt || crt.sx > 0.01) { ctx.drawImage(off, sx, sy, sw, sh, X, Y, DW, DH); drawGhost(ctx, env); }
          if (crt && crt.flash > 0.01 && crt.sx > 0.01) {
            // over-exposed tube warming up / cooling down
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = crt.flash * 0.85;
            ctx.drawImage(off, sx, sy, sw, sh, X, Y, DW, DH); ctx.restore();
          }
          if (bloom && (!crt || crt.sx > 0.01)) {
            const bw = (cx1 - cx0) / 4, bh = (cy1 - cy0) / 4;
            bctx.clearRect(0, 0, Math.ceil(bw) + 1, Math.ceil(bh) + 1);
            bctx.imageSmoothingEnabled = true;
            bctx.drawImage(off, sx, sy, sw, sh, 0, 0, bw, bh);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = o.glow;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(bloom, 0, 0, bw, bh, X, Y, DW, DH);
            ctx.restore();
          }
          if (mx) ctx.restore();
          if (crt) {
            ctx.restore();
            const hot = `rgb(${PAL[L].join(',')})`, glow = `rgb(${PAL[L - 1].join(',')})`;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            if (crt.line > 0.01 && crt.sx > 0.01) {
              const w = R * 2.1 * crt.sx, h = Math.max(2, P * 0.9);
              ctx.shadowColor = glow; ctx.shadowBlur = P * 4; ctx.globalAlpha = crt.line; ctx.fillStyle = hot;
              ctx.fillRect(bx - w / 2, by - h / 2, w, h);
            }
            if (crt.dot > 0.01) {
              const r = P * (0.6 + 1.6 * crt.dot);
              ctx.shadowColor = glow; ctx.shadowBlur = P * 6 * crt.dot; ctx.globalAlpha = Math.min(1, crt.dot * 1.4); ctx.fillStyle = hot;
              ctx.fillRect(bx - r, by - r, r * 2, r * 2);
            }
            ctx.restore();
          }
          // Text and anything else drawn over the grid sits where the grid had it (snapped), then slides with it.
          const sn = glideSnap();
          if (sn) shiftAll(sn.dx, sn.dy);
          try { plug?.over?.(ctx, env); } finally { if (sn) shiftAll(-sn.dx, -sn.dy); }
          ctx.restore();
          if (o.grid && !clear) {
            ctx.fillStyle = o.grid;
            for (let x = 0; x < env.w; x += P) ctx.fillRect(x, 0, 1, env.h);
            for (let y = 0; y < env.h; y += P) ctx.fillRect(0, y, env.w, 1);
          }
        },
      };
      return self;
    },
  });

})();

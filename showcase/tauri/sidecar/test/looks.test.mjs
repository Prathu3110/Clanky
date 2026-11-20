import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VOICE } from '../fish.mjs';
import { GEMINI_VOICES } from '../gemini.mjs';

// One character, the Clanky ghost; the personality picks its tone, ghost colour and voice.
const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const side = src('../sidekick.mjs');
const block = side.slice(side.indexOf('const PERSONALITIES = ['), side.indexOf('];', side.indexOf('const PERSONALITIES = [')) + 2);
const PERSONALITIES = new Function('DEFAULT_VOICE', `${block}; return PERSONALITIES;`)(DEFAULT_VOICE);
assert.deepEqual(PERSONALITIES.map((p) => p[0]), ['classic', 'butler', 'sage', 'sassy']);
assert.deepEqual(PERSONALITIES.map((p) => p[1]), ['Classic', 'Butler', 'Teacher', 'Sassy']);
for (const [id, , tone, fish, gemini, hi] of PERSONALITIES) {
  assert.ok(tone && tone.length > 10, `${id} has a tone`);
  assert.match(fish, /^[0-9a-f]{32}$/, `${id} has a Fish Audio voice`);
  assert.ok(GEMINI_VOICES.some((x) => x.id === gemini), `${id}'s ${gemini} is a Gemini voice`);
  assert.ok(hi, `${id} has a greeting`);
}
assert.equal(PERSONALITIES[0][3], DEFAULT_VOICE, 'Classic speaks in the default voice');
assert.equal(new Set(PERSONALITIES.map((p) => p[3])).size, 4, 'each personality has its own Fish Audio voice');
assert.equal(new Set(PERSONALITIES.map((p) => p[4])).size, 4, 'and its own Gemini voice');
assert.equal(new Set(PERSONALITIES.map((p) => p[6])).size, 4, 'and its own Kokoro voice');
for (const p of PERSONALITIES) assert.match(p[6], /^[ab][fm]_[a-z]+$/, `${p[0]} has a Kokoro voice`);
assert.ok(!/config\.fishVoice/.test(side), 'a saved fishVoice (the old JARVIS default) is never used');
// Both prompts take the personality's tone; it greets you in its voice only when it changes, voice on, not over a reply.
assert.match(side, /Personality: \$\{styleNow\(\)\}/);
assert.match(side, /style: styleNow\(\),/);
const set = side.slice(side.indexOf('function setPersonality('), side.indexOf('\n}\n', side.indexOf('function setPersonality(')));
assert.match(set, /if \(changed && VOICE_ON\(\) && !busy\)/);
assert.match(set, /v\.say\(persona\(\)\[5\]\)/);
assert.match(set, /ui\(\{ kind: 'personality', personality: p \}\)/, 'the overlay recolours the ghost');
// Every personality has a ghost colour on the overlay.
const ghost = src('../../../clanky/ghost.js');
const colours = new Function(`return ${ghost.match(/const PERSONA_GHOST = (\{[^}]*\})/)[1]}`)();
assert.deepEqual(Object.keys(colours), PERSONALITIES.map((p) => p[0]));
console.log('personality tests: passed');

// The sprite sheets match the manifest: 16 states, a time per frame, 4 ghosts with light and dark sheets of 128x512.
{
  const dir = '../../../clanky/ghost/', man = JSON.parse(src(`${dir}clanky-sprites.json`));
  assert.equal(man.states.length, 16);
  man.states.forEach((s, i) => { assert.equal(s.row, i); assert.equal(s.ms.length, s.frames, `${s.id} has a time per frame`); assert.ok(s.frames <= man.columns); });
  const size = (f) => { const b = readFileSync(fileURLToPath(new URL(`${dir}${f}`, import.meta.url))); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const g of Object.values(colours)) for (const v of ['light', 'dark']) assert.deepEqual(size(`clanky-${g}-${v}.png`), [128, 512], `${g} ${v}`);
  for (const v of ['light', 'dark']) assert.deepEqual(size(`clanky-cursor-${v}.png`), [20, 40]);
  // ghost.js picks each frame by its own time, and frame 0 under reduced motion.
  globalThis.window = { Clanky: {} };
  globalThis.document = { currentScript: { src: 'file:///x/clanky/ghost.js' }, createElement: () => ({ getContext: () => ({}) }) };
  globalThis.location = { href: 'file:///x/' };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.Image = class { };
  globalThis.fetch = () => Promise.resolve({ json: () => man });
  new Function(ghost)();
  await new Promise((r) => setTimeout(r, 10));
  const G = window.Clanky.ghost;
  assert.ok(G.ready());
  assert.equal(G.frame('idle', 0.1), 0);
  assert.equal(G.frame('idle', 0.6), 1);
  assert.equal(G.frame('idle', 1.55), 3, 'the blink frame is short (140 ms after 3 x 500)');
  assert.equal(G.frame('idle', 1.65), 0, 'and it loops');
  assert.equal(G.frame('idle', 0.6, true), 0, 'reduced motion holds frame 0');
  G.setPersonality('butler'); assert.equal(G.color, 'cobalt');
  G.setPersonality('nobody'); assert.equal(G.color, 'ivory');
  console.log('ghost sprite tests: passed');
}

// Regression: a selected stage canvas showed as a grey box around the Clanky (WebKit tints selected canvases).
assert.match(src('../../../desktop.html'), /canvas \{[^}]*-webkit-user-select: none; user-select: none;[^}]*\}/);

// Regression: after a drawing the Sidekick stopped following the cursor and hopped away from it instead.
{
  const agent = src('../../../clanky/agent.js'), rel = agent.slice(agent.indexOf('async release()'), agent.indexOf('place: (x, y) =>'));
  assert.match(agent, /pen\.follow = !!station\.byCursor/, 'take() remembers whether it was following the cursor');
  assert.match(rel, /if \(pen\.follow && presence\.ptr\) station\.byCursor = presence\.ptr\.slice\(\)/, 'release() goes back to following');
}

// The bubbles, tags and step list draw with glass.js, and the ghost with ghost.js, so the overlay loads them first.
{
  const page = src('../../../desktop.html'), at = (f) => page.indexOf(`clanky/${f}`);
  assert.ok(at('glass.js') > 0 && at('glass.js') < at('agent.js') && at('glass.js') < at('agent-cards.js'), 'desktop.html loads glass.js before agent.js and agent-cards.js');
  assert.ok(at('ghost.js') > 0 && at('ghost.js') < at('12-sidekick.js'), 'desktop.html loads ghost.js before the sidekick');
}

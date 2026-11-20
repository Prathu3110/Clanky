// Spoken replies with Kokoro, a free voice model that runs on this computer (kokoro-worker.mjs, in its own thread).
// No key, no allowance: a ~100 MB model downloaded once into ~/Clanky/Data/kokoro. Same shape as the other local
// voice before it (speaker.mjs): kokoroStatus() for the panel, KokoroVoice for one reply, sentence by sentence.
// It never falls back to a paid service: a failure is reported (onError, with a reason) and the reply stays text.
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

export const KOKORO_RATE = 24000;
export const KOKORO_DEFAULT_VOICE = 'af_heart';
// The 28 voices it ships, by accent and voice: a = American, b = British; f = female, m = male.
const IDS = ['af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
  'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa',
  'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'];
const KIND = { af: 'American woman', am: 'American man', bf: 'British woman', bm: 'British man' };
export const KOKORO_VOICES = IDS.map((id) => ({ id, name: `${id[3].toUpperCase()}${id.slice(4)} · ${KIND[id.slice(0, 2)]}` }));

export const KOKORO_MESSAGES = {
  starting: 'Kokoro is getting ready (the first time it downloads its 100 MB voice model). Give it a moment, then press Check again.',
  voice: "That Kokoro voice isn't there. Pick another one on the Speaking page.",
  error: 'Kokoro ran into a problem',
};

// One worker for the whole app, started on first use.
let worker = null, seq = 0;
const waiting = new Map();
function ask(msg, transfer) {
  if (!worker) {
    worker = new Worker(new URL('./kokoro-worker.mjs', import.meta.url), { workerData: { cacheDir: path.join(os.homedir(), 'Clanky', 'Data', 'kokoro') } });
    worker.unref();
    worker.on('message', (m) => { const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } });
    worker.on('error', (e) => { for (const w of waiting.values()) w({ ok: false, error: String(e?.message ?? e) }); waiting.clear(); worker = null; });
  }
  const id = ++seq;
  return new Promise((res) => { waiting.set(id, res); worker.postMessage({ id, ...msg }, transfer); });
}

let loaded = null; // the load in flight or done: { ok, voices } / { ok: false, error }
/** Is Kokoro ready? Loads (and the first time downloads) the model; answers 'starting' if that takes over `wait` ms. Never throws. */
export async function kokoroStatus({ wait = 3000 } = {}) {
  loaded ??= ask({ type: 'load' }).then((r) => { if (!r.ok) loaded = null; return r; });
  const r = await Promise.race([loaded, new Promise((res) => setTimeout(() => res(null), wait).unref())]);
  const base = { engine: 'kokoro', engineName: 'Kokoro 82M' };
  if (!r) return { ...base, ok: false, reason: 'starting', message: KOKORO_MESSAGES.starting };
  if (!r.ok) return { ...base, ok: false, reason: 'error', message: `${KOKORO_MESSAGES.error}: ${r.error}.` };
  return { ...base, ok: true, reason: null, message: null, voices: KOKORO_VOICES };
}

// Voice cues ([warm], [laughing]) are Fish Audio's; Kokoro would read them out.
export const plain = (text) => String(text ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * One reply's voice: say() as many times as needed, then end(); abort() stops at once (a sentence being made is
 * dropped). onAudio(Uint8Array, rate) gets 16-bit samples; onEnd() after the last; onError(err) instead, with
 * err.reason ('voice' | 'error') and err.heard.
 */
export class KokoroVoice {
  constructor({ voice = null, onAudio, onEnd, onError, askImpl = ask } = {}) {
    Object.assign(this, { voice: IDS.includes(voice) ? voice : KOKORO_DEFAULT_VOICE, onAudio, onEnd, onError, askImpl });
    this.queue = []; this.busy = false; this.ending = false; this.done = false; this.heard = false;
  }
  open() { return this; }
  say(text) { const t = plain(text); if (this.done || this.ending || !t) return; this.queue.push(t); this.pump(); }
  end() { if (this.done || this.ending) return; this.ending = true; this.pump(); }
  abort() { this.done = true; this.queue.length = 0; }
  async pump() {
    if (this.busy || this.done) return;
    const text = this.queue.shift();
    if (text == null) { if (this.ending) { this.done = true; this.onEnd?.(); } return; }
    this.busy = true;
    const r = await this.askImpl({ type: 'say', text, voice: this.voice });
    this.busy = false;
    if (this.done) return;
    if (!r.ok) {
      this.done = true;
      const e = new Error(`${KOKORO_MESSAGES.error}: ${r.error}.`);
      e.reason = 'error'; e.heard = this.heard;
      return this.onError?.(e);
    }
    this.heard = true;
    this.onAudio?.(new Uint8Array(r.pcm.buffer, r.pcm.byteOffset, r.pcm.byteLength), r.rate);
    this.pump();
  }
}

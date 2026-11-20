// Kokoro (82M, q8) in its own thread, so making speech never stalls the sidekick. kokoro.mjs starts it and sends
// { id, type: 'load' } or { id, type: 'say', text, voice }; it answers { id, ok, voices } or { id, ok, rate, pcm }
// (16-bit mono PCM, its buffer transferred), or { id, ok: false, error }. The model downloads once into cacheDir.
import { parentPort, workerData } from 'node:worker_threads';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts = null, loading = null;

async function load() {
  if (tts) return tts;
  loading ??= (async () => {
    const { env } = await import('@huggingface/transformers');
    env.cacheDir = workerData.cacheDir;
    const { KokoroTTS } = await import('kokoro-js');
    tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
    return tts;
  })();
  try { return await loading; } catch (e) { loading = null; throw e; }
}

parentPort.on('message', async (m) => {
  try {
    if (m.type === 'load') {
      await load();
      parentPort.postMessage({ id: m.id, ok: true, voices: Object.keys(tts.voices) });
    } else if (m.type === 'say') {
      const a = await (await load()).generate(m.text, { voice: m.voice });
      const f = a.audio, pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
      parentPort.postMessage({ id: m.id, ok: true, rate: a.sampling_rate, pcm }, [pcm.buffer]);
    }
  } catch (e) {
    parentPort.postMessage({ id: m.id, ok: false, error: String(e?.message ?? e).slice(0, 300) });
  }
});

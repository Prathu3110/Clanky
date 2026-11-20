// Kokoro, the local voice (kokoro.mjs): its voice list, and one reply's voice making sentence after sentence in order,
// ending once, stopping on abort and reporting a failure. The model itself isn't loaded here (a stub stands in).
import assert from 'node:assert/strict';
import { KOKORO_VOICES, KOKORO_DEFAULT_VOICE, KokoroVoice, plain } from '../kokoro.mjs';

assert.equal(KOKORO_VOICES.length, 28);
assert.ok(KOKORO_VOICES.some((v) => v.id === KOKORO_DEFAULT_VOICE));
assert.equal(KOKORO_VOICES.find((v) => v.id === 'bm_george').name, 'George · British man');
assert.equal(plain('[warm] Hello  there [laughing]'), 'Hello there', 'voice cues are not read out');

const tick = () => new Promise((r) => setTimeout(r, 0));
const stub = (fail) => async (m) => (fail ? { ok: false, error: 'boom' } : { ok: true, rate: 24000, pcm: new Int16Array([m.text.length, 1]) });
{
  const got = [];
  let ended = 0;
  const v = new KokoroVoice({ voice: 'bm_george', askImpl: stub(), onAudio: (b, rate) => got.push([b.byteLength, rate]), onEnd: () => ended++ });
  v.say('One.'); v.say('[warm] Two two.'); v.end(); v.end();
  for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual(got, [[4, 24000], [4, 24000]], 'each sentence in order, 16-bit samples');
  assert.equal(ended, 1, 'ends once');
  assert.equal(new KokoroVoice({ voice: 'nobody' }).voice, KOKORO_DEFAULT_VOICE, 'an unknown voice falls back to the default');
}
{
  const got = [];
  const v = new KokoroVoice({ askImpl: stub(), onAudio: () => got.push(1), onEnd: () => got.push('end') });
  v.say('One.'); v.abort(); v.say('Two.'); v.end();
  for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual(got, [], 'abort drops what was being made and everything after');
}
{
  let err = null;
  const v = new KokoroVoice({ askImpl: stub(true), onError: (e) => (err = e) });
  v.say('One.'); v.end();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(err.reason, 'error'); assert.equal(err.heard, false); assert.match(err.message, /boom/);
}
console.log('kokoro tests: passed');

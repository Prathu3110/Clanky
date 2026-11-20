// Clanky Laya client (laya.mjs): answers in order, a slow or dead Laya is "no decision", the trace is one JSON line.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createLaya, lastTurnTools, pickKinds, trace } from '../laya.mjs';

// A fake Laya: answers each line with `answer(request)`, after `delay` ms (or never when it returns undefined).
function fake(answer, delay = 0) {
  const proc = new EventEmitter();
  proc.stdin = new PassThrough(); proc.stdout = new PassThrough(); proc.kill = () => proc.emit('exit');
  proc.seen = [];
  let rest = '';
  proc.stdin.on('data', (d) => {
    rest += d;
    for (let i; (i = rest.indexOf('\n')) >= 0;) {
      const req = JSON.parse(rest.slice(0, i)); rest = rest.slice(i + 1); proc.seen.push(req);
      const out = answer(req);
      if (out !== undefined) setTimeout(() => proc.stdout.write(`${JSON.stringify(out)}\n`), delay);
    }
  });
  return proc;
}

// Sends the protocol request and returns the decision with its time.
{
  const p = fake((r) => ({ kinds: r.text.includes('click') ? ['computer'] : [], confidence: 0.9 }));
  const laya = createLaya({ bin: 'x', spawnImpl: () => p });
  const d = await laya.ask({ text: 'click it', app: 'com.apple.Safari', recentTools: ['draw'] });
  assert.deepEqual(p.seen[0], { text: 'click it', app: 'com.apple.Safari', recent_tools: ['draw'] });
  assert.deepEqual(d.kinds, ['computer']); assert.equal(d.confidence, 0.9); assert.ok(d.ms >= 0);
  assert.deepEqual((await laya.ask({ text: 'hi' })).kinds, [], 'second request on the same process');
  laya.stop();
}

// Too slow: null, and the late answer doesn't leak into the next request.
{
  let n = 0;
  const p = fake(() => ({ kinds: [`k${++n}`], confidence: 1 }), 30);
  const laya = createLaya({ bin: 'x', spawnImpl: () => p });
  assert.equal(await laya.ask({ text: 'a' }, 10), null, 'timed out');
  assert.deepEqual((await laya.ask({ text: 'b' }, 500)).kinds, ['k2'], 'the late k1 is dropped, b gets its own answer');
  laya.stop();
}

// No binary, a crash, junk output: all null, never a throw.
{
  assert.equal(await createLaya({ bin: null }).ask({ text: 'a' }), null, 'no binary');
  const dead = fake(() => undefined);
  const laya = createLaya({ bin: 'x', spawnImpl: () => dead, timeoutMs: 500 });
  const pending = laya.ask({ text: 'a' });
  dead.emit('exit');
  assert.equal(await pending, null, 'crash resolves waiting requests');
  const junk = createLaya({ bin: 'x', spawnImpl: () => fake(() => 'not a decision'), timeoutMs: 200 });
  assert.equal(await junk.ask({ text: 'a' }), null, 'junk line');
  junk.stop();
}

// Routing: Laya's kinds only when it's sure; unsure, missing or the stub's 0 confidence leaves the regex router in charge.
{
  assert.deepEqual(pickKinds(['code'], { kinds: ['computer'], confidence: 0.9 }), ['computer', 'code'], 'Laya adds, in router order');
  assert.deepEqual(pickKinds(['code'], { kinds: ['computer'], confidence: 0.6 }), ['computer', 'code'], 'threshold is inclusive');
  assert.deepEqual(pickKinds(['draw'], { kinds: ['draw'], confidence: 0.9 }), ['draw'], 'no duplicates');
  assert.deepEqual(pickKinds(['code'], { kinds: ['computer'], confidence: 0.59 }), ['code']);
  assert.deepEqual(pickKinds(['code'], { kinds: [], confidence: 0 }), ['code'], 'the stub never routes');
  assert.deepEqual(pickKinds(['code'], null), ['code'], 'no Laya');
  assert.deepEqual(pickKinds(['code'], { kinds: [], confidence: 0.95 }), ['code'], 'Laya never removes a kind');
  assert.deepEqual(lastTurnTools({ at: 0, tools: ['draw'] }, 60_000), ['draw']);
  assert.deepEqual(lastTurnTools({ at: 0, tools: ['draw'] }, 11 * 60_000), [], 'too long ago');
  assert.deepEqual(lastTurnTools(null), []);
}

// The trace: one private JSON line per entry.
{
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'laya-')), 'trace.jsonl');
  await trace({ a: 1 }, file); await trace({ b: 2 }, file);
  assert.deepEqual(readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)), [{ a: 1 }, { b: 2 }]);
}

console.log('laya client tests: passed');

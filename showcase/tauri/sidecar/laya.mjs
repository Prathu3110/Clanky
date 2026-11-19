// Clanky: Laya, the gate in front of the regex router (laya/ at the repo root). Shadow mode for now: Laya decides on
// every request next to jobKinds(), only the regex answer is used, and both go to laya-trace.jsonl with the tools the
// turn really used. Those tools are the ground truth (route.mjs kindOfTool), so the trace grades Laya for free.
// Everything fails soft: no binary, a crash or a slow answer is just "no decision".
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DIR } from './store.mjs';

const TIMEOUT_MS = 50; // Laya must be faster than this to be worth asking
export const TRACE = path.join(DIR, 'laya-trace.jsonl');
const binPath = () => [process.env.CLANKY_LAYA_BIN, path.join(os.homedir(), 'Roamies', 'bin', 'laya')].find((p) => p && existsSync(p)) ?? null;

/** A long-lived Laya process. ask() resolves to { kinds, confidence, ms } or null. `spawnImpl`/`bin` are for tests. */
export function createLaya({ bin = binPath(), spawnImpl = spawn, timeoutMs = TIMEOUT_MS } = {}) {
  let proc = null, buf = '';
  const waiting = []; // FIFO: Laya answers in order, so a timed-out request still owns the next line
  const start = () => {
    if (proc || !bin) return proc;
    proc = spawnImpl(bin, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d) => {
      buf += d;
      for (let i; (i = buf.indexOf('\n')) >= 0;) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const w = waiting.shift();
        if (!w || w.done) continue;
        w.done = true; clearTimeout(w.timer);
        try { const d = JSON.parse(line); w.resolve(Array.isArray(d.kinds) ? { kinds: d.kinds, confidence: Number(d.confidence) || 0, ms: Date.now() - w.t } : null); } catch { w.resolve(null); }
      }
    });
    const gone = () => { proc = null; buf = ''; for (const w of waiting.splice(0)) if (!w.done) { w.done = true; clearTimeout(w.timer); w.resolve(null); } };
    proc.on('exit', gone); proc.on('error', gone);
    proc.stdin.on('error', () => {});
    return proc;
  };
  return {
    ask(req, ms = timeoutMs) {
      if (!start()) return Promise.resolve(null);
      return new Promise((resolve) => {
        const w = { resolve, done: false, t: Date.now() };
        w.timer = setTimeout(() => { if (!w.done) { w.done = true; resolve(null); } }, ms);
        waiting.push(w);
        proc.stdin.write(`${JSON.stringify({ text: String(req.text ?? ''), app: req.app ?? null, recent_tools: req.recentTools ?? [] })}\n`);
      });
    },
    stop() { proc?.kill(); proc = null; },
  };
}

export const LAYA_ON = 0.6; // Laya's kinds route the request only at or above this confidence
/** The kinds that route this request: Laya's when it's sure, the regex router's otherwise. */
export const pickKinds = (regexKinds, decision, threshold = LAYA_ON) => (decision && decision.confidence >= threshold ? decision.kinds : regexKinds);

/** One line per request: what each router said, and what the turn really did. Kept local, private (0600). */
export async function trace(entry, file = TRACE) {
  try { await fs.appendFile(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 }); } catch {}
}

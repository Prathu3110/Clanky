// Grades both routers on the shadow-mode trace: how often each one's kinds match what the turn really did
// (`truth`, from the tools it used), and how fast Laya answered. Run: node laya/eval.mjs [trace file]
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = process.argv[2] ?? path.join(os.homedir(), 'Clanky', 'Data', 'laya-trace.jsonl');
const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const same = (a = [], b = []) => a.length === b.length && a.every((k) => b.includes(k));
// The kinds that pick a model are what matter: a request is "right" when its first kind matches the truth's first.
const firstOk = (a = [], b = []) => (a[0] ?? null) === (b[0] ?? null);

export function grade(rows, threshold = 0.6) {
  const n = rows.length, answered = rows.filter((r) => r.laya);
  const used = (r) => (r.laya && r.laya.confidence >= threshold ? [...new Set([...r.regex, ...r.laya.kinds])] : r.regex); // as pickKinds routes
  const pct = (k) => (n ? `${Math.round((100 * k) / n)}%` : '-');
  const ms = answered.map((r) => r.laya.ms).sort((a, b) => a - b);
  return {
    requests: n,
    exact: { regex: pct(rows.filter((r) => same(r.regex, r.truth)).length), laya: pct(rows.filter((r) => same(used(r), r.truth)).length) },
    first: { regex: pct(rows.filter((r) => firstOk(r.regex, r.truth)).length), laya: pct(rows.filter((r) => firstOk(used(r), r.truth)).length) },
    layaConfident: pct(answered.filter((r) => r.laya.confidence >= threshold).length),
    layaMs: ms.length ? { p50: ms[Math.floor(ms.length / 2)], p95: ms[Math.floor(ms.length * 0.95)] } : null,
  };
}

console.log(JSON.stringify(grade(rows), null, 2));
const wrong = rows.filter((r) => !firstOk(r.regex, r.truth)).slice(-10);
if (wrong.length) console.log(`\nLatest regex misses (Laya's chance to win):\n${wrong.map((r) => `  ${JSON.stringify(r.text).slice(0, 70)}  regex=${JSON.stringify(r.regex)} truth=${JSON.stringify(r.truth)}`).join('\n')}`);

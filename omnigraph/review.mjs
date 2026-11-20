// Review the lessons Clanky proposed (from your "that was wrong" corrections) and merge them into `main`, where
// Clanky reads them before each request. Merging is an owner action, so this uses the `act-me` token.
// Run from the repo root: node omnigraph/review.mjs
// ponytail: all or nothing (one branch merge). To drop a single lesson, delete it on `proposed` first.
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { callTool } from '../showcase/tauri/sidecar/graph.mjs';

const tokens = JSON.parse(readFileSync(path.join(os.homedir(), 'Clanky', 'Data', 'omnigraph.tokens.json'), 'utf8'));
const opts = { tok: tokens['act-me'], timeoutMs: 10_000 };
const LIST = 'query all() { match { $l: Lesson } return { $l.slug, $l.text } }';
const lessons = async (branch) => (await callTool('query', { branch, query: LIST }, opts)).rows ?? [];

const onMain = new Set((await lessons('main')).map((r) => r['l.slug']));
const fresh = (await lessons('proposed')).filter((r) => !onMain.has(r['l.slug']));
if (!fresh.length) { console.log('Nothing new to review.'); process.exit(0); }
console.log(`${fresh.length} proposed lesson(s):\n${fresh.map((r) => `  - ${r['l.text']}`).join('\n')}\n`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const yes = /^y/i.test(await rl.question('Merge all of them into main? [y/N] '));
rl.close();
if (!yes) { console.log('Left on proposed.'); process.exit(0); }
await callTool('branches_merge', { source: 'proposed', target: 'main' }, opts);
console.log('Merged. Clanky uses them from its next request.');

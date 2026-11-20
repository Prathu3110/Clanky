// Regenerates tests/cases.jsonl: each request with what route.mjs jobKinds() says today.
// Run from the repo root: node laya/tests/gen-cases.mjs
import { writeFileSync } from 'node:fs';
import { jobKinds } from '../../showcase/tauri/sidecar/route.mjs';

const texts = [
  'Click the blue button in the toolbar', 'can you open the Slack app and read my messages', "what's on my screen right now?",
  'type my address into the form', 'scroll down a bit', 'take a screenshot', 'switch to the Safari browser',
  'fix the bug in my login function', 'write a python script that renames these', 'run the tests please', 'git push my changes',
  'tidy up the files in my downloads folder', 'why does cargo say the lockfile is out of date', 'add a dark mode feature to my website',
  'draw a diagram of how DNS works', 'make a mind map of my week', 'visualize my spending',
  'what is the latest news about the election', 'search the web for dentist chairs', 'compare prices for the M3 MacBook Air online',
  'open the Figma app and draw a flowchart of the checkout', 'send an agent to research dentist chairs', 'send an agent to tidy my desktop',
  'what is an agent?', 'how are you today?', 'tell me a joke', "what's the capital of France", 'remind me to call mum at 5',
  'thanks!', 'ok', 'yes, then run the tests', '(Reminder: stand up)', '',
];
writeFileSync(new URL('./cases.jsonl', import.meta.url), texts.map((text) => JSON.stringify({ text, kinds: jobKinds(text) })).join('\n') + '\n');
console.log(`${texts.length} cases written`);

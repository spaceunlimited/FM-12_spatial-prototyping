#!/usr/bin/env node
// Generates CAPABILITIES.md from the blocks' own doc comments and the examples that compile with
// them, so the reference can never drift from the code. `--check` fails when the committed file
// differs from what the code says, or when it grows past the line cap.
//
//   npm run capabilities          rewrite CAPABILITIES.md
//   node scripts/capabilities.mjs --check
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = resolve(ROOT, 'CAPABILITIES.md');
const MAX_LINES = 400;

// Order on the page. Each entry: the block name used in its `@block` tag, and the file to read it from.
const BLOCKS = [
  ['startExperience', 'src/runtime/core.ts'],
  ['stage', 'src/blocks/stage.ts'],
  ['interact', 'src/blocks/interact.ts'],
  ['draggable', 'src/blocks/drag.ts'],
  ['place', 'src/blocks/place.ts'],
  ['Panel', 'src/blocks/ui/Panel.ts'],
  ['Label', 'src/blocks/ui/Label.ts'],
  ['Button', 'src/blocks/ui/Button.ts'],
  ['Prompt', 'src/blocks/ui/Prompt.ts'],
  ['toast', 'src/blocks/ui/toast.ts'],
  ['voice', 'src/blocks/voice.ts'],
  ['assets', 'src/blocks/assets.ts'],
  ['ai', 'src/blocks/ai/index.ts'],
];

const HEADER = `# Capabilities

Every building block of this sandbox, with its options and one snippet to copy. Generated from the
code by \`npm run capabilities\`; do not edit by hand. Experience code lives in \`src/experience/\` and
imports everything from \`@blocks\`:

\`\`\`ts
import { startExperience, stage, recenter, onSelect, onPoint, onLongPress, onPoke, draggable, place,
  Panel, Label, Button, Prompt, toast, voice, model, image, video, ai, onFrame, theme, THREE } from '@blocks';
\`\`\`

Defaults that already apply: content starts 1.5 m ahead and 0.15 m below eye height; panels are
0.42 m wide at 1 m and keep their visual size at any distance; targets are at least 6 cm at 1 m;
the AI is fake until \`ai.mode = 'live'\`. The device profile (phone camera, phone AR, headset)
decides how a select, a point or a grab is realised; branch on \`profile.capabilities\`, never on
device names (details: \`docs/DEVICE-PROFILES.md\`).
`;

function parseDoc(file, name) {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const re = /\/\*\*\s*\n\s*\*\s*@block\s+(\w+)([\s\S]*?)\*\//g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] !== name) continue;
    const lines = m[2]
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trimEnd())
      .filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
    const description = [];
    const options = [];
    const methods = [];
    let returns = '';
    for (const l of lines) {
      if (l.startsWith('@option ')) options.push(l.slice(8));
      else if (l.startsWith('@method ')) methods.push(l.slice(8));
      else if (l.startsWith('@returns ')) returns = l.slice(9);
      else if (l.trim()) description.push(l.trim());
    }
    return { description: description.join(' '), options, methods, returns };
  }
  throw new Error(`no @block ${name} doc comment in ${file}`);
}

function example(name) {
  const p = resolve(ROOT, 'src/blocks/examples', `${name}.ts`);
  if (!existsSync(p)) throw new Error(`missing example src/blocks/examples/${name}.ts`);
  return readFileSync(p, 'utf8').trim();
}

function render() {
  const parts = [HEADER];
  for (const [name, file] of BLOCKS) {
    const d = parseDoc(file, name);
    parts.push(`\n## ${name}\n\n${d.description}\n`);
    if (d.options.length) {
      parts.push('\n| Option | Meaning |\n|---|---|');
      for (const o of d.options) {
        const [head, ...rest] = o.split(' — ');
        parts.push(`| \`${head.trim()}\` | ${rest.join(' — ').trim() || ' '} |`);
      }
      parts.push('');
    }
    if (d.methods.length) parts.push(d.methods.map((m) => `- \`${m}\``).join('\n') + '\n');
    if (d.returns) parts.push(`Returns \`${d.returns}\`.\n`);
    parts.push('```ts\n' + example(name) + '\n```\n');
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n');
}

const out = render();
const lines = out.split('\n').length;
if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== out) {
    console.error('✗ CAPABILITIES.md is out of date. Run: npm run capabilities');
    process.exit(1);
  }
  if (lines > MAX_LINES) {
    console.error(`✗ CAPABILITIES.md is ${lines} lines; the cap is ${MAX_LINES}. Shorten doc comments or examples.`);
    process.exit(1);
  }
  console.log(`✓ CAPABILITIES.md is current (${lines} lines)`);
} else {
  writeFileSync(OUT, out);
  console.log(`wrote CAPABILITIES.md (${lines} lines${lines > MAX_LINES ? `, OVER the ${MAX_LINES}-line cap` : ''})`);
}

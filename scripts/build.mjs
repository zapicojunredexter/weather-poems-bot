#!/usr/bin/env node
// Builds the static site for GitHub Pages into _site/.
// GitHub Pages can't run serve.mjs, so poems.json is copied next to index.html,
// where the page's relative fetch("poems.json") finds it.
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, DATA_FILE, PUBLIC_DIR } from './lib/config.mjs';
import { readPoems } from './lib/store.mjs';

const OUT = path.join(ROOT, '_site');

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(PUBLIC_DIR, OUT, { recursive: true });

// Re-serialize instead of copying raw bytes, so a corrupt data file can't break the page.
// Mock entries (local UI testing only) are never published.
const poems = (await readPoems(DATA_FILE)).filter((p) => p.mode !== 'mock');
await writeFile(path.join(OUT, 'poems.json'), JSON.stringify(poems, null, 2) + '\n');
await writeFile(path.join(OUT, '.nojekyll'), ''); // serve files as-is, no Jekyll processing

console.log(`✔ Built _site/ (${poems.length} AI poems; mock entries excluded)`);

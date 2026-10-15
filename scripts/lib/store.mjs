import { readFile, writeFile, rename } from 'node:fs/promises';
import { config } from './config.mjs';

// Hard cap on stored poems. The file can never hold more than this, so it stays tiny.
export const MAX_POEMS = config.maxPoems;

/** Reads the poem array. A missing or corrupt file is treated as empty, never a crash. */
export async function readPoems(file) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`  ⚠ could not parse ${file}, starting fresh: ${err.message}`);
    return [];
  }
}

/** Sorts oldest → newest and keeps only the newest `max` poems. */
export function prune(poems, max = MAX_POEMS) {
  const sorted = [...poems].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.slice(Math.max(0, sorted.length - max));
}

/** Appends a poem, drops the oldest beyond MAX_POEMS, and writes atomically. */
export async function appendPoem(file, poem, max = MAX_POEMS) {
  const before = await readPoems(file);
  const kept = prune([...before, poem], max);
  const removed = before.length + 1 - kept.length;

  // Write to a temp file then rename, so an interrupted write can't corrupt poems.json.
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(kept, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
  return { total: kept.length, removed };
}

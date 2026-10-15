import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_FILE = path.join(ROOT, 'data', 'poems.json');
// Records the last live attempt (even failed ones) so the cooldown protects the free APIs.
export const STATE_FILE = path.join(ROOT, 'data', 'last-run.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export const config = JSON.parse(readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

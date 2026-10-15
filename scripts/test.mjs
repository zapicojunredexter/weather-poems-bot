// Offline self-checks (no network): npm test
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePoem, parsePoemText } from './lib/poet.mjs';
import { normalizeWeather } from './lib/weather.mjs';
import { mockPoem, mockWeather, MOCK_POEM_COUNT } from './lib/mock.mjs';
import { CITIES, findCity, nextCity } from './lib/cities.mjs';
import { appendPoem, readPoems, prune, MAX_POEMS } from './lib/store.mjs';
import { cooldownRemaining } from './generate.mjs';

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}`);
};
const PLACES = ['Manila', 'Philippines'];
const poem = (...lines) => ({ title: 'Test Poem', lines: ['soft light', 'over the roofs', 'a slow breeze', ...lines] });

console.log('— Poem validator: must ACCEPT');
for (let i = 0; i < MOCK_POEM_COUNT; i++) check(validatePoem(mockPoem(i), PLACES).length === 0, `mock poem ${i + 1}`);
check(validatePoem(poem('warm air over Manila', 'I watch the clouds'), PLACES).length === 0, 'place name, "I", and "warm" are fine');
check(validatePoem(poem('Rain comes. Then it stops.'), PLACES).length === 0, 'capital after a full stop is fine');
check(validatePoem(poem('over Manila’s quiet roofs', "and Manila's streets"), PLACES).length === 0, 'possessive place name (curly or straight apostrophe)');

console.log('\n— Poem validator: must REJECT');
const reject = [
  ['brand name', poem('a Jollibee sign glows')],
  ['lowercase brand', poem('scrolling tiktok in the rain')],
  ['politician', poem('the mayor waves at clouds')],
  ['named politician', poem('as Marcos once said')],
  ['unknown proper noun (person)', poem('and Maria walks home')],
  ['other place', poem('the wind from Cebu arrives')],
  ['possessive unknown name', poem('under Maria’s umbrella')],
  ['digits', poem('it is 34 degrees')],
  ['recited measurement', poem('heat at thirty-one point three degrees')],
  ['link', poem('see www.example.com')],
  ['hashtag', poem('#blessed sunshine')],
  ['dark theme', poem('the flood brings death')],
  ['profanity', poem('damn this heat')],
  ['city not chosen for this poem', poem('just like the hills of Baguio')],
  ['too short', { title: 'Short', lines: ['one', 'two'] }],
  ['no title', { title: '', lines: ['a', 'b', 'c', 'd'] }],
];
for (const [label, p] of reject) check(validatePoem(p, PLACES).length > 0, label);

console.log('\n— Poem text parsing');
const parsed1 = parsePoemText('Quiet Heat\n\nthe roofs shimmer\na bird rests\nthe wind sleeps\nevening comes');
check(parsed1.title === 'Quiet Heat' && parsed1.lines.length === 4, 'plain "title, blank line, poem" format');
const parsed2 = parsePoemText('**Title:** Quiet Heat\n\n```\nthe roofs shimmer\na bird rests\n```');
check(parsed2.title === 'Quiet Heat' && parsed2.lines.length === 2, 'strips markdown and "Title:" labels');
const parsed3 = parsePoemText('{"title":"Quiet Heat","lines":["a","b"]}');
check(parsed3.title === 'Quiet Heat' && parsed3.lines.length === 2, 'still accepts a JSON reply');

console.log('\n— Weather parsing');
const sample = {
  current: { temperature_2m: 29.2, relative_humidity_2m: 64, weather_code: 1 },
  daily: {
    time: ['2026-10-15'], weather_code: [51], temperature_2m_max: [34.9], temperature_2m_min: [26.7],
    precipitation_sum: [0.7], precipitation_probability_max: [63], wind_speed_10m_max: [10.5],
    uv_index_max: [8.25], sunrise: ['2026-10-15T05:47'], sunset: ['2026-10-15T17:36'],
  },
};
const w = normalizeWeather(sample);
check(w.description === 'light drizzle' && w.tempMax === 34.9 && w.sunrise === '05:47', 'normalizes an Open-Meteo response');
let threw = false;
try { normalizeWeather({}); } catch { threw = true; }
check(threw, 'rejects a response with no temperatures');

console.log('\n— Cooldown (counts failed attempts too)');
const now = Date.parse('2026-10-15T12:00:00Z');
check(cooldownRemaining(null, now, 60) === 0, 'no previous attempt → no wait');
check(cooldownRemaining('2026-10-15T11:59:30Z', now, 60) === 30, 'attempt 30s ago → wait 30s');
check(cooldownRemaining('2026-10-15T11:58:00Z', now, 60) === 0, 'attempt 2 min ago → go ahead');

console.log('\n— Cities');
check(CITIES.length > 0, `city list is configured (${CITIES.length} cities)`);
check(new Set(CITIES.map((c) => c.name)).size === CITIES.length, 'no duplicate city names');
check(CITIES.every((c) => c.latitude > 4 && c.latitude < 21 && c.longitude > 116 && c.longitude < 127), 'all coordinates are inside the Philippines');
check(findCity('cebu city')?.name === 'Cebu City', 'finds a city case-insensitively');
check(findCity('Atlantis') === null, 'unknown city → null');
check(nextCity(undefined).name === CITIES[0].name, 'first run starts at the top of the list');
check(nextCity(CITIES.at(-1).name).name === CITIES[0].name, 'rotation wraps around');
check(validatePoem(poem('rain over Cagayan de Oro', 'and Cagayan de Oro’s river'), ['Cagayan de Oro', 'Philippines']).length === 0, 'multi-word city name allowed');
check(validatePoem(poem('the sea near Lapu-Lapu glows'), ['Lapu-Lapu', 'Philippines']).length === 0, 'hyphenated city name allowed');

console.log(`\n— ${MAX_POEMS}-poem cap (from config.json)`);
const t0 = Date.parse('2026-10-15T12:00:00Z');
const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), date: new Date(t0 + i * 60000).toISOString() }));
const firstKept = String(many.length - MAX_POEMS + 1);
const kept = prune([...many].reverse(), MAX_POEMS);
check(kept.length === MAX_POEMS, `prune keeps exactly ${MAX_POEMS} (got ${kept.length})`);
check(kept[0].id === firstKept && kept.at(-1).id === '12', `keeps the ${MAX_POEMS} newest, sorted oldest → newest`);

const dir = mkdtempSync(path.join(tmpdir(), 'poems-test-'));
try {
  const file = path.join(dir, 'poems.json');
  writeFileSync(file, 'not json');
  for (const p of many) await appendPoem(file, p);
  const list = await readPoems(file);
  check(list.length === MAX_POEMS, `after 12 saves the file holds ${MAX_POEMS} poems (got ${list.length})`);
  check(list[0].id === firstKept && list.at(-1).id === '12', `the ${12 - MAX_POEMS} oldest were dropped (and a corrupt file was survived)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\n✖ ${failures} check(s) failed` : '\n✔ all checks passed');
process.exitCode = failures ? 1 : 0;

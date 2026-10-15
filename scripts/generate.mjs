#!/usr/bin/env node
// Manual trigger: pick a city → fetch its weather → AI writes a poem → save to data/poems.json.
// Runs once and exits. Nothing runs in the background.
//
//   npm run generate                      live, next city in the rotation
//   npm run generate -- --city "Baguio"   live, a specific city
//   npm run generate -- --list            list the cities
//   npm run generate:mock                 mock: sample weather + placeholder poem, zero network
//
// If the weather or the AI fails, NOTHING is saved (no templates, no sample data in live mode).

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config, DATA_FILE, STATE_FILE } from './lib/config.mjs';
import { CITIES, findCity, nextCity, toLocation } from './lib/cities.mjs';
import { fetchWeather } from './lib/weather.mjs';
import { writePoemWithAI } from './lib/poet.mjs';
import { mockWeather, mockPoem } from './lib/mock.mjs';
import { readPoems, appendPoem, MAX_POEMS } from './lib/store.mjs';

const args = process.argv.slice(2);
const MOCK = args.includes('--mock') || process.env.MOCK_MODE === '1' || config.mockMode === true;
const cityArg = args.includes('--city') ? args[args.indexOf('--city') + 1] : null;

/** Seconds until another live attempt is allowed (0 = go ahead). */
export function cooldownRemaining(lastAttemptIso, now = Date.now(), cooldownSeconds = config.apiCooldownSeconds) {
  if (!lastAttemptIso) return 0;
  const elapsed = (now - new Date(lastAttemptIso).getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
}

async function readLastAttempt() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8')).lastLiveAttempt ?? null;
  } catch {
    return null;
  }
}

async function main() {
  if (args.includes('--list')) {
    CITIES.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. ${c.name} (${c.region})`));
    return;
  }

  const poems = await readPoems(DATA_FILE);
  let city;
  if (cityArg) {
    city = findCity(cityArg);
    if (!city) {
      console.error(`✖ Unknown city "${cityArg}". Run "npm run generate -- --list" to see the options.`);
      process.exitCode = 1;
      return;
    }
  } else {
    city = nextCity(poems.at(-1)?.location?.name);
  }
  const location = toLocation(city);
  console.log(`▶ Weather poem for ${location.name}, ${location.country}${MOCK ? ' (MOCK MODE: no network)' : ''}`);

  let weather;
  let poem;

  if (MOCK) {
    weather = mockWeather(location);
    poem = mockPoem(poems.filter((p) => p.mode === 'mock').length);
    console.log('  • using sample weather and a placeholder poem (not AI)');
  } else {
    const wait = cooldownRemaining(await readLastAttempt());
    if (wait > 0) {
      console.log(`✋ Cooldown: the last live attempt was under ${config.apiCooldownSeconds}s ago. Wait ${wait}s,`);
      console.log('   or use "npm run generate:mock" while working on the UI.');
      return;
    }
    // Record the attempt BEFORE calling the APIs, so even failed runs respect the cooldown.
    await writeFile(STATE_FILE, JSON.stringify({ lastLiveAttempt: new Date().toISOString() }) + '\n');

    try {
      weather = await fetchWeather(location);
      console.log(`  ✓ weather: ${weather.description}, ${weather.tempMin}–${weather.tempMax}°C (Open-Meteo)`);
    } catch (err) {
      console.error(`✖ Couldn't get weather data (${err.message}). Nothing was saved.`);
      process.exitCode = 1;
      return;
    }

    try {
      poem = await writePoemWithAI(weather, location);
      console.log(`  ✓ poem written by ${poem.model}`);
    } catch (err) {
      console.error(`✖ The AI couldn't produce an acceptable poem (${err.message}). Nothing was saved.`);
      process.exitCode = 1;
      return;
    }
  }

  const entry = {
    id: randomUUID(),
    date: new Date().toISOString(),
    mode: MOCK ? 'mock' : 'live',
    source: MOCK ? 'mock' : 'ai',
    location: { name: location.name, region: location.region, country: location.country },
    weather,
    title: poem.title,
    lines: poem.lines,
    ...(poem.model && { model: poem.model }),
  };

  const { total, removed } = await appendPoem(DATA_FILE, entry);
  console.log(`✔ Saved "${entry.title}" (${total}/${MAX_POEMS} poems${removed ? `, removed ${removed} oldest` : ''})`);
  console.log(`\n  View it: run "npm run serve", then open http://${config.server.host}:${config.server.port}`);
}

// Only run when called directly (tests import cooldownRemaining without generating).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✖ Failed: ${err.message}. Nothing was saved.`);
    process.exitCode = 1;
  });
}

import { fetchWithTimeout } from './http.mjs';

// Pollinations "Free API Classic": no key, anonymous, one text request at a time per IP,
// at least 30s apart. It doesn't train on prompts without opt-in. We send weather numbers only.
const ENDPOINT = 'https://text.pollinations.ai/openai';

// Models whose free hosting forbids publishing output (NVIDIA API Trial Terms). Checked on every reply.
const DISALLOWED_MODELS = /nvidia|nemotron/i;

export const SYSTEM_PROMPT = `You are a quiet, careful poet who writes one short original poem about a single day's weather.

What to write:
- One original poem of 6 to 12 short lines inspired ONLY by the weather details you are given.
- Use sensory imagery: light, heat, clouds, rain, wind, sky, sea, trees, birds, streets, windows, morning, dusk.
- Keep it gentle, calm, and suitable for all ages. Free verse is fine; rhyme is optional.
- Give it a short title of 1 to 5 words.

Hard rules (never break these):
- Write entirely original lines. Do not quote, imitate, or paraphrase any existing poem, song, scripture, or slogan.
- Never mention any brand, company, product, app, store, or website.
- Never mention any real person: no public figures, celebrities, politicians, officials, or historical figures.
- Never mention politics, government, elections, news events, religion, money, or prices.
- Never mention disasters, injuries, death, danger, or warnings. Even in a storm, stay observational and calm.
- The only place name you may use is the one given to you. Invent no other names of people or places.
- Don't recite measurements (no temperatures, percentages, speeds, or times). Turn the numbers into feelings and images instead: "heavy, humid air", "a breeze that barely moves the leaves".
- No digits, hashtags, emojis, links, or quotation marks.
- Don't claim facts beyond the weather data you were given.

Output format (plain text, nothing else):
- First line: the title only.
- Then one blank line.
- Then the poem, one line per line.
No markdown, no labels like "Title:", no commentary before or after.`;

export function buildUserPrompt(weather, location) {
  const parts = [
    `Place: ${location.name}`,
    `Date: ${weather.date ?? 'today'}`,
    `Sky: ${weather.description}`,
    `Temperature: high ${weather.tempMax}°C, low ${weather.tempMin}°C`,
    weather.humidity !== null && `Humidity: ${weather.humidity}%`,
    weather.rainChance !== null && `Chance of rain: ${weather.rainChance}%`,
    weather.windMax !== null && `Strongest wind: ${weather.windMax} km/h`,
    weather.sunrise && weather.sunset && `Sunrise ${weather.sunrise}, sunset ${weather.sunset}`,
  ].filter(Boolean);
  return `Today's weather:\n${parts.join('\n')}\n\nWrite today's poem.`;
}

// ---------------------------------------------------------------------------
// Validation: the prompt asks nicely; this enforces it. Any failure discards the poem.
// ---------------------------------------------------------------------------

// Capitalized words that are fine mid-line.
const BASE_ALLOWED_CAPS = new Set([
  'i', "i'm", "i'll", "i've", "i'd", 'o',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
]);

// Lowercase mentions that are still not allowed (brands, platforms, political words, etc.).
const BLOCKED_TERMS = [
  // recited measurements (the prompt asks for imagery instead)
  'degrees?', 'celsius', 'percent', 'kilometers?', 'kilometres?', 'km', 'kph', 'mph', 'millimeters?',
  // brands, platforms, products
  'iphone', 'ipad', 'android', 'google', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'netflix',
  'spotify', 'samsung', 'microsoft', 'amazon', 'shopee', 'lazada', 'gcash', 'jollibee',
  'mcdonald\\w*', 'starbucks', 'coca-cola', 'coke', 'pepsi', 'nike', 'adidas', 'toyota', 'chatgpt', 'openai',
  // politics and public life
  'president', 'senator', 'senate', 'mayor', 'governor', 'congress', 'congressman', 'election', 'vote',
  'politic\\w*', 'government', 'marcos', 'duterte', 'robredo', 'aquino', 'pacquiao', 'rizal',
  // off-limits themes
  'death', 'dead', 'die', 'dying', 'kill', 'blood', 'war', 'gun', 'bomb', 'disaster', 'flood warning',
  'evacuat\\w*', 'casualt\\w*', 'money', 'peso', 'dollar', 'price', 'church', 'god', 'prayer', 'bible',
  // profanity
  'fuck', 'shit', 'damn', 'bitch', 'puta', 'gago', 'tangina',
];
// Whole words only ("war" must not match "warm"); simple plurals are allowed.
const BLOCKED_RE = new RegExp(`(?<![a-z])(${BLOCKED_TERMS.join('|')})s?(?![a-z])`, 'i');

/**
 * Returns a list of problems with a poem (empty list = OK).
 * `placeNames` are the only proper nouns allowed besides days/months and "I".
 */
export function validatePoem(poem, placeNames = []) {
  const problems = [];
  const title = typeof poem?.title === 'string' ? poem.title.trim() : '';
  const lines = Array.isArray(poem?.lines) ? poem.lines.map((l) => String(l).trim()).filter(Boolean) : [];

  if (!title || title.length > 60) problems.push('title missing or longer than 60 characters');
  if (lines.length < 4 || lines.length > 14) problems.push(`expected 4-14 lines, got ${lines.length}`);
  if (lines.some((l) => l.length > 90)) problems.push('a line is longer than 90 characters');

  const allowed = new Set(BASE_ALLOWED_CAPS);
  for (const name of placeNames) for (const w of name.toLowerCase().split(/\s+/)) allowed.add(w);

  for (const text of [title, ...lines]) {
    if (/https?:|www\.|\.com\b|@|#/i.test(text)) problems.push(`link, handle, or hashtag: "${text}"`);
    if (/\d/.test(text)) problems.push(`digits (numbers must be spelled out): "${text}"`);
    const blocked = text.match(BLOCKED_RE);
    if (blocked) problems.push(`blocked term "${blocked[1]}": "${text}"`);

    // Proper-noun check: a Capitalized word that isn't the first word of the line/sentence
    // and isn't an allowed name is treated as a possible brand, person, or place.
    const words = text.split(/\s+/);
    words.forEach((raw, i) => {
      // Normalize curly apostrophes and drop possessives, so "Manila’s" counts as "Manila".
      const word = raw
        .replace(/[’‘`]/g, "'")
        .replace(/^[^\p{L}]+|[^\p{L}']+$/gu, '')
        .replace(/'s$/i, '');
      if (!word || !/^\p{Lu}/u.test(word)) return;
      const startsSentence = i === 0 || /[.!?;:—–-]$/.test(words[i - 1]);
      if (startsSentence || text === title) return; // titles are Title Case; checked by the blocklist
      if (!allowed.has(word.toLowerCase())) problems.push(`unexpected proper noun "${word}"`);
    });
  }
  return [...new Set(problems)];
}

/** Parses "Title\n\nline\nline..." (tolerates stray markdown, labels, or a JSON reply). */
export function parsePoemText(text) {
  const raw = String(text).trim();
  if (raw.startsWith('{')) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j.title === 'string' && Array.isArray(j.lines)) return { title: j.title, lines: j.lines };
    } catch {
      /* fall through to plain-text parsing */
    }
  }
  const rows = raw
    .replace(/```[a-z]*|```/gi, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\*\*|__/g, '').replace(/^\s*#+\s*/, '').replace(/^\s*(title|poem)\s*:\s*/i, '').trim());
  const firstText = rows.findIndex(Boolean);
  if (firstText === -1) throw new Error('empty poem');
  return {
    title: rows[firstText].replace(/^["“]|["”]$/g, ''),
    lines: rows.slice(firstText + 1).filter(Boolean),
  };
}

/** Asks Pollinations for a poem. Throws on any failure or validation problem. */
export async function writePoemWithAI(weather, location) {
  const res = await fetchWithTimeout(
    ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        temperature: 0.9,
        max_tokens: 1500, // the free model reasons before answering, so leave room
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(weather, location) },
        ],
      }),
    },
    60000
  );

  const data = await res.json();
  if (DISALLOWED_MODELS.test(String(data?.model ?? ''))) {
    throw new Error(`model ${data.model} is under NVIDIA trial terms; output discarded`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(data?.error?.message || 'empty response');

  const parsed = parsePoemText(content);
  const problems = validatePoem(parsed, [location.name, location.country]);
  if (problems.length) throw new Error(`poem rejected: ${problems.join('; ')}`);

  return {
    title: parsed.title.trim(),
    lines: parsed.lines.map((l) => String(l).trim()).filter(Boolean),
    model: `pollinations/${data.model || 'unknown'}`,
  };
}

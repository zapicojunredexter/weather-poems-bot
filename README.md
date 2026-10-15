# Weather Poetry Diary

Every Monday morning, this bot turns the weather in a city from a fixed list of **Philippine cities** into a short, **AI-generated** poem, shown in a minimalist diary timeline. Only the latest **5 poems** are kept (about five weeks).

- **No API keys:** weather from [Open-Meteo](https://open-meteo.com/), poems from [Pollinations](https://pollinations.ai/).
- **No dependencies:** plain Node.js, so there's nothing to `npm install`.
- **No background processes locally:** every local action is a command you run yourself. On GitHub, a GitHub Actions workflow runs it once a week (Monday, 7:00 AM PHT).
- **Owner-controlled automation:** even though it's automated, the repository owner can pause or switch off the pipeline at any time, without notice (see [Switching the automation off](#switching-the-automation-off)).

## Directory structure

```
weather-poetry-bot/
├── .github/workflows/
│   └── weekly-poem.yml      # GitHub Actions: Mondays 7:00 AM PHT → poem → commit → GitHub Pages
├── config.json              # city list, 5-poem cap, mock toggle, cooldown, server port
├── package.json             # npm scripts only (no dependencies)
├── data/
│   ├── poems.json           # The "database": JSON array, max 5 poems
│   └── last-run.json        # Local only (git-ignored): time of the last live attempt
├── public/
│   └── index.html           # The diary page (built-in CSS + JS, theme switcher, city filter)
└── scripts/
    ├── generate.mjs         # Trigger: city → weather → AI poem → poems.json
    ├── build.mjs            # Builds _site/ for GitHub Pages (page + poems.json)
    ├── serve.mjs            # Local web server (127.0.0.1 only) for viewing the page
    ├── test.mjs             # Offline self-checks
    └── lib/
        ├── cities.mjs       # City lookup + rotation
        ├── weather.mjs      # Open-Meteo request + weather-code descriptions
        ├── poet.mjs         # Strict system prompt, Pollinations call, poem validator
        ├── mock.mjs         # Mock Data Mode: sample weather + placeholder poems (not AI)
        ├── store.mjs        # Append, 5-poem cap, atomic write
        ├── config.mjs  http.mjs
```

## Run it

Requires Node.js 18.17 or newer.

```bash
npm test                                  # offline self-checks
npm run generate                          # next city in the rotation (live)
npm run generate -- --city "Baguio"       # a specific city (live)
npm run generate -- --list                # list the cities
npm run generate:mock                     # MOCK MODE: no network at all
npm run serve                             # open http://127.0.0.1:8080 (Ctrl+C to stop)
npm run build                             # optional: preview what GitHub Pages will publish (_site/)
```

Each `generate` run writes **one poem for one city** and exits. Run it again for the next city, then refresh the page.

## Cities

The list is fixed and was picked arbitrarily for geographic variety. It's **not a ranking**, and being included or left out doesn't reflect any preference. The page says the same.

Manila, Quezon City, Makati, Taguig, Pasig, Baguio, Vigan, Angeles, Tagaytay, Legazpi, Puerto Princesa, Iloilo City, Bacolod, Cebu City, Lapu-Lapu, Tacloban, Cagayan de Oro, Davao City, General Santos and Zamboanga City.

- Runs go through the list in order and wrap around.
- `--city` picks one directly.
- Edit `cities` in `config.json` to change the list. Each city needs a name, region, latitude and longitude.
- The page has a city filter.

## When something fails, nothing is saved

There are no template poems and no sample-weather fallbacks in live mode.

- **Weather fails:** if Open-Meteo is unreachable or returns bad data, the run stops with an error and saves nothing.
- **AI fails:** if Pollinations is unreachable, or its poem fails the safety checks, the run stops with an error and saves nothing.

So every entry on the page is a real AI poem based on real forecast data. The only exception is mock entries, which you create on purpose for UI testing; they're labeled "mock (not AI)".

## Rate-limit safety

- **Cooldown:** a live attempt is refused if the previous attempt, *including failed ones*, was under 60s ago (`apiCooldownSeconds`). Pollinations asks for at least 30s between requests.
- **One request each:** every live run makes exactly one Open-Meteo request and one Pollinations request, with no retries.
- **Mock mode** (`npm run generate:mock`, `MOCK_MODE=1`, or `"mockMode": true`) makes zero network requests. Use it while working on the page.

## Storage: max 5 poems

`poems.json` never holds more than `maxPoems` (5) poems. When a 6th is saved, the oldest is dropped, so the file stays a few kilobytes no matter how often you run it. Writes are atomic, so an interrupted run can't corrupt the file.

## Theme switcher

The top-right control offers **Auto, Light and Dark**:

- **Auto** (default) uses the viewer's clock: light from 6:00 AM to 5:59 PM, dark otherwise. It switches by itself at 6 AM and 6 PM using a single timer, not a polling loop.
- **Light** and **Dark** override Auto. The choice is saved in that browser's `localStorage` only. If storage is blocked (e.g. private mode), the page still works and just won't remember the choice.
- The theme is applied before the page paints, so there's no flash.

## Keeping poems clean

The **system prompt** (`scripts/lib/poet.mjs`) requires:
- 6–12 original lines about the given weather only
- no brands, real people or politicians
- no other place names
- no politics, news, religion, money, disasters or warnings
- no digits, hashtags, emojis, links or quotes

The **validator** enforces those rules in code and rejects the poem if it contains:
- any capitalized word mid-sentence that isn't the chosen city, "Philippines", a day or month, or "I"
- blocklisted terms: brands, political titles and names, dark themes, money, or profanity
- digits, links, handles or hashtags
- the wrong length

A rejected poem is discarded, and nothing is saved.

The page renders all poem text with `textContent`, so AI output can never inject HTML or scripts.

## Transparency

The page itself states:
- **A banner at the top:** every poem is written entirely by AI, not reviewed by a person, and not a forecast.
- **"How this is made (tech stack)":** the weekly GitHub Actions schedule (with a note that the owner can switch it off), the cities, Open-Meteo, gpt-oss-20b via Pollinations, the safety checks, local JSON storage (max 5 poems), and the static page on GitHub Pages.
- **On every poem:** an "AI-generated" badge plus the model and data source.
- **The Disclaimer section:**
  - 100% AI-generated
  - not a weather forecast (with a link to PAGASA for official forecasts)
  - not fact or advice
  - originality not guaranteed
  - no real people or brands intended
  - not affiliated with any city, government or provider
  - mock entries are placeholders
  - no tracking
  - provided "as is"

## Deploy to GitHub (weekly poem, Mondays 7:00 AM PHT)

The workflow in `.github/workflows/weekly-poem.yml` is ready. It runs:

| When | What happens |
|---|---|
| **Every Monday at 7:00 AM PHT** (cron `0 23 * * 0` = Sunday 23:00 UTC) | tests → write one poem for the next city → commit `data/poems.json` → publish to GitHub Pages |
| **"Run workflow" button** (Actions tab) | the same, on demand, which is handy for testing |
| **Every push to `main`** | tests → republish the page (no new poem) |

**One-time setup:**
1. Create a **public** GitHub repo and push this folder to the `main` branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions tab → "Weekly weather poem" → Run workflow** to test it immediately.

The site will be at `https://<your-username>.github.io/<repo-name>/`. No secrets or API keys are needed.

**Good to know:**
- **If the weather or AI fails** that Monday, nothing is saved. The run shows a yellow warning ("No poem this week") and the existing page stays up. It never publishes a broken or template poem. Use **Run workflow** to try again.
- **GitHub's schedule can be late,** sometimes by several minutes or more at busy times.
- **Pollinations limits requests by IP address,** and GitHub's servers share IPs with other users, so an occasional skipped day is expected.
- **GitHub pauses schedules** in repos with no activity for 60 days. The weekly poem commits count as activity, so it only matters after about 8 failed weeks in a row.
- **One bot commit per successful week** (about 52 a year), touching only `data/poems.json`.
- **Runs never overlap.** Concurrency is limited to one run at a time, so a manual run can't collide with the scheduled one.
- **City rotation continues from day to day,** because it's based on the last poem in the committed `poems.json`.

## Switching the automation off

This project is automated, but **the repository owner stays in control and may pause or switch off the pipeline at any time, without notice**. The page says so in its tech-stack section and disclaimer.

| To… | Do this | Commit needed? |
|---|---|---|
| **Pause** the weekly poem | Actions tab → **Weekly weather poem** → **⋯** → **Disable workflow** (or `gh workflow disable weekly-poem.yml`) | No |
| **Resume** it | Same place → **Enable workflow** (or `gh workflow enable weekly-poem.yml`) | No |
| **Stop all automation** in the repo | Settings → Actions → General → **Disable actions** | No |
| **Keep it manual-only** | Delete the `schedule:` lines in the workflow. The **Run workflow** button still works. | Yes |

While it's disabled, the site stays online and shows the last published poems.

## Terms and attribution

- **Open-Meteo:** the free API is for **non-commercial** use (up to 10,000 calls/day) under **CC BY 4.0**. The page footer credits Open-Meteo.com, as required.
- **Pollinations:** anonymous access is allowed, with one text request at a time at least 30s apart. Pollinations says it doesn't train on prompts without opt-in. Only the city name and weather numbers are sent.
- **AI model:** `gpt-oss-20b` (Apache 2.0). As a precaution, replies from NVIDIA-hosted models are discarded, because NVIDIA's free trial terms forbid publishing their output.

## Reset

To clear all poems, replace the contents of `data/poems.json` with `[]`.

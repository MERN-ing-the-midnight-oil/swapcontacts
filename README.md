# Swap Event Finder

Finds non-profit gear swap events (bike swaps, ski swaps, etc.) across the USA
and builds a contact database with emails, phone numbers, Facebook pages, and LinkedIn leads (directors, organizers, volunteers).

## Setup

```bash
npm install
cp .env.example .env
# Add your Anthropic API key to .env
npm run build
```

## Usage

```bash
# Run full pipeline (discover + enrich)
npm run start -- run

# Run only discovery
npm run start -- discover

# Run superjob discovery (~10M-pop regions — see Discovery strategy)
npm run discover:regional

# Re-run only jobs due for seasonal refresh (bike: Jan–Apr, ski: Jul–Oct, gear: Feb–Mar & Aug–Sep)
npm run discover:regional
# Add --no-seasonal-refresh to skip re-running completed jobs outside a refresh window

# Run only enrichment on already-discovered events
npm run start -- enrich

# Check progress
npm run start -- status

# Run specific jobs only
npm run start -- discover --jobs eb-bike,eb-ski
```

## Output

Results are written to `./output/`:
- `events.csv` — all discovered events (Pass 1)
- `contacts.csv` — enriched contact info (Pass 2)
- `jobs-state.json` — job progress (for resuming)

## Discovery strategy (bang for buck)

The US is split into **superjobs** — regions of roughly **10 million people** each. A superjob may be one state, several small states combined, or a slice of a large state / metro. Anthropic gets a plain-language place name (e.g. *"Washington state and Alaska"*); we don't geocode or filter results.

Examples:
- **Washington + Alaska** (~8.5M) — one superjob
- **NYC metro** (~20M) — own superjob (large metros exceed 10M and get their own)
- **California** — split into LA, NorCal, SoCal, and North Coast superjobs

Each superjob runs a **bundle** of discovery searches: gear swap, bike swap, kids equipment swap, plus ski/hockey/Nordic where the region overlaps those cultures. Facebook and Eventbrite gear passes run for superjobs ≥ ~8M pop.

### Seasonal re-runs (safe — dedup prevents duplicate orgs)

| Season tag | Jobs | Refresh window |
|------------|------|----------------|
| `bike-spring` | Bike swaps | Jan–Apr |
| `ski-fall` | Ski + Nordic swaps | Jul–Oct |
| `all-season` | Gear, kids, platform passes | Feb–Mar & Aug–Sep |

Use `--no-seasonal-refresh` to only run never-completed jobs.

### Resume & dedup

- `jobs-state.json` — skip completed jobs (unless seasonal refresh applies)
- `events.csv` — skip duplicate name+location
- `enrich` — only new event IDs

Superjob definitions: [`src/superjobs.ts`](src/superjobs.ts).

## Cost estimate

- Pass 1 nationwide (12 jobs): ~$0.15–0.30
- Pass 1 regional (~34 superjobs, ~150–180 discovery calls): ~$8–20 depending on model
- Pass 2 (per event): ~$0.02–0.05 per enrichment

## Outreach tracker (browser app)

Track who you've contacted, call notes, email drafts, and status. Lives in `docs/` for GitHub Pages.

**Typical workflow** (Anthropic search built into this repo):

```bash
# 1. Discover + enrich contacts (uses ANTHROPIC_API_KEY in .env)
npm run pipeline          # or: npm run discover && npm run enrich

# 2. Sync into the browser app
npm run outreach:sync

# 3. Local preview with superjob runner (http://localhost:3333)
npm run outreach:dev
# or sync + serve: npm run outreach:serve
```

Open **Discover** (`#/discover`) to pick a region, run discovery + enrichment, then **Open outreach** for calls, emails, and notes. Requires `ANTHROPIC_API_KEY` in `.env` and the local API server (`outreach:dev`).

Open `docs/index.html` via a local server (not `file://`) so it can load `contacts.csv` automatically.

**Features:** per-channel contacted checkmarks, sort by uncontacted channel, activity log, AI email drafts (API key stored in browser only), export/import JSON backup, automatic **cloud sync** of checkmarks and notes.

### Cloud sync

Checkmarks and notes sync automatically to Supabase on every edit. No setup or sign-in required — the app signs in anonymously on first load and saves your progress to the cloud.

Sign in with Google (mobile settings) if you want the same progress on other devices or browsers.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. Enable **Anonymous sign-ins** under Authentication → Providers.
3. Enable **Google** (and/or **Email**) if you want cross-device sync via sign-in.
4. Add your site URL under Authentication → URL configuration:
   - Site URL: your GitHub Pages URL (e.g. `https://you.github.io/swapcontacts/`)
   - Redirect URLs: same URL (and `http://localhost:3333` for local dev)

Supabase credentials are embedded in `index.html`. For a different project during local dev, run `npm run outreach:config` to write `docs/supabase-config.js` (overrides the embedded config when present).

**Merge behavior:** on sign-in, local and cloud data merge (contacted flags OR together; notes/drafts keep the longer text; logs dedupe). Changes auto-save to the cloud ~800ms after each edit. Realtime updates apply when another tab or device writes.

### Deploy to GitHub Pages (no workflow required)

1. Push this repo to GitHub.
2. Run `npm run outreach:sync` and commit `docs/contacts.csv` + `docs/index.html`.
3. In the repo: **Settings → Pages → Build and deployment**:
   - **Source:** **GitHub Actions** (recommended — runs `.github/workflows/pages.yml` on every push)
   - Or: Deploy from branch `main`, folder **`/docs`**
4. After deploy: **https://mern-ing-the-midnight-oil.github.io/swapcontacts/**

If you still see a **dark** theme, Pages is serving a stale build — switch to **GitHub Actions** and re-run the workflow from the **Actions** tab.

**Privacy:** If the repo is public, `contacts.csv` (emails, phones) will be public on Pages. Use a private repo or strip sensitive fields before syncing if needed.

# Swap Event Finder

Finds non-profit gear swap events (bike swaps, ski swaps, etc.) across the USA
and builds a contact database with emails, phone numbers, and Facebook pages.

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

## Cost estimate

- Pass 1 (12 jobs): ~$0.15–0.30 in API credits
- Pass 2 (per event): ~$0.02–0.05 per enrichment
- Full run of 50 events: roughly $1.50–3.00 total

## Outreach tracker (browser app)

Track who you've contacted, call notes, email drafts, and status. Lives in `docs/` for GitHub Pages.

```bash
# After updating contacts.csv from the CLI
npm run outreach:sync

# Local preview (http://localhost:3333)
npm run outreach:serve
```

Open `docs/index.html` via a local server (not `file://`) so it can load `contacts.csv` automatically.

**Features:** per-channel contacted checkmarks, sort by uncontacted channel, activity log, AI email drafts (API key stored in browser only), export/import JSON backup, optional **Supabase cloud sync** across devices.

### Cloud sync (Supabase)

Checkmarks and notes sync to your Supabase project when signed in. Without config, progress stays in `localStorage` only.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
2. Enable **Google** (and/or **Email**) under Authentication → Providers.
3. Add your site URL under Authentication → URL configuration:
   - Site URL: your GitHub Pages URL (e.g. `https://you.github.io/swapcontacts/`)
   - Redirect URLs: same URL (and `http://localhost:3333` for local dev)
4. Add to `.env`:
   ```bash
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
5. Generate browser config and sync:
   ```bash
   npm run outreach:config   # writes docs/supabase-config.js (gitignored)
   npm run outreach:sync
   ```

`docs/supabase-config.js` is gitignored for local dev — regenerate with `npm run outreach:config`. For GitHub Pages, add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the deploy workflow writes the config at build time).

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

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const out = path.join(__dirname, '..', 'docs', 'supabase-config.js');

if (!url || !key) {
  console.log('SUPABASE_URL / SUPABASE_ANON_KEY not set — skipping supabase-config.js (localStorage only)');
  process.exit(0);
}

const body = `window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(key)},
};
`;

fs.writeFileSync(out, body);
console.log('Wrote docs/supabase-config.js');

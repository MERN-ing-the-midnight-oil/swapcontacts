#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const out = path.join(__dirname, '..', 'docs', 'supabase-config.js');

if (!url || !key) {
  // Always emit a file so the app never pays for a GitHub Pages 404 on this request.
  if (!fs.existsSync(out)) {
    fs.writeFileSync(out, 'window.SUPABASE_CONFIG = null;\n');
    console.log('Wrote docs/supabase-config.js (cloud sync disabled)');
  } else {
    console.log('SUPABASE_URL / SUPABASE_ANON_KEY not set — keeping existing supabase-config.js');
  }
  process.exit(0);
}

const body = `window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(key)},
};
`;

fs.writeFileSync(out, body);
console.log('Wrote docs/supabase-config.js');

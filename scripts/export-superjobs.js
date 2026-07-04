#!/usr/bin/env node
/** Writes docs/superjobs.json for static superjob list (no API required). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distPath = path.join(root, 'dist', 'superjobs.js');
if (!fs.existsSync(distPath)) {
  console.error('Run npm run build first.');
  process.exit(1);
}

const { SUPERJOBS } = require(distPath);
const docsSuperjobs = path.join(root, 'docs', 'superjobs');
const out = path.join(root, 'docs', 'superjobs.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

const catalog = SUPERJOBS.map((sj) => {
  const csvPath = path.join(docsSuperjobs, sj.id, 'contacts.csv');
  const hasResults = fs.existsSync(csvPath);
  return {
    id: sj.id,
    label: sj.label,
    queryPlace: sj.queryPlace,
    approxPopM: sj.approxPopM,
    stateCodes: sj.stateCodes,
    hasResults,
  };
});

fs.writeFileSync(out, JSON.stringify(catalog, null, 2));
const withResults = catalog.filter((s) => s.hasResults).length;
console.log(`Wrote docs/superjobs.json (${withResults}/${catalog.length} with contacts)`);

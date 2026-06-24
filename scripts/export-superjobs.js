#!/usr/bin/env node
/** Writes docs/superjobs.json for static superjob list (no API required). */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'superjobs.js');
if (!fs.existsSync(distPath)) {
  console.error('Run npm run build first.');
  process.exit(1);
}

const { SUPERJOBS } = require(distPath);
const out = path.join(__dirname, '..', 'docs', 'superjobs.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    SUPERJOBS.map((sj) => ({
      id: sj.id,
      label: sj.label,
      queryPlace: sj.queryPlace,
      approxPopM: sj.approxPopM,
      stateCodes: sj.stateCodes,
    })),
    null,
    2
  )
);
console.log('Wrote docs/superjobs.json');

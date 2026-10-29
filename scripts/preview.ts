import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// One page saved as one self-contained HTML file (ADR 0001, ADR 0003): a command, not a browser's
// "save as", so the preview is exactly what the route renders. Lands in var/ (gitignored) — a
// preview never goes into the repo.
const [night = '2026-10-28', out = 'var/preview/digest.html'] = process.argv.slice(2);

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`preview: /digest/${night} answered ${res.status}, nothing written`);
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`${out} · ${night} · ${process.env.LANE_MARKER ? 'marker set' : 'no marker set'}`);

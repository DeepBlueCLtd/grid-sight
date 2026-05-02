#!/usr/bin/env node
/**
 * Measure the gzipped size of dist/grid-sight.iife.js and log it.
 *
 * Bundle size is informational only — Grid-Sight typically runs on a LAN or
 * locally on a PC, so the bundle ceiling has been relaxed. The script reports
 * raw + gzipped size on every build for visibility but does not warn or fail.
 */

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE = path.resolve(__dirname, '..', 'dist', 'grid-sight.iife.js');

if (!fs.existsSync(BUNDLE)) {
  console.error(`bundle-size: ${BUNDLE} not found — run \`yarn build\` first.`);
  process.exit(2);
}

const raw = fs.readFileSync(BUNDLE);
const gz = gzipSync(raw);
const rawKB = (raw.length / 1024).toFixed(2);
const gzKB = (gz.length / 1024).toFixed(2);

console.log(`bundle-size: dist/grid-sight.iife.js  ${rawKB} kB raw  /  ${gzKB} kB gzipped`);

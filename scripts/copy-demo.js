#!/usr/bin/env node

/**
 * Copy `public/` (demo HTML, sample tables) into `dist/` after `vite build`.
 * The IIFE bundle is already emitted into `dist/grid-sight.iife.js` by Vite.
 *
 * Spec 001 dropped the Shepherd.js walkthrough — this script no longer copies
 * shepherd assets. If a future feature reintroduces a walkthrough, restore the
 * shepherd-copy block alongside it.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'public');
const targetDir = path.join(rootDir, 'dist');

async function copyDemoFiles() {
  await fs.ensureDir(targetDir);

  const files = await fs.readdir(sourceDir);
  for (const file of files) {
    const sourceFile = path.join(sourceDir, file);
    const targetFile = path.join(targetDir, file);
    await fs.copy(sourceFile, targetFile, {
      overwrite: true,
      preserveTimestamps: true,
    });
  }

  console.log(`✅ Copied demo files to ${targetDir}`);
}

copyDemoFiles().catch((err) => {
  console.error('❌ Error copying demo files:', err);
  process.exit(1);
});

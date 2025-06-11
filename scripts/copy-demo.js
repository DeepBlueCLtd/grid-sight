#!/usr/bin/env node

/**
 * Script to copy demo files from public/demo to dist/demo after build
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'public', 'demo');
const targetDir = path.join(rootDir, 'dist', 'demo');

async function copyDemoFiles() {
  try {
    // Ensure the target directory exists
    await fs.ensureDir(targetDir);
    
    // Copy all files from source to target
    await fs.copy(sourceDir, targetDir, {
      overwrite: true,
      preserveTimestamps: true,
    });
    
    console.log(`✅ Copied demo files to ${targetDir}`);
    
    // Update the script reference in the demo HTML to use the correct path
    const demoHtmlPath = path.join(targetDir, 'index.html');
    if (await fs.pathExists(demoHtmlPath)) {
      let content = await fs.readFile(demoHtmlPath, 'utf8');
      content = content.replace(
        /<script src="\.\.\/dist\/grid-sight\.min\.js"><\/script>/,
        '<script src="../grid-sight.min.js"></script>'
      );
      await fs.writeFile(demoHtmlPath, content, 'utf8');
      console.log('✅ Updated script paths in demo HTML');
    }
    
  } catch (error) {
    console.error('❌ Error copying demo files:', error);
    process.exit(1);
  }
}

// Run the copy function
copyDemoFiles();

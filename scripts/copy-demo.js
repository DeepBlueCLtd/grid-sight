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
const targetDir = path.join(rootDir, 'dist');

async function copyDemoFiles() {
  try {
    // Ensure the target directory exists
    await fs.ensureDir(targetDir);
    
    // Copy all files from source to target root
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
    
    // Update the script reference in the demo HTML to use the correct path
    const demoHtmlPath = path.join(targetDir, 'index.html');
    if (await fs.pathExists(demoHtmlPath)) {
      let content = await fs.readFile(demoHtmlPath, 'utf8');
      // Update the script path to point to the correct location in the dist folder
      content = content.replace(
        /<script src="[^"]*\/dist\/[^"]*\.js"><\/script>/,
        '<script src="grid-sight.iife.js"></script>'
      );
      // Also update any other relative paths if needed
      content = content.replace(
        /(href|src)="(\.\.?\/)?(assets|images|styles)/g,
        '$1="$3"'
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

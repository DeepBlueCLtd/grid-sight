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
const sourceDir = path.join(rootDir, 'public');
const targetDir = path.join(rootDir, 'dist');

async function copyDemoFiles() {
  try {
    // Ensure the target directory exists
    await fs.ensureDir(targetDir);
    
    // Copy Shepherd.js files to dist
    const shepherdDir = path.join(rootDir, 'node_modules', 'shepherd.js', 'dist');
    const targetShepherdDir = path.join(targetDir, 'shepherd.js', 'dist');
    await fs.ensureDir(targetShepherdDir);
    
    // Copy CSS directory
    const shepherdCssDir = path.join(shepherdDir, 'css');
    const targetShepherdCssDir = path.join(targetShepherdDir, 'css');
    await fs.ensureDir(targetShepherdCssDir);
    await fs.copy(shepherdCssDir, targetShepherdCssDir, {
      overwrite: true,
      preserveTimestamps: true,
    });
    
    // Copy ESM directory
    const shepherdEsmDir = path.join(shepherdDir, 'esm');
    const targetShepherdEsmDir = path.join(targetShepherdDir, 'esm');
    await fs.ensureDir(targetShepherdEsmDir);
    await fs.copy(shepherdEsmDir, targetShepherdEsmDir, {
      overwrite: true,
      preserveTimestamps: true,
    });
    
    console.log(`✅ Copied Shepherd.js files to ${targetShepherdDir}`);
    
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
      
      // Make sure Shepherd.js paths are correct
      content = content.replace(
        /<link rel="stylesheet" href="shepherd\.js\/dist\/css\/shepherd\.css"\/>\s*<script type="module" src="shepherd\.js\/dist\/shepherd\.mjs"><\/script>/,
        '<link rel="stylesheet" href="shepherd.js/dist/css/shepherd.css"/>\n  <script type="module" src="shepherd.js/dist/shepherd.mjs"></script>'
      );
      // Also update any other relative paths if needed
      content = content.replace(
        /(href|src)="(\.\.?\/)?(?!(http|shepherd))(assets|images|styles)/g,
        '$1="$4"'
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

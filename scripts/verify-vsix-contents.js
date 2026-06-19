// @ts-check
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FORBIDDEN = [
  /\.vsix$/i,
  /\.zip$/i,
  /__MACOSX/i,
  /\.DS_Store/i,
  /^src\//i,
  /^test\//i,
  /^tests\//i,
  /\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /^\.claude\//i,
  /^\.gemini\//i,
  /^CLAUDE\.md$/i,
  /^GEMINI\.md$/i,
  /^agents\.md$/i,
  /\.map$/i,
  /npm-debug\.log/i,
  /yarn-debug\.log/i,
  /yarn-error\.log/i,
  /^coverage\//i,
  /\.log$/i,
  /private[_\-]?key/i,
  /secret[_\-]?key/i,
];

/**
 * Get the list of files from a .vsix archive or via `vsce ls`.
 * @param {string | undefined} vsixPath
 * @returns {string[]}
 */
function getFileList(vsixPath) {
  if (vsixPath) {
    const resolved = path.resolve(vsixPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    // A .vsix is a ZIP archive — use `unzip -Z1` to list entries
    try {
      const output = execSync(`unzip -Z1 "${resolved}"`, { encoding: 'utf8' });
      return output.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    } catch (err) {
      console.error('Failed to list VSIX contents. Is `unzip` available?');
      console.error(err.message);
      process.exit(1);
    }
  }

  // No path given — use vsce ls to check the current project
  // --skip-vscode-prepublish avoids triggering the build step during listing
  try {
    const output = execSync('npx @vscode/vsce ls', { encoding: 'utf8' });
    return output.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  } catch (err) {
    console.error('Failed to run vsce ls. Is @vscode/vsce installed?');
    console.error(err.message);
    process.exit(1);
  }
}

const vsixArg = process.argv[2];
const files = getFileList(vsixArg);

const bad = files.filter(file => FORBIDDEN.some(pattern => pattern.test(file)));

if (bad.length) {
  console.error('Forbidden files found in VSIX package:');
  for (const file of bad) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log(`Checked ${files.length} file(s). VSIX package contents look clean.`);

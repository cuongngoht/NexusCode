// @ts-check
'use strict';

const { execSync } = require('child_process');

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
];

let output;
try {
  output = execSync('npx vsce ls', { encoding: 'utf8' });
} catch (err) {
  console.error('Failed to run vsce ls. Is @vscode/vsce installed?');
  console.error(err.message);
  process.exit(1);
}

const bad = output
  .split(/\r?\n/)
  .map(x => x.trim())
  .filter(Boolean)
  .filter(file => FORBIDDEN.some(pattern => pattern.test(file)));

if (bad.length) {
  console.error('Forbidden files found in VSIX package:');
  for (const file of bad) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('VSIX package contents look clean.');

const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');
const includeCli = process.argv.includes('--cli');

const sharedOptions = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'warning',
  external: ['vscode'],
};

const extensionEntry = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
};

const cliEntry = {
  ...sharedOptions,
  entryPoints: ['src/cli/index.ts'],
  outfile: 'out/cli/index.js',
};

async function main() {
  const entries = [extensionEntry];
  if (includeCli) entries.push(cliEntry);

  if (watch) {
    const contexts = await Promise.all(entries.map(e => esbuild.context(e)));
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('[esbuild] watching...');
  } else {
    await Promise.all(entries.map(e => esbuild.build(e)));
    console.log('[esbuild] build complete');
  }
}

main().catch(err => {
  process.stderr.write(err.message + '\n');
  process.exit(1);
});

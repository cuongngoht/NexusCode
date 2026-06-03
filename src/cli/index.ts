#!/usr/bin/env node

import { Command } from 'commander';
import { mapCommand } from './commands/mapCommand';

const program = new Command();

program
  .name('nexus')
  .description('Nexus CLI — project understanding engine')
  .version('0.1.0');

program
  .command('map')
  .description('Build Nexus project map')
  .option('--root <path>', 'Workspace root', process.cwd())
  .option('--json', 'Output JSON')
  .option('--max-depth <number>', 'Max scan depth', '8')
  .option('--max-files <number>', 'Max files', '5000')
  .action(mapCommand);

program.parse();

#!/usr/bin/env node

import { Command } from 'commander';
import { mapCommand } from './commands/mapCommand';
import { runCommand } from './commands/runCommand';

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

program
  .command('run')
  .description('Run a task with Nexus orchestrator')
  .requiredOption('--prompt <text>', 'User prompt')
  .option('--root <path>', 'Workspace root', process.cwd())
  .option('--mode <mode>', 'Task mode (ask|edit|debug|test|review|research|plan|brainstorm|scan-project)', 'edit')
  .option('--provider <id>', 'Provider override (nexus|claude|codex|...)', 'nexus')
  .option('--stage <stage>', 'Force stage (auto|search|plan|code)', 'auto')
  .option('--plan <path>', 'Plan file path for code stage')
  .option('--base-branch <branch>', 'Base branch for review mode')
  .option('--model <model>', 'Model override')
  .action(runCommand);

program.parse();

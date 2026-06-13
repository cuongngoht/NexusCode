#!/usr/bin/env node

import { Command } from 'commander';
import { mapCommand } from './commands/mapCommand';
import { runCommand } from './commands/runCommand';
import { modelCommand } from './commands/modelCommand';
import { doctorCommand } from './commands/doctorCommand';
import { providerCommand } from './commands/providerCommand';

const program = new Command();

program
  .name('nexus')
  .description('Nexus CLI — project understanding engine')
  .version('1.0.0-beta');

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
  .option('--provider <id>', 'Provider override (nexus|claude|codex|grok+claude|...)', 'nexus')
  .option('--stage <stage>', 'Force stage (auto|search|plan|code)', 'auto')
  .option('--plan <path>', 'Plan file path for code stage')
  .option('--base-branch <branch>', 'Base branch for review mode')
  .option('--model <model>', 'Model override')
  .option('--auto-approve', 'Automatically approve plan and run code stage without pausing')
  .action(runCommand);

program
  .command('model')
  .description('Manage provider models')
  .argument('[action]', 'Action: list|refresh', 'list')
  .argument('[provider]', 'Provider id')
  .option('--json', 'Output JSON')
  .action(modelCommand);

program
  .command('doctor')
  .description('Check Nexus provider health')
  .option('--fix', 'Attempt to install missing provider CLIs')
  .option('--provider <id>', 'Check only one provider')
  .option('--json', 'Output JSON')
  .option('-y, --yes', 'Skip confirmation for low/medium risk installs')
  .action(doctorCommand);

program
  .command('provider')
  .description('Manage Nexus providers')
  .argument('[action]', 'Action: list|status|install|new', 'list')
  .argument('[target]', 'Provider id or name')
  .option('--json', 'Output JSON')
  .action(providerCommand);

program.parse();

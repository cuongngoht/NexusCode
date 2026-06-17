import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONSOLE_STATE, type NexusConsoleState } from './NexusConsoleState';
import { printConsoleBanner } from './NexusConsoleBanner';
import { handleConsoleCommand } from './NexusConsoleCommands';
import { runConsolePrompt } from './NexusConsolePromptRunner';
import { normalizeProviderRoute } from '../../application/prompt/ProviderAliasResolver';
import { readNexusConsoleLine } from './NexusConsoleInput';
import { ensureWorkspaceAgents } from '../../context/agentPromptLibrary';
import { ensureWorkspaceSkills } from '../../context/skillPromptLibrary';
import { ensureWorkspaceCommands } from '../../context/commandPromptLibrary';

export interface StartNexusConsoleOptions {
  root?: string;
  provider?: string;
  mode?: string;
  stage?: string;
  model?: string;
}

function findExtensionRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, 'media'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..', '..');
}

function ensureConsolePromptReferences(workspaceRoot: string): void {
  const extensionRoot = findExtensionRoot(__dirname);
  ensureWorkspaceAgents(workspaceRoot, extensionRoot);
  ensureWorkspaceSkills(workspaceRoot, extensionRoot);
  ensureWorkspaceCommands(workspaceRoot, extensionRoot);
}

export async function startNexusConsole(options: StartNexusConsoleOptions = {}): Promise<void> {
  const workspaceRoot = path.resolve(options.root ?? process.cwd());
  ensureConsolePromptReferences(workspaceRoot);

  const state: NexusConsoleState = {
    ...DEFAULT_CONSOLE_STATE,
    workspaceRoot,
    providerRoute: options.provider
      ? normalizeProviderRoute(options.provider)
      : DEFAULT_CONSOLE_STATE.providerRoute,
    mode: options.mode ?? DEFAULT_CONSOLE_STATE.mode,
    stage: options.stage ?? DEFAULT_CONSOLE_STATE.stage,
    model: options.model,
  };

  printConsoleBanner(state);

  while (true) {
    const line = await readNexusConsoleLine(state, 'nexus> ');
    if (line === undefined) {
      break;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Handle built-in slash commands
    if (trimmed.startsWith('/')) {
      const result = await handleConsoleCommand(trimmed, state);
      if (result.shouldExit) {
        process.stdout.write('Goodbye.\n');
        break;
      }
      if (result.handled) continue;
      // Falls through to prompt runner if not handled (unknown slash command treated as prompt)
    }

    await runConsolePrompt(trimmed, state);
  }
}

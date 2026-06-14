import * as readline from 'readline';
import * as path from 'path';
import { DEFAULT_CONSOLE_STATE, type NexusConsoleState } from './NexusConsoleState';
import { printConsoleBanner } from './NexusConsoleBanner';
import { handleConsoleCommand } from './NexusConsoleCommands';
import { runConsolePrompt } from './NexusConsolePromptRunner';
import { normalizeProviderRoute } from '../../application/prompt/ProviderAliasResolver';
import { createNexusConsoleCompleter } from './NexusConsoleCompleter';

export interface StartNexusConsoleOptions {
  root?: string;
  provider?: string;
  mode?: string;
  stage?: string;
  model?: string;
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    rl.question(prompt, resolve);
    rl.once('close', () => reject(new Error('EOF')));
  });
}

export async function startNexusConsole(options: StartNexusConsoleOptions = {}): Promise<void> {
  const workspaceRoot = path.resolve(options.root ?? process.cwd());

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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: createNexusConsoleCompleter(state),
  });

  try {
    while (true) {
      let line: string;
      try {
        line = await question(rl, 'nexus> ');
      } catch {
        // EOF / Ctrl+D
        process.stdout.write('\n');
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
  } finally {
    rl.close();
  }
}

import type { NexusConsoleState } from './NexusConsoleState';
import { normalizeProviderRoute, displayProviderRoute } from '../../application/prompt/ProviderAliasResolver';
import { printConsoleModels } from './NexusConsoleModelScanner';
import { listAgentPrompts } from '../../context/agentPromptLibrary';
import { listSkillPrompts } from '../../context/skillPromptLibrary';
import { listCommandDefs } from '../../context/commandPromptLibrary';

export interface ConsoleCommandResult {
  handled: boolean;
  shouldExit?: boolean;
}

const BUILTIN_COMMANDS = new Set([
  'help', 'exit', 'quit', 'clear', 'status',
  'provider', 'model', 'reload', 'agents', 'skills', 'commands',
]);

function printHelp(): void {
  process.stdout.write(`
Nexus Console — built-in commands:

  /help                     Show this help
  /status                   Show current session state
  /provider                 Show current provider route
  /provider <route>         Set provider route (e.g. agy+grok, claude)
  /model [provider]         List models for a provider (or all)
  /model refresh [provider] Refresh model list
  /agents                   List available agents (.nexus/agents/)
  /skills                   List available skills (.nexus/skills/)
  /commands                 List available commands (.nexus/commands/)
  /clear                    Clear the terminal
  /exit, /quit              Exit Nexus Console

Inline syntax in prompts:
  @agent-id                 Load agent persona from .nexus/agents/<id>.md
  #skill-id                 Load skill from .nexus/skills/<id>.md
  /command-id               Load command from .nexus/commands/<id>.md

`);
}

export async function handleConsoleCommand(
  line: string,
  state: NexusConsoleState,
): Promise<ConsoleCommandResult> {
  const trimmed = line.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? '';

  if (!BUILTIN_COMMANDS.has(cmd)) {
    return { handled: false };
  }

  switch (cmd) {
    case 'exit':
    case 'quit':
      return { handled: true, shouldExit: true };

    case 'clear':
      process.stdout.write('\x1Bc');
      return { handled: true };

    case 'help':
      printHelp();
      return { handled: true };

    case 'status': {
      process.stdout.write(`\nNexus Console Status:\n`);
      process.stdout.write(`  Workspace:  ${state.workspaceRoot}\n`);
      process.stdout.write(`  Route:      ${displayProviderRoute(state.providerRoute)}\n`);
      process.stdout.write(`  Mode:       ${state.mode}\n`);
      process.stdout.write(`  Stage:      ${state.stage}\n`);
      if (state.model) {
        process.stdout.write(`  Model:      ${state.model}\n`);
      }
      process.stdout.write(`  AutoApprove: ${state.autoApprove ? 'yes' : 'no'}\n`);
      process.stdout.write('\n');
      return { handled: true };
    }

    case 'provider': {
      const routeArg = parts.slice(1).join('+').trim();
      if (!routeArg) {
        process.stdout.write(`Current route: ${displayProviderRoute(state.providerRoute)}\n`);
      } else {
        state.providerRoute = normalizeProviderRoute(routeArg);
        process.stdout.write(`Provider route set to: ${displayProviderRoute(state.providerRoute)}\n`);
      }
      return { handled: true };
    }

    case 'model': {
      // /model refresh [provider]  OR  /model [provider]
      let force = false;
      let providerArg: string | undefined;

      if (parts[1]?.toLowerCase() === 'refresh') {
        force = true;
        providerArg = parts[2];
      } else {
        providerArg = parts[1];
      }

      await printConsoleModels(providerArg, force);
      return { handled: true };
    }

    case 'reload': {
      process.stdout.write('Reload not applicable in console mode. Use /provider or /model refresh instead.\n');
      return { handled: true };
    }

    case 'agents': {
      const agents = listAgentPrompts(state.workspaceRoot);
      if (agents.length === 0) {
        process.stdout.write('No agents found in .nexus/agents/\n');
      } else {
        process.stdout.write('\nAvailable agents:\n');
        for (const agent of agents) {
          process.stdout.write(`  @${agent.id}  —  ${agent.displayName}\n`);
        }
        process.stdout.write('\n');
      }
      return { handled: true };
    }

    case 'skills': {
      const skills = listSkillPrompts(state.workspaceRoot);
      if (skills.length === 0) {
        process.stdout.write('No skills found in .nexus/skills/\n');
      } else {
        process.stdout.write('\nAvailable skills:\n');
        for (const skill of skills) {
          process.stdout.write(`  #${skill.id}  —  ${skill.displayName}\n`);
        }
        process.stdout.write('\n');
      }
      return { handled: true };
    }

    case 'commands': {
      const commands = listCommandDefs(state.workspaceRoot);
      if (commands.length === 0) {
        process.stdout.write('No commands found in .nexus/commands/\n');
      } else {
        process.stdout.write('\nAvailable commands:\n');
        for (const command of commands) {
          const desc = command.description ? `  —  ${command.description}` : '';
          process.stdout.write(`  /${command.id}${desc}\n`);
        }
        process.stdout.write('\n');
      }
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

import { listAgentPrompts } from '../../context/agentPromptLibrary';
import { listSkillPrompts } from '../../context/skillPromptLibrary';
import { listCommandDefs } from '../../context/commandPromptLibrary';
import type { NexusConsoleState } from './NexusConsoleState';

const BUILTIN_COMMANDS = [
  '/help', '/exit', '/quit', '/clear', '/status',
  '/provider', '/model', '/reload', '/agents', '/skills', '/commands',
];

function filterCompletions(token: string, candidates: string[]): [string[], string] {
  const hits = candidates.filter(c => c.startsWith(token));
  return [hits.length > 0 ? hits : [], token];
}

export function createNexusConsoleCompleter(
  state: NexusConsoleState,
): (line: string) => [string[], string] {
  return function completer(line: string): [string[], string] {
    // Complete only the last whitespace-separated token
    const lastSpace = line.lastIndexOf(' ');
    const token = lastSpace === -1 ? line : line.slice(lastSpace + 1);

    if (token.startsWith('@')) {
      try {
        const agents = listAgentPrompts(state.workspaceRoot).map(a => `@${a.id}`);
        return filterCompletions(token, agents);
      } catch {
        return [[], token];
      }
    }

    if (token.startsWith('#')) {
      try {
        const skills = listSkillPrompts(state.workspaceRoot).map(s => `#${s.id}`);
        return filterCompletions(token, skills);
      } catch {
        return [[], token];
      }
    }

    if (token.startsWith('/')) {
      try {
        const commands = listCommandDefs(state.workspaceRoot).map(c => `/${c.id}`);
        return filterCompletions(token, [...BUILTIN_COMMANDS, ...commands]);
      } catch {
        return filterCompletions(token, BUILTIN_COMMANDS);
      }
    }

    return [[], line];
  };
}

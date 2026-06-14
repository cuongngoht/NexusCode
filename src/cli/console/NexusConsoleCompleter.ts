import { listAgentPrompts } from '../../context/agentPromptLibrary';
import { listSkillPrompts } from '../../context/skillPromptLibrary';
import { listCommandDefs } from '../../context/commandPromptLibrary';
import { filterPromptReferenceCandidates, type PromptReferenceCandidate } from '../../context/promptReferenceCompletion';
import type { NexusConsoleState } from './NexusConsoleState';

export interface NexusConsoleSuggestion {
  token: string;
  id: string;
  label: string;
  kind: 'agent' | 'skill' | 'command';
}

export interface NexusConsoleSuggestionContext {
  token: string;
  tokenStart: number;
  tokenEnd: number;
  suggestions: NexusConsoleSuggestion[];
}

export const BUILTIN_COMMANDS: PromptReferenceCandidate[] = [
  { id: 'help', description: 'Show help' },
  { id: 'exit', description: 'Exit Nexus Console' },
  { id: 'quit', description: 'Exit Nexus Console' },
  { id: 'clear', description: 'Clear the terminal' },
  { id: 'status', description: 'Show current session state' },
  { id: 'provider', description: 'Show or set provider route' },
  { id: 'model', description: 'List or refresh provider models' },
  { id: 'reload', description: 'Reload console state' },
  { id: 'agents', description: 'List project agents' },
  { id: 'skills', description: 'List project skills' },
  { id: 'commands', description: 'List project commands' },
];

function currentToken(line: string, cursor = line.length): { token: string; start: number; end: number } {
  const safeCursor = Math.max(0, Math.min(cursor, line.length));
  let start = safeCursor;
  while (start > 0 && !/\s/.test(line[start - 1] ?? '')) start--;

  let end = safeCursor;
  while (end < line.length && !/\s/.test(line[end] ?? '')) end++;

  return { token: line.slice(start, end), start, end };
}

function suggestionContext(
  token: string,
  tokenStart: number,
  tokenEnd: number,
  prefix: '@' | '#' | '/',
  kind: NexusConsoleSuggestion['kind'],
  candidates: readonly PromptReferenceCandidate[],
): NexusConsoleSuggestionContext {
  const query = token.slice(prefix.length);
  const suggestions = filterPromptReferenceCandidates(candidates, query, 20)
    .map((candidate): NexusConsoleSuggestion => ({
      token: `${prefix}${candidate.id}`,
      id: candidate.id,
      label: candidate.title || candidate.description || candidate.id,
      kind,
    }));

  return { token, tokenStart, tokenEnd, suggestions };
}

export function getNexusConsoleSuggestionContext(
  state: NexusConsoleState,
  line: string,
  cursor = line.length,
): NexusConsoleSuggestionContext | undefined {
  const { token, start, end } = currentToken(line, cursor);
  if (token.length === 0) return undefined;

  if (token.startsWith('@')) {
    try {
      const agents = listAgentPrompts(state.workspaceRoot).map(agent => ({
        id: agent.id,
        title: agent.displayName,
        description: agent.fileName,
      }));
      return suggestionContext(token, start, end, '@', 'agent', agents);
    } catch {
      return undefined;
    }
  }

  if (token.startsWith('#')) {
    try {
      const skills = listSkillPrompts(state.workspaceRoot).map(skill => ({
        id: skill.id,
        title: skill.displayName,
        description: skill.fileName,
      }));
      return suggestionContext(token, start, end, '#', 'skill', skills);
    } catch {
      return undefined;
    }
  }

  if (token.startsWith('/')) {
    try {
      const commands = listCommandDefs(state.workspaceRoot).map(command => ({
        id: command.id,
        title: command.description,
        description: command.promptTemplate,
      }));
      return suggestionContext(token, start, end, '/', 'command', [...BUILTIN_COMMANDS, ...commands]);
    } catch {
      return suggestionContext(token, start, end, '/', 'command', BUILTIN_COMMANDS);
    }
  }

  return undefined;
}

function prefixedCompletions(
  token: string,
  prefix: '@' | '#' | '/',
  candidates: readonly PromptReferenceCandidate[],
): [string[], string] {
  const query = token.slice(prefix.length);
  const hits = filterPromptReferenceCandidates(candidates, query, 20)
    .map(candidate => `${prefix}${candidate.id}`);
  return [hits, token];
}

export function createNexusConsoleCompleter(
  state: NexusConsoleState,
): (line: string) => [string[], string] {
  return function completer(line: string): [string[], string] {
    const ctx = getNexusConsoleSuggestionContext(state, line);
    if (!ctx) return [[], line];
    const prefix = ctx.token[0] as '@' | '#' | '/';
    const candidates = ctx.suggestions.map(suggestion => ({
      id: suggestion.id,
      title: suggestion.label,
    }));
    return prefixedCompletions(ctx.token, prefix, candidates);
  };
}

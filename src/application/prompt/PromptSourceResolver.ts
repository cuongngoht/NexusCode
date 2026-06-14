import { loadCommandPromptMarkdown } from '../../context/commandPromptLibrary';
import { loadSkillPromptMarkdown } from '../../context/skillPromptLibrary';
import { loadAgentPromptMarkdown } from '../../context/agentPromptLibrary';

export interface ResolvedPromptSource {
  id: string;
  content: string;
}

export interface ResolvedPromptSources {
  commands: ResolvedPromptSource[];
  skills: ResolvedPromptSource[];
  agents: ResolvedPromptSource[];
}

export function resolvePromptSources(
  workspaceRoot: string,
  input: { commandIds: string[]; skillIds: string[]; agentIds: string[] },
): ResolvedPromptSources {
  const commands: ResolvedPromptSource[] = [];
  for (const id of input.commandIds) {
    const content = loadCommandPromptMarkdown(workspaceRoot, id);
    if (content === undefined) {
      throw new Error(`Unknown command: ${id}`);
    }
    commands.push({ id, content });
  }

  const skills: ResolvedPromptSource[] = [];
  for (const id of input.skillIds) {
    const content = loadSkillPromptMarkdown(workspaceRoot, id);
    if (content === undefined) {
      throw new Error(`Unknown skill: ${id}`);
    }
    skills.push({ id, content });
  }

  const agents: ResolvedPromptSource[] = [];
  for (const id of input.agentIds) {
    const content = loadAgentPromptMarkdown(workspaceRoot, id);
    if (content === undefined) {
      throw new Error(`Unknown agent: ${id}`);
    }
    agents.push({ id, content });
  }

  return { commands, skills, agents };
}

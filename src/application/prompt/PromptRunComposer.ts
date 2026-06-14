import type { ResolvedPromptSources } from './PromptSourceResolver';

export class PromptRunComposer {
  compose(sources: ResolvedPromptSources, userPrompt: string): string {
    const sections: string[] = [];

    if (sources.commands.length > 0) {
      sections.push('# Nexus Commands');
      sections.push('');
      for (const cmd of sources.commands) {
        sections.push(`## /${cmd.id}`);
        sections.push('');
        sections.push(cmd.content.trim());
        sections.push('');
        sections.push('---');
        sections.push('');
      }
    }

    if (sources.skills.length > 0) {
      sections.push('# Nexus Skills');
      sections.push('');
      for (const skill of sources.skills) {
        sections.push(`## #${skill.id}`);
        sections.push('');
        sections.push(skill.content.trim());
        sections.push('');
        sections.push('---');
        sections.push('');
      }
    }

    if (sources.agents.length > 0) {
      sections.push('# Nexus Agents');
      sections.push('');
      for (const agent of sources.agents) {
        sections.push(`## @${agent.id}`);
        sections.push('');
        sections.push(agent.content.trim());
        sections.push('');
        sections.push('---');
        sections.push('');
      }
    }

    sections.push('# User Task');
    sections.push('');
    sections.push(userPrompt.trim());

    return sections.join('\n');
  }
}

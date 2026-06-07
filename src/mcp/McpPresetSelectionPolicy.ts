import type { TaskMode } from '../core/types';
import type { McpPreset, McpToolIntent } from './McpTypes';

export interface IMcpPresetSelectionPolicy {
  select(input: {
    prompt: string;
    mode: TaskMode;
    intent: McpToolIntent;
    enabledPresets: McpPreset[];
  }): McpPreset | undefined;
}

export class McpPresetSelectionPolicy implements IMcpPresetSelectionPolicy {
  select(input: {
    prompt: string;
    mode: TaskMode;
    intent: McpToolIntent;
    enabledPresets: McpPreset[];
  }): McpPreset | undefined {
    const text = `${input.prompt} ${input.intent.query}`.toLowerCase();

    const candidates = input.enabledPresets
      .filter(preset => preset.toolGroups.includes(input.intent.group))
      .map(preset => ({
        preset,
        score: this.scorePreset(preset, text, input.mode),
      }))
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.preset;
  }

  private scorePreset(preset: McpPreset, text: string, mode: TaskMode): number {
    let score = preset.priority;

    for (const keyword of preset.bestFor) {
      if (text.includes(keyword.toLowerCase())) {
        score += 30;
      }
    }

    if (text.includes('official') && preset.id === 'microsoftLearn') {
      score += 15;
    }

    if (
      text.includes('azure') ||
      text.includes('vscode') ||
      text.includes('visual studio code') ||
      text.includes('.net') ||
      text.includes('c#') ||
      text.includes('microsoft')
    ) {
      if (preset.id === 'microsoftLearn') score += 25;
    }

    if (
      text.includes('version') ||
      text.includes('package') ||
      text.includes('library') ||
      text.includes('npm') ||
      text.includes('api')
    ) {
      if (preset.id === 'context7') score += 20;
    }

    if (mode === 'research' || mode === 'plan' || mode === 'debug') {
      score += 5;
    }

    return score;
  }
}

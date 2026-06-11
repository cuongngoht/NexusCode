import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import {
  ensureWorkspaceSkills,
  listSkillPrompts,
  type SkillPrompt,
} from '../../context/skillPromptLibrary';
import { requireWorkspaceRoot } from './workspaceUtils';

export class SkillPromptHandler {
  constructor(
    private readonly extensionRoot: string,
    private readonly post: (msg: ExtensionMessage) => void,
  ) {}

  async sendSkillPrompts(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const cfg = vscode.workspace.getConfiguration('nexus');
      if (!cfg.get<boolean>('skills.enabled', true)) {
        this.post({ type: 'skillPrompts', skills: [] });
        return;
      }
      if (cfg.get<boolean>('skills.autoCopyDefaults', true)) {
        ensureWorkspaceSkills(workspaceRoot, this.extensionRoot);
      }
      const skills = listSkillPrompts(workspaceRoot);
      this.post({ type: 'skillPrompts', skills });
    } catch (err) {
      this.post({ type: 'skillPromptError', message: String(err) });
    }
  }

  async reload(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const skills = listSkillPrompts(workspaceRoot);
      this.post({ type: 'skillsReloaded', count: skills.length, skills });
    } catch (err) {
      this.post({ type: 'skillPromptError', message: String(err) });
    }
  }

  listKnownIds(): string[] {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return [];
    try {
      return listSkillPrompts(workspaceRoot).map((s: SkillPrompt) => s.id);
    } catch {
      return [];
    }
  }
}

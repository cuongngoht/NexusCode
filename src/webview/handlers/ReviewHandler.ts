import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { requireWorkspaceRoot } from './workspaceUtils';

const SAVED_REVIEW_BASE_KEY = 'nexus.lastReviewBase';

const ARCHITECTURE_POLICY_TEMPLATE = `# Architecture Policy

> Edit this file to customize the architecture review for this project.
> It is read automatically when running a Code Review in Nexus.

## Layer Rules

- Domain layer (\`src/core/\`) must have zero external imports
- Application layer imports Domain only
- Infrastructure layer imports Domain + Node.js
- Interface layer may import all layers

## Design Principles

- Prefer composition over inheritance
- Avoid circular dependencies
- Interfaces in Domain, implementations in Infrastructure

## Project-Specific Rules

<!-- Add your project-specific architecture rules here -->
`;

function ensureArchitecturePolicy(workspaceRoot: string): string {
  const filePath = path.join(workspaceRoot, '.nexus', 'architecture-policy.md');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, ARCHITECTURE_POLICY_TEMPLATE, 'utf8');
  }
  return filePath;
}

export class ReviewHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly workspaceState?: vscode.Memento,
  ) {}

  async getContext(baseBranch?: string): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'reviewContextError');
    if (!workspaceRoot) return;
    try {
      const resolved = baseBranch ?? this.workspaceState?.get<string>(SAVED_REVIEW_BASE_KEY);
      const diffCharLimit = vscode.workspace.getConfiguration('nexus').get<number>('review.maxDiffChars', 60000);
      const context = buildGitReviewContext(workspaceRoot, resolved, diffCharLimit);
      if (context.baseBranch) {
        await this.workspaceState?.update(SAVED_REVIEW_BASE_KEY, context.baseBranch);
      }
      this.post({ type: 'reviewContext', context });
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }

  async openAgentFile(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'reviewContextError');
    if (!workspaceRoot) return;
    try {
      const filePath = ensureArchitecturePolicy(workspaceRoot);
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    } catch (err) {
      this.post({ type: 'reviewContextError', message: String(err) });
    }
  }
}

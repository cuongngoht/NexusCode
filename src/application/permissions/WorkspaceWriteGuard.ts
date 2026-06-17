import * as vscode from 'vscode';
import type { PermissionSubjectType } from './PermissionTypes';
import { PermissionService } from './PermissionService';
import { createPermissionId } from './createPermissionId';
import { PermissionRiskClassifier } from './PermissionRiskClassifier';

const classifier = new PermissionRiskClassifier();

function buildDiffPreview(previous: string, next: string): string {
  if (!previous) {
    const lines = next.split('\n').slice(0, 20);
    return lines.map(l => `+ ${l}`).join('\n');
  }
  // Simple line-based diff preview (truncated)
  const prevLines = previous.split('\n');
  const nextLines = next.split('\n');
  const preview: string[] = [];
  const maxLines = 30;
  let count = 0;

  for (let i = 0; i < Math.max(prevLines.length, nextLines.length) && count < maxLines; i++) {
    const a = prevLines[i] ?? '';
    const b = nextLines[i] ?? '';
    if (a !== b) {
      if (a) { preview.push(`- ${a}`); count++; }
      if (b) { preview.push(`+ ${b}`); count++; }
    }
  }

  if (count >= maxLines) {
    preview.push('... (truncated)');
  }

  return preview.join('\n');
}

export interface WriteFileInput {
  sessionId?: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectLabel: string;
  path: string;
  content: string;
  previousContent?: string;
  reason: string;
}

export class WorkspaceWriteGuard {
  constructor(private readonly permissionService: PermissionService) {}

  async writeFile(input: WriteFileInput): Promise<void> {
    const diffPreview = buildDiffPreview(input.previousContent ?? '', input.content);
    const risk = classifier.classifyFileWrite(input.path, diffPreview);

    const resolution = await this.permissionService.request({
      id: createPermissionId(),
      sessionId: input.sessionId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectLabel: input.subjectLabel,
      actionType: 'file.write',
      risk,
      title: `${input.subjectLabel} wants to write ${input.path}`,
      reason: input.reason,
      target: input.path,
      diffPreview,
      createdAt: Date.now(),
    });

    if (resolution.decision !== 'approved' && resolution.decision !== 'auto_approved') {
      throw new Error(`File write rejected: ${input.path}`);
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(input.path),
      Buffer.from(input.content, 'utf8'),
    );
  }
}

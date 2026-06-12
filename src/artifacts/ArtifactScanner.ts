import * as path from 'path';
import * as fs from 'fs';
import type { ArtifactRef, ArtifactKind } from './ArtifactTypes';

function kindFromPath(filePath: string): ArtifactKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md') return 'markdown';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return 'image';
  if (ext === '.json') return 'json';
  if (['.patch', '.diff'].includes(ext)) return 'patch';
  if (ext === '.log') return 'log';
  if (['.html', '.htm'].includes(ext)) return 'html';
  return 'file';
}

function idFromPath(filePath: string): string {
  return `artifact-${Buffer.from(filePath).toString('base64').slice(0, 24)}`;
}

export class ArtifactScanner {
  async scan(workspaceRoot: string): Promise<ArtifactRef[]> {
    const results: ArtifactRef[] = [];

    // Scan .nexus/artifacts
    const artifactDir = path.join(workspaceRoot, '.nexus', 'artifacts');
    if (fs.existsSync(artifactDir)) {
      try {
        const files = fs.readdirSync(artifactDir);
        for (const file of files) {
          const filePath = path.join(artifactDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            results.push({
              id: idFromPath(filePath),
              kind: kindFromPath(filePath),
              title: file,
              path: path.relative(workspaceRoot, filePath),
              sizeBytes: stat.size,
              createdAt: stat.birthtimeMs,
              updatedAt: stat.mtimeMs,
              previewable: true,
            });
          }
        }
      } catch { /* ignore */ }
    }

    // Scan .nexus/plans
    const planDir = path.join(workspaceRoot, '.nexus', 'plans');
    if (fs.existsSync(planDir)) {
      try {
        const files = fs.readdirSync(planDir);
        for (const file of files.filter(f => f.endsWith('.md'))) {
          const filePath = path.join(planDir, file);
          const stat = fs.statSync(filePath);
          results.push({
            id: idFromPath(filePath),
            kind: 'plan',
            title: file,
            path: path.relative(workspaceRoot, filePath),
            sizeBytes: stat.size,
            createdAt: stat.birthtimeMs,
            updatedAt: stat.mtimeMs,
            previewable: true,
            tags: ['plan'],
          });
        }
      } catch { /* ignore */ }
    }

    return results;
  }

  fromPlanSaved(taskId: string, planPath?: string, conversationId?: string): ArtifactRef {
    const filename = planPath ? path.basename(planPath) : 'plan.md';
    return {
      id: `plan-${taskId}`,
      kind: 'plan',
      title: filename,
      path: planPath,
      createdAt: Date.now(),
      previewable: true,
      sourceTaskId: taskId,
      sourceConversationId: conversationId,
      tags: ['plan'],
    };
  }
}

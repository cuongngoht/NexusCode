import * as fs from 'fs';
import * as path from 'path';

const BUNDLED_TEMPLATE_REL = path.join('media', 'agents', 'code-review.md');

function readBundledTemplate(extensionPath: string): string | undefined {
  try {
    return fs.readFileSync(path.join(extensionPath, BUNDLED_TEMPLATE_REL), 'utf8');
  } catch {
    return undefined;
  }
}

export function getReviewAgentPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'agents', 'code-review.md');
}

export function ensureReviewAgentMarkdown(workspaceRoot: string, extensionPath: string): string {
  const filePath = getReviewAgentPath(workspaceRoot);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    const template = readBundledTemplate(extensionPath) ?? '';
    fs.writeFileSync(filePath, template, 'utf8');
  }

  return filePath;
}

export function loadReviewAgentMarkdown(workspaceRoot: string, extensionPath: string): string {
  try {
    const filePath = ensureReviewAgentMarkdown(workspaceRoot, extensionPath);
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return readBundledTemplate(extensionPath) ?? '';
  }
}

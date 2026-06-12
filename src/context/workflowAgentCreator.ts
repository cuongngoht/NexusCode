import * as fs from 'fs';
import * as path from 'path';

const SAFE_AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const TEMPLATE_DIR = path.join('media', 'workflow-agent-template');

export interface CreateWorkflowAgentInput {
  workspaceRoot: string;
  selectedFolderPath: string;
  rawName: string;
  extensionRoot: string;
}

export interface CreateWorkflowAgentResult {
  agentId: string;
  filePath: string;
  alreadyExists: boolean;
}

export function getExpectedWorkspaceAgentsDir(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, '.nexus', 'agents');
}

export function isWorkspaceAgentsDir(workspaceRoot: string, selectedPath: string): boolean {
  const expected = getExpectedWorkspaceAgentsDir(workspaceRoot);
  const actual = path.resolve(selectedPath);
  return actual === expected;
}

export function normalizeAgentId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function toDisplayName(agentId: string): string {
  return agentId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function applyVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function copyTemplate(templateDir: string, fileName: string, destPath: string, vars: Record<string, string>): void {
  const srcPath = path.join(templateDir, fileName);
  const content = applyVars(fs.readFileSync(srcPath, 'utf8'), vars);
  fs.writeFileSync(destPath, content, 'utf8');
}

export function createWorkflowAgentFile(input: CreateWorkflowAgentInput): CreateWorkflowAgentResult {
  if (!isWorkspaceAgentsDir(input.workspaceRoot, input.selectedFolderPath)) {
    throw new Error('Workflow agents can only be created inside .nexus/agents.');
  }

  const agentId = normalizeAgentId(input.rawName);

  if (!agentId || !SAFE_AGENT_ID_RE.test(agentId)) {
    throw new Error('Invalid workflow agent name.');
  }

  const agentDir = path.join(input.selectedFolderPath, agentId);
  const filePath = path.join(agentDir, 'index.md');

  if (fs.existsSync(agentDir)) {
    return { agentId, filePath, alreadyExists: true };
  }

  const templateDir = path.join(input.extensionRoot, TEMPLATE_DIR);
  const vars = { displayName: toDisplayName(agentId), agentId };

  fs.mkdirSync(agentDir, { recursive: true });
  copyTemplate(templateDir, 'index.md', filePath, vars);
  copyTemplate(templateDir, 'steps.md', path.join(agentDir, 'steps.md'), vars);
  copyTemplate(templateDir, 'context.md', path.join(agentDir, 'context.md'), vars);

  return { agentId, filePath, alreadyExists: false };
}

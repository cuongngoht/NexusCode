import * as path from 'path';

/**
 * Image handling for prompt attachments.
 *
 * Every provider in this extension is a text CLI — no provider accepts image bytes.
 * So images are never inlined into the prompt; instead their paths are listed and the
 * agent is told to read them with its own image-capable file read tool.
 */

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg',
]);

/** Classify by extension — cheap, and works for paths whose bytes we have not read. */
export function isImageAttachmentPath(p: string): boolean {
  return IMAGE_EXTS.has(path.extname(p).toLowerCase());
}

/**
 * Body of the `# Attached Images` prompt section (no header — the caller adds it).
 *
 * Both path forms are emitted on purpose: the relative form matches the CLI's cwd
 * (AgentTask is constructed with `cwd = workspaceRoot`), while the absolute form is
 * what Claude Code's Read tool prefers.
 */
export function buildImageAttachmentList(workspaceRoot: string, relPaths: string[]): string {
  if (relPaths.length === 0) return '';

  const lines: string[] = [
    `The user attached ${relPaths.length} image(s). Read each file from disk with your`,
    'image-capable file read tool before answering — do not guess what they show.',
    '',
  ];

  for (const rel of relPaths) {
    lines.push(`- ${rel}`);
    lines.push(`  (absolute: ${path.resolve(workspaceRoot, rel)})`);
  }

  return lines.join('\n');
}

import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import { savePastedImages } from '../../context/attachments/pastedImageStore';
import { ensureNexusInGitignore } from '../../context/project-map/NexusGitignoreManager';
import { requireWorkspaceRoot } from './workspaceUtils';

/**
 * Persists clipboard-pasted image bytes into the workspace so they can be attached.
 *
 * Separate from `AttachmentHandler`, which only resolves paths that already exist — this one
 * writes bytes and owns the mkdir/gitignore concern.
 */
export class PastedImageHandler {
  constructor(private readonly post: (msg: ExtensionMessage) => void) {}

  async save(images: { mimeType: string; base64: string }[]): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post, 'attachmentError');
    if (!workspaceRoot) return;

    // Runs BEFORE the write. RunTaskHandler also calls this, but only once a task starts —
    // without it here, a pasted image would be visible to git until the first run.
    if (vscode.workspace.getConfiguration('nexus').get<boolean>('projectMap.addToGitignore', true)) {
      try {
        ensureNexusInGitignore(workspaceRoot);
      } catch {
        // Non-fatal: pastedImageStore also drops a `*` .gitignore inside the directory.
      }
    }

    const { saved, errors } = savePastedImages(workspaceRoot, images);

    if (saved.length > 0) {
      this.post({
        type: 'droppedFilesResolved',
        attachments: saved.map(s => ({ type: 'image' as const, path: s.relPath })),
      });
    }

    if (errors.length > 0) {
      console.warn('[PastedImageHandler] save errors:', errors);
      this.post({ type: 'attachmentError', message: errors.join(' ') });
    }
  }
}

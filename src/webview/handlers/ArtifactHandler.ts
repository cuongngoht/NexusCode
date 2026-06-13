import * as vscode from 'vscode';
import { ArtifactStore } from '../../artifacts/ArtifactStore';
import { ArtifactScanner } from '../../artifacts/ArtifactScanner';
import { ArtifactPreviewer } from '../../artifacts/ArtifactPreviewer';
import type { WebviewMessage, ExtensionMessage } from '../webviewProtocol';

export class ArtifactHandler {
  private readonly store: ArtifactStore;
  private readonly scanner: ArtifactScanner;
  private readonly previewer: ArtifactPreviewer;

  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    workspaceState: vscode.Memento,
  ) {
    this.store = new ArtifactStore(workspaceState);
    this.scanner = new ArtifactScanner();
    this.previewer = new ArtifactPreviewer();
  }

  async handleMessage(msg: WebviewMessage): Promise<boolean> {
    switch (msg.type) {
      case 'listArtifacts':
        await this.handleListArtifacts(msg);
        return true;
      case 'openArtifact':
        await this.handleOpenArtifact(msg.artifactId);
        return true;
      case 'previewArtifact':
        await this.handlePreviewArtifact(msg.artifactId);
        return true;
      case 'revealArtifactInExplorer':
        await this.handleRevealArtifact(msg.artifactId);
        return true;
      case 'deleteArtifact':
        await this.handleDeleteArtifact(msg.artifactId);
        return true;
      case 'rescanArtifacts':
        await this.handleRescanArtifacts();
        return true;
      default:
        return false;
    }
  }

  async notifyPlanSaved(taskId: string, planPath?: string, conversationId?: string): Promise<void> {
    const artifact = this.scanner.fromPlanSaved(taskId, planPath, conversationId);
    await this.store.add(artifact);
    this.post({ type: 'artifactCreated', artifact });
  }

  private async handleListArtifacts(msg: { conversationId?: string; taskId?: string }): Promise<void> {
    let artifacts = this.store.load();
    if (msg.conversationId) artifacts = artifacts.filter(a => a.sourceConversationId === msg.conversationId);
    if (msg.taskId) artifacts = artifacts.filter(a => a.sourceTaskId === msg.taskId);
    this.post({ type: 'artifactsListed', artifacts });
  }

  private async handleOpenArtifact(artifactId: string): Promise<void> {
    const artifact = this.store.load().find(a => a.id === artifactId);
    if (!artifact?.path) return;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const uri = vscode.Uri.file(
      artifact.path.startsWith('/') ? artifact.path : `${workspaceRoot}/${artifact.path}`,
    );
    await vscode.window.showTextDocument(uri);
  }

  private async handlePreviewArtifact(artifactId: string): Promise<void> {
    const artifact = this.store.load().find(a => a.id === artifactId);
    if (!artifact?.path) {
      this.post({ type: 'artifactError', artifactId, message: 'Artifact not found' });
      return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const result = await this.previewer.preview(workspaceRoot, artifact.path);
    this.post({
      type: 'artifactPreviewLoaded',
      artifactId,
      content: result.content,
      mimeType: result.mimeType,
      truncated: result.truncated,
    });
  }

  private async handleRevealArtifact(artifactId: string): Promise<void> {
    const artifact = this.store.load().find(a => a.id === artifactId);
    if (!artifact?.path) return;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const uri = vscode.Uri.file(
      artifact.path.startsWith('/') ? artifact.path : `${workspaceRoot}/${artifact.path}`,
    );
    await vscode.commands.executeCommand('revealInExplorer', uri);
  }

  private async handleDeleteArtifact(artifactId: string): Promise<void> {
    await this.store.remove(artifactId);
    this.post({ type: 'artifactDeleted', artifactId });
  }

  private async handleRescanArtifacts(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    const scanned = await this.scanner.scan(workspaceRoot);
    for (const a of scanned) await this.store.add(a);
    const all = this.store.load();
    this.post({ type: 'artifactsListed', artifacts: all });
  }
}

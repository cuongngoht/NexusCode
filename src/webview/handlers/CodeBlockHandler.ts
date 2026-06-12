import * as vscode from 'vscode';
import * as path from 'path';
import type { WebviewMessage } from '../webviewProtocol';

export class CodeBlockHandler {
  async handleMessage(msg: WebviewMessage): Promise<boolean> {
    switch (msg.type) {
      case 'insertCodeIntoActiveFile':
        await this.insertCode(msg.code);
        return true;
      case 'createFileFromCode':
        await this.createFile(msg.code, msg.language, msg.suggestedName);
        return true;
      case 'runCodeBlockCommand':
        this.runCommand(msg.command);
        return true;
      default:
        return false;
    }
  }

  private async insertCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor — open a file first.');
      return;
    }
    await editor.edit(builder => {
      const { selection } = editor;
      if (!selection.isEmpty) {
        builder.replace(selection, code);
      } else {
        builder.insert(selection.start, code);
      }
    });
  }

  private async createFile(code: string, language?: string, suggestedName?: string): Promise<void> {
    const ext = this.extFromLanguage(language ?? '');
    const defaultName = suggestedName ?? `snippet${ext}`;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const defaultUri = workspaceRoot
      ? vscode.Uri.file(path.join(workspaceRoot, defaultName))
      : undefined;

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      saveLabel: 'Create file',
      filters: language ? { [language]: [ext.slice(1)] } : { 'All files': ['*'] },
    });
    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(code, 'utf8'));
    await vscode.window.showTextDocument(uri);
  }

  private runCommand(command: string): void {
    const terminal = vscode.window.createTerminal({ name: 'Nexus Run' });
    terminal.show(true);
    terminal.sendText(command);
  }

  private extFromLanguage(lang: string): string {
    const map: Record<string, string> = {
      typescript: '.ts', javascript: '.js', tsx: '.tsx', jsx: '.jsx',
      python: '.py', rust: '.rs', go: '.go', java: '.java', cpp: '.cpp',
      c: '.c', css: '.css', html: '.html', json: '.json', yaml: '.yaml',
      sh: '.sh', bash: '.sh', zsh: '.sh', markdown: '.md', sql: '.sql',
    };
    return map[lang.toLowerCase()] ?? '.txt';
  }
}

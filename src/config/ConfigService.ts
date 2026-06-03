import * as vscode from 'vscode';
import type { NexusConfig } from './NexusConfig';
import { DEFAULT_CONFIG } from './DefaultConfig';

export class ConfigService {
  private get configUri(): vscode.Uri | undefined {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) { return undefined; }
    return vscode.Uri.joinPath(root, '.nexus', 'config.json');
  }

  async loadConfig(): Promise<NexusConfig> {
    const uri = this.configUri;
    if (!uri) { return structuredClone(DEFAULT_CONFIG); }

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(bytes).toString('utf8')) as NexusConfig;
      return parsed;
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  async hasConfig(): Promise<boolean> {
    const uri = this.configUri;
    if (!uri) return false;
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async saveConfig(config: NexusConfig): Promise<void> {
    const uri = this.configUri;
    if (!uri) {
      throw new Error('No workspace folder open.');
    }

    const dirUri = vscode.Uri.joinPath(uri, '..');
    await vscode.workspace.fs.createDirectory(dirUri);

    const content = JSON.stringify(config, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  }
}

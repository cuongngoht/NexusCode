import * as fs from 'fs';
import * as path from 'path';

interface CustomProviderJson {
  id: string;
  displayName: string;
  command: string;
  args: string[];
  defaultModel: string;
  models: Array<{ id: string; label: string }>;
  capabilities: {
    canEditFiles: boolean;
    canRunShell: boolean;
    canSearchWeb: boolean;
    supportsStreaming: boolean;
  };
}

export class CustomProviderScaffolder {
  /**
   * Creates a new custom provider scaffold at `{cwd}/.nexus/providers/{name}/provider.json`.
   * @param name - Provider identifier (used as id, command name, and directory name).
   * @param cwd - Workspace root directory.
   * @returns The absolute path of the created file.
   * @throws If a provider with the same name already exists.
   */
  async scaffold(name: string, cwd: string): Promise<string> {
    const dir = path.join(cwd, '.nexus', 'providers', name);
    const filePath = path.join(dir, 'provider.json');

    if (fs.existsSync(filePath)) {
      throw new Error(
        `Provider '${name}' already exists at ${filePath}. ` +
        `Remove it first if you want to recreate it.`,
      );
    }

    fs.mkdirSync(dir, { recursive: true });

    const content: CustomProviderJson = {
      id: name,
      displayName: name,
      command: name,
      args: ['run', '--prompt', '{{prompt}}'],
      defaultModel: 'default',
      models: [{ id: 'default', label: 'Default' }],
      capabilities: {
        canEditFiles: false,
        canRunShell: false,
        canSearchWeb: false,
        supportsStreaming: false,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    return filePath;
  }
}

const DEFAULT_IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  'bin', 'obj', 'venv', '.venv', '__pycache__', '.next', '.nuxt',
  'target', 'vendor', '.DS_Store',
]);

export class NexusIgnoreMatcher {
  constructor(private readonly rootPath: string) {}

  async init(): Promise<void> {
    // Later: read .gitignore and .nexusignore
    void this.rootPath;
  }

  shouldIgnore(relativePath: string): boolean {
    const parts = relativePath.split(/[\\/]/);
    return parts.some(part => DEFAULT_IGNORED.has(part));
  }
}

import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes debug session artifacts to .nexus/debug-sessions/<id>/
 */
export class DebugSessionWriter {
  private readonly sessionDir: string;

  constructor(workspaceRoot: string, sessionId: string) {
    this.sessionDir = path.join(workspaceRoot, '.nexus', 'debug-sessions', sessionId);
  }

  writeFile(filename: string, content: string): string {
    fs.mkdirSync(this.sessionDir, { recursive: true });
    const filePath = path.join(this.sessionDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  writePlan(content: string): string {
    return this.writeFile('debug-plan.md', content);
  }

  writeSummary(content: string): string {
    return this.writeFile('debug-summary.md', content);
  }

  get sessionPath(): string {
    return this.sessionDir;
  }
}

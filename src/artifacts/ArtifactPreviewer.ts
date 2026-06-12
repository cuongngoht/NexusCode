import * as path from 'path';
import * as fs from 'fs';

const MAX_PREVIEW_BYTES = 100_000;

export interface ArtifactPreviewResult {
  content?: string;
  uri?: string;
  mimeType?: string;
  truncated?: boolean;
  error?: string;
}

export class ArtifactPreviewer {
  async preview(workspaceRoot: string, artifactPath: string): Promise<ArtifactPreviewResult> {
    try {
      const fullPath = path.isAbsolute(artifactPath)
        ? artifactPath
        : path.join(workspaceRoot, artifactPath);

      if (!fs.existsSync(fullPath)) {
        return { error: 'File not found' };
      }

      const stat = fs.statSync(fullPath);
      if (stat.size === 0) return { content: '', mimeType: 'text/plain', truncated: false };

      const ext = path.extname(fullPath).toLowerCase();
      const isBinary = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'].includes(ext);

      if (isBinary) {
        // For binary/image files, return a vscode-resource URI (not a local path)
        return { mimeType: `image/${ext.slice(1)}`, truncated: false };
      }

      const bufSize = Math.min(stat.size, MAX_PREVIEW_BYTES);
      const buf = Buffer.alloc(bufSize);
      const fd = fs.openSync(fullPath, 'r');
      fs.readSync(fd, buf, 0, bufSize, 0);
      fs.closeSync(fd);

      const content = buf.toString('utf8');
      let mimeType = 'text/plain';
      if (ext === '.md') mimeType = 'text/markdown';
      else if (ext === '.json') mimeType = 'application/json';

      return { content, mimeType, truncated: stat.size > MAX_PREVIEW_BYTES };
    } catch (err) {
      return { error: String(err) };
    }
  }
}

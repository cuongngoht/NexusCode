import * as fs from 'fs';
import * as path from 'path';
import { NexusIgnoreMatcher } from './NexusIgnoreMatcher';
import type { FileTreeSnapshot } from './types';

export type FileTreeScannerOptions = {
  maxDepth: number;
  maxFiles: number;
};

const DEFAULT_OPTIONS: FileTreeScannerOptions = {
  maxDepth: 8,
  maxFiles: 5000,
};

export class NexusFileTreeScanner {
  async scan(
    rootPath: string,
    options?: Partial<FileTreeScannerOptions>,
  ): Promise<FileTreeSnapshot> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const matcher = new NexusIgnoreMatcher(rootPath);
    await matcher.init();

    const files: string[] = [];
    const folders: string[] = [];
    const skippedFolders: string[] = [];
    let skippedFiles = 0;
    let limitReached = false;

    const walk = (dir: string, depth: number): void => {
      if (limitReached || depth > opts.maxDepth) { return; }

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (limitReached) { break; }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (matcher.shouldIgnore(relativePath)) {
          if (entry.isDirectory()) {
            skippedFolders.push(relativePath);
          } else {
            skippedFiles++;
          }
          continue;
        }

        if (entry.isDirectory()) {
          folders.push(relativePath);
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          if (files.length >= opts.maxFiles) {
            limitReached = true;
            break;
          }
          files.push(relativePath);
        }
      }
    };

    walk(rootPath, 0);

    return {
      rootPath,
      generatedAt: new Date().toISOString(),
      files,
      folders,
      skipped: {
        files: skippedFiles,
        folders: skippedFolders,
      },
    };
  }
}

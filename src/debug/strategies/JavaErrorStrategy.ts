import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Java/Kotlin stack trace frame: at com.example.ClassName.method(FileName.java:42)
const JAVA_FRAME_RE = /\tat\s+[\w$.]+\(([\w]+\.(java|kt|scala)):\d+\)/g;

// Maven / Gradle compilation error: [ERROR] /path/to/File.java:[42,5] error message
const MAVEN_ERROR_FILE_RE = /\[ERROR\]\s+([\w./\-]+\.(?:java|kt)):\[(\d+),(\d+)\]/g;

// Gradle error: /path/to/File.kt:42:5: error:
const GRADLE_ERROR_FILE_RE = /([\w./\-]+\.(?:java|kt|scala)):\d+:\d+:\s+error:/g;

function isJavaSignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'java' ||
    ctx.detectedLanguage === 'kotlin' ||
    /Exception in thread "[^"]*"/.test(raw) ||
    /\tat [a-z][\w$.]+\([A-Z]\w+\.(java|kt):\d+\)/.test(raw) ||
    /\bBUILD FAILURE\b/.test(raw) ||
    ctx.suspectedTools.includes('maven') ||
    ctx.suspectedTools.includes('gradle') ||
    ctx.suspectedTools.includes('kotlin')
  );
}

export class JavaErrorStrategy implements DebugSearchStrategy {
  readonly name = 'java-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isJavaSignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';
    const seenPaths = new Set<string>();

    function addResult(filePath: string, score: number, reason: string): void {
      if (seenPaths.has(filePath)) return;
      seenPaths.add(filePath);
      results.push({ path: filePath, score, reason });
    }

    // Extract from stack frames (file name only, not full path)
    let m: RegExpExecArray | null;
    JAVA_FRAME_RE.lastIndex = 0;
    while ((m = JAVA_FRAME_RE.exec(raw)) !== null) {
      addResult(m[1], 180, 'Java/Kotlin stack frame');
    }

    // Maven error output
    MAVEN_ERROR_FILE_RE.lastIndex = 0;
    while ((m = MAVEN_ERROR_FILE_RE.exec(raw)) !== null) {
      const rel = m[1].startsWith(ctx.workspaceRoot)
        ? path.relative(ctx.workspaceRoot, m[1]).replace(/\\/g, '/')
        : m[1];
      addResult(rel, 200, 'Maven compilation error');
    }

    // Gradle error output
    GRADLE_ERROR_FILE_RE.lastIndex = 0;
    while ((m = GRADLE_ERROR_FILE_RE.exec(raw)) !== null) {
      const rel = m[1].startsWith(ctx.workspaceRoot)
        ? path.relative(ctx.workspaceRoot, m[1]).replace(/\\/g, '/')
        : m[1];
      addResult(rel, 200, 'Gradle compilation error');
    }

    // Signal files
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (/\.(java|kt|scala)$/.test(ref.path)) {
          addResult(ref.path, 160, 'Java/Kotlin error file');
        }
      }
    }

    // Build system config files
    for (const buildFile of ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']) {
      if (fs.existsSync(path.join(ctx.workspaceRoot, buildFile))) {
        addResult(buildFile, 70, 'Java/Kotlin build configuration');
      }
    }

    return results;
  }
}

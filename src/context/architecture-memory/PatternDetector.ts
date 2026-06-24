import * as path from 'path';

const PATTERN_SUFFIXES = [
  'Repository',
  'Service',
  'Controller',
  'Registry',
  'Factory',
  'Strategy',
  'Adapter',
  'Pipeline',
  'Policy',
  'Observer',
  'Orchestrator',
  'Builder',
  'Loader',
  'Writer',
  'Handler',
  'Resolver',
  'Middleware',
];

const CLASS_NAME_RE = /(?:class|interface)\s+(\w+)/g;

export class PatternDetector {
  detect(
    relativePath: string,
    fileContent: string,
  ): { patterns: string[]; sourceEvidence: string[] } {
    const patterns: string[] = [];
    const evidence: string[] = [];

    const baseName = path.basename(relativePath, path.extname(relativePath));

    for (const suffix of PATTERN_SUFFIXES) {
      if (baseName.endsWith(suffix) && baseName !== suffix) {
        if (!patterns.includes(suffix)) {
          patterns.push(suffix);
          evidence.push(`filename '${baseName}' ends with '${suffix}'`);
        }
      }
    }

    CLASS_NAME_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CLASS_NAME_RE.exec(fileContent)) !== null) {
      const name = match[1];
      if (!name) continue;
      for (const suffix of PATTERN_SUFFIXES) {
        if (name.endsWith(suffix) && name !== suffix && !patterns.includes(suffix)) {
          patterns.push(suffix);
          evidence.push(`class/interface name '${name}' ends with '${suffix}'`);
        }
      }
    }

    return { patterns, sourceEvidence: evidence };
  }
}

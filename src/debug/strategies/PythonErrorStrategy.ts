import * as fs from 'fs';
import * as path from 'path';
import type { DebugSearchStrategy } from './DebugSearchStrategy';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugSearchResult } from '../search/DebugSearchResult';

// Python traceback file reference: File "path/to/file.py", line 42
const PYTHON_FILE_RE = /File "([^"]+\.py)", line (\d+)/g;

const PYTHON_CONFIG_FILES = [
  { name: 'requirements.txt', score: 70, reason: 'Python dependencies' },
  { name: 'pyproject.toml', score: 80, reason: 'Python project configuration' },
  { name: 'setup.py', score: 70, reason: 'Python package setup' },
  { name: 'setup.cfg', score: 65, reason: 'Python package configuration' },
  { name: 'Pipfile', score: 65, reason: 'Python Pipenv configuration' },
  { name: 'poetry.lock', score: 55, reason: 'Python Poetry lockfile' },
  { name: 'pytest.ini', score: 70, reason: 'Pytest configuration' },
  { name: 'conftest.py', score: 65, reason: 'Pytest fixtures / conftest' },
  { name: 'tox.ini', score: 60, reason: 'Tox test configuration' },
  { name: 'mypy.ini', score: 60, reason: 'Mypy type-checker configuration' },
  { name: '.flake8', score: 55, reason: 'Flake8 linter configuration' },
  { name: 'ruff.toml', score: 55, reason: 'Ruff linter configuration' },
];

function isPythonSignal(ctx: DebugChainContext): boolean {
  const raw = ctx.signal?.raw ?? '';
  return (
    ctx.detectedLanguage === 'python' ||
    /Traceback \(most recent call last\):/.test(raw) ||
    /\b(ModuleNotFoundError|ImportError|AttributeError|IndentationError|SyntaxError|NameError|ValueError|KeyError)\b/.test(raw) ||
    /File ".*\.py", line \d+/.test(raw) ||
    ctx.suspectedTools.includes('pytest') ||
    ctx.suspectedTools.includes('python') ||
    ctx.suspectedTools.includes('mypy')
  );
}

export class PythonErrorStrategy implements DebugSearchStrategy {
  readonly name = 'python-error';

  canHandle(ctx: DebugChainContext): boolean {
    return isPythonSignal(ctx);
  }

  async search(ctx: DebugChainContext): Promise<DebugSearchResult[]> {
    const results: DebugSearchResult[] = [];
    const raw = ctx.signal?.raw ?? '';

    // Extract .py files from traceback
    const tracebackFiles = new Set<string>();
    let m: RegExpExecArray | null;
    PYTHON_FILE_RE.lastIndex = 0;
    while ((m = PYTHON_FILE_RE.exec(raw)) !== null) {
      const filePath = m[1];
      // Normalize to relative path if absolute and inside workspace
      const rel = filePath.startsWith(ctx.workspaceRoot)
        ? path.relative(ctx.workspaceRoot, filePath).replace(/\\/g, '/')
        : filePath.replace(/\\/g, '/');
      if (!rel.includes('site-packages') && !rel.startsWith('/usr') && !rel.startsWith('/opt')) {
        tracebackFiles.add(rel);
        results.push({
          path: rel,
          score: 200,
          reason: 'Python traceback source file',
        });
      }
    }

    // Also use signal files if already parsed
    if (ctx.signal) {
      for (const ref of ctx.signal.files) {
        if (ref.path.endsWith('.py') && !tracebackFiles.has(ref.path)) {
          results.push({
            path: ref.path,
            score: 180,
            reason: 'Python error source file',
          });
        }
      }
    }

    // Boost __init__.py of the affected package
    for (const filePath of tracebackFiles) {
      const dir = path.dirname(filePath);
      if (dir && dir !== '.') {
        const initPath = path.join(dir, '__init__.py').replace(/\\/g, '/');
        if (fs.existsSync(path.join(ctx.workspaceRoot, initPath))) {
          results.push({ path: initPath, score: 60, reason: 'Python package __init__' });
        }
      }
    }

    // Config files
    for (const cfg of PYTHON_CONFIG_FILES) {
      if (fs.existsSync(path.join(ctx.workspaceRoot, cfg.name))) {
        results.push({ path: cfg.name, score: cfg.score, reason: cfg.reason });
      }
    }

    return results;
  }
}

/**
 * Selects verification commands based on suspected tools and available package scripts.
 * Supports TypeScript/JavaScript, Python, Rust, Go, Java/Kotlin, C#/.NET, Ruby, PHP,
 * and generic Make-based projects.
 */

import type { DetectedLanguage } from '../language/LanguageDetector';

interface ToolSelectionInput {
  suspectedTools: string[];
  packageScripts: Record<string, string>;
  packageManager: string | null;
  failingCommand?: string;
  detectedLanguage?: DetectedLanguage;
}

interface ToolSelectionResult {
  selectedTool?: string;
  verificationCommand?: string;
}

const PM_RUN_PREFIXES: Record<string, string> = {
  npm: 'npm run',
  pnpm: 'pnpm run',
  yarn: 'yarn',
  bun: 'bun run',
};

function pmRun(pm: string | null, script: string): string {
  const prefix = PM_RUN_PREFIXES[pm ?? 'npm'] ?? 'npm run';
  return `${prefix} ${script}`;
}

function findScript(scripts: Record<string, string>, ...candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate in scripts) return candidate;
  }
  return undefined;
}

export function selectDebugTool(input: ToolSelectionInput): ToolSelectionResult {
  const { suspectedTools, packageScripts, packageManager, failingCommand, detectedLanguage } = input;

  // TypeScript
  if (suspectedTools.includes('typescript') || detectedLanguage === 'typescript') {
    const script = findScript(packageScripts, 'typecheck', 'compile:extension', 'compile', 'build', 'check');
    if (script) {
      return {
        selectedTool: 'typescript',
        verificationCommand: pmRun(packageManager, script),
      };
    }
    return {
      selectedTool: 'typescript',
      verificationCommand: 'npx tsc --noEmit',
    };
  }

  // Vitest
  if (suspectedTools.includes('vitest')) {
    const script = findScript(packageScripts, 'test:webview', 'test', 'test:unit', 'test:run');
    if (script) {
      return {
        selectedTool: 'vitest',
        verificationCommand: pmRun(packageManager, script),
      };
    }
    return {
      selectedTool: 'vitest',
      verificationCommand: 'npx vitest run',
    };
  }

  // Jest
  if (suspectedTools.includes('jest')) {
    const script = findScript(packageScripts, 'test', 'test:unit', 'jest');
    if (script) {
      return {
        selectedTool: 'jest',
        verificationCommand: pmRun(packageManager, script),
      };
    }
    return {
      selectedTool: 'jest',
      verificationCommand: 'npx jest',
    };
  }

  // ESLint
  if (suspectedTools.includes('eslint')) {
    const script = findScript(packageScripts, 'lint', 'lint:fix', 'eslint');
    if (script) {
      return {
        selectedTool: 'eslint',
        verificationCommand: pmRun(packageManager, script),
      };
    }
    return {
      selectedTool: 'eslint',
      verificationCommand: 'npx eslint .',
    };
  }

  // Vite / build error
  if (suspectedTools.includes('vite') || suspectedTools.includes('rollup')) {
    const script = findScript(packageScripts, 'compile', 'compile:extension', 'build', 'build:prod');
    if (script) {
      return {
        selectedTool: 'vite',
        verificationCommand: pmRun(packageManager, script),
      };
    }
  }

  // Python — pytest / mypy / ruff
  if (
    suspectedTools.includes('pytest') ||
    suspectedTools.includes('python') ||
    suspectedTools.includes('mypy') ||
    detectedLanguage === 'python'
  ) {
    if (suspectedTools.includes('mypy')) {
      return { selectedTool: 'mypy', verificationCommand: 'python -m mypy .' };
    }
    // uv/poetry first, then plain pytest
    if (suspectedTools.includes('uv')) {
      return { selectedTool: 'pytest', verificationCommand: 'uv run pytest' };
    }
    if (suspectedTools.includes('poetry')) {
      return { selectedTool: 'pytest', verificationCommand: 'poetry run pytest' };
    }
    return { selectedTool: 'pytest', verificationCommand: 'python -m pytest' };
  }

  // Rust — cargo
  if (
    suspectedTools.includes('cargo') ||
    suspectedTools.includes('rustc') ||
    detectedLanguage === 'rust'
  ) {
    if (suspectedTools.includes('clippy')) {
      return { selectedTool: 'cargo', verificationCommand: 'cargo clippy' };
    }
    return { selectedTool: 'cargo', verificationCommand: 'cargo check' };
  }

  // Go
  if (
    suspectedTools.includes('go') ||
    suspectedTools.includes('golang') ||
    detectedLanguage === 'go'
  ) {
    return { selectedTool: 'go', verificationCommand: 'go vet ./...' };
  }

  // Java — Maven
  if (suspectedTools.includes('maven') || suspectedTools.includes('mvn')) {
    const mvnw = packageScripts['test'] ?? undefined;
    if (mvnw) {
      return { selectedTool: 'maven', verificationCommand: pmRun(packageManager, 'test') };
    }
    // Prefer wrapper if present
    return { selectedTool: 'maven', verificationCommand: './mvnw test' };
  }

  // Java/Kotlin — Gradle
  if (
    suspectedTools.includes('gradle') ||
    detectedLanguage === 'java' ||
    detectedLanguage === 'kotlin'
  ) {
    return { selectedTool: 'gradle', verificationCommand: './gradlew test' };
  }

  // C# / .NET
  if (
    suspectedTools.includes('dotnet') ||
    suspectedTools.includes('csharp') ||
    detectedLanguage === 'csharp'
  ) {
    return { selectedTool: 'dotnet', verificationCommand: 'dotnet build' };
  }

  // Ruby — RSpec
  if (
    suspectedTools.includes('rspec') ||
    suspectedTools.includes('ruby') ||
    detectedLanguage === 'ruby'
  ) {
    return { selectedTool: 'rspec', verificationCommand: 'bundle exec rspec' };
  }

  // PHP — PHPUnit
  if (
    suspectedTools.includes('phpunit') ||
    suspectedTools.includes('php') ||
    detectedLanguage === 'php'
  ) {
    return { selectedTool: 'phpunit', verificationCommand: 'phpunit' };
  }

  // Generic Make
  if (suspectedTools.includes('make')) {
    return { selectedTool: 'make', verificationCommand: 'make test' };
  }

  // Node / runtime error: use the original failing command if safe
  if (failingCommand) {
    return {
      selectedTool: suspectedTools[0] ?? 'node',
      verificationCommand: failingCommand,
    };
  }

  // Generic: try common compile/test scripts
  const genericScript = findScript(packageScripts, 'compile', 'build', 'check', 'typecheck', 'test');
  if (genericScript) {
    return {
      selectedTool: suspectedTools[0] ?? 'unknown',
      verificationCommand: pmRun(packageManager, genericScript),
    };
  }

  return { selectedTool: suspectedTools[0] };
}

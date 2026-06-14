import * as fs from 'fs';
import * as path from 'path';
import { BaseDebugStep } from './BaseDebugStep';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import type { DebugStepResult } from '../orchestrator/DebugStep';
import type { DebugState } from '../orchestrator/DebugState';
import { detectLanguageFromManifests, MANIFEST_LANG_MAP } from '../language/LanguageDetector';

const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'coverage',
  'media/webview',
  '__MACOSX',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
];

interface ProjectScanJson {
  packageManager?: string;
  scripts?: Record<string, string>;
  excludeFromIndex?: string[];
  sourceRoots?: string[];
  testRoots?: string[];
}

interface PackageJson {
  scripts?: Record<string, string>;
  packageManager?: string;
}

function detectPackageManagerFromPackageJson(workspaceRoot: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as PackageJson;
    if (pkg.packageManager) {
      if (pkg.packageManager.startsWith('pnpm')) return 'pnpm';
      if (pkg.packageManager.startsWith('yarn')) return 'yarn';
      if (pkg.packageManager.startsWith('bun')) return 'bun';
      return 'npm';
    }
  } catch {
    // no package.json
  }
  // Detect from lockfiles
  if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(workspaceRoot, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(workspaceRoot, 'package-lock.json'))) return 'npm';
  return null;
}

function loadPackageScripts(workspaceRoot: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as PackageJson;
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      return pkg.scripts;
    }
  } catch {
    // no package.json
  }
  return {};
}

export class ProjectProfileLoadStep extends BaseDebugStep {
  readonly name = 'debug-load-profile';
  protected readonly state: DebugState = 'loading_project_profile';

  protected async execute(ctx: DebugChainContext): Promise<DebugStepResult> {
    const nexusDir = path.join(ctx.workspaceRoot, '.nexus');

    // Try to load project-profile.md
    const profilePath = path.join(nexusDir, 'project-profile.md');
    if (fs.existsSync(profilePath)) {
      try {
        ctx.projectProfileMarkdown = fs.readFileSync(profilePath, 'utf8');
      } catch {
        // non-fatal
      }
    }

    // Try to load project-scan.json
    const scanPath = path.join(nexusDir, 'project-scan.json');
    if (fs.existsSync(scanPath)) {
      try {
        const raw = fs.readFileSync(scanPath, 'utf8');
        const parsed = JSON.parse(raw) as ProjectScanJson;
        ctx.projectScanJson = parsed;

        // Extract excludeFromIndex
        if (Array.isArray(parsed.excludeFromIndex)) {
          ctx.projectExcludeFromIndex = [
            ...DEFAULT_EXCLUDE_DIRS,
            ...parsed.excludeFromIndex,
          ].filter((v, i, a) => a.indexOf(v) === i);
        }

        // Extract package manager
        if (parsed.packageManager && !ctx.packageManager) {
          ctx.packageManager = parsed.packageManager;
        }

        // Extract scripts
        if (parsed.scripts && Object.keys(ctx.packageScripts).length === 0) {
          ctx.packageScripts = parsed.scripts;
        }
      } catch {
        // invalid JSON — continue with defaults
        ctx.evidence.push('[ProjectProfileLoadStep] project-scan.json is invalid or unreadable — using defaults.');
      }
    }

    // Ensure defaults are set
    if (ctx.projectExcludeFromIndex.length === 0) {
      ctx.projectExcludeFromIndex = [...DEFAULT_EXCLUDE_DIRS];
    }

    if (!ctx.packageManager) {
      ctx.packageManager = detectPackageManagerFromPackageJson(ctx.workspaceRoot);
    }

    if (Object.keys(ctx.packageScripts).length === 0) {
      ctx.packageScripts = loadPackageScripts(ctx.workspaceRoot);
    }

    // Detect language from manifest files if not already set
    if (!ctx.detectedLanguage) {
      const manifestFiles = detectPresentManifests(ctx.workspaceRoot);
      const langResult = detectLanguageFromManifests(manifestFiles);
      if (langResult.language !== 'unknown') {
        ctx.detectedLanguage = langResult.language;
        // Derive non-JS package manager / scripts from detected language
        if (!ctx.packageManager) {
          ctx.packageManager = deriveNonJsPackageManager(ctx.workspaceRoot, manifestFiles);
        }
      }
    }

    return { status: 'continue' };
  }
}

/** Collect names of known manifest files that exist in the workspace root. */
function detectPresentManifests(workspaceRoot: string): string[] {
  const present: string[] = [];
  for (const { file } of MANIFEST_LANG_MAP) {
    if (fs.existsSync(path.join(workspaceRoot, file))) {
      present.push(file);
    }
  }
  // Also scan for *.csproj / *.sln
  try {
    const entries = fs.readdirSync(workspaceRoot);
    for (const entry of entries) {
      if (/\.(csproj|sln|fsproj|vbproj)$/i.test(entry)) {
        present.push(entry);
      }
    }
  } catch {
    // non-fatal
  }
  return present;
}

/** Map detected non-JS language to a conventional package manager / command identifier. */
function deriveNonJsPackageManager(workspaceRoot: string, manifestFiles: string[]): string | null {
  const lower = manifestFiles.map(f => f.toLowerCase());
  if (lower.includes('cargo.toml')) return 'cargo';
  if (lower.includes('go.mod')) return 'go';
  if (lower.includes('pom.xml') || lower.includes('mvnw')) return 'maven';
  if (lower.includes('build.gradle') || lower.includes('build.gradle.kts') || lower.includes('gradlew')) return 'gradle';
  if (lower.includes('gemfile')) return 'bundler';
  if (lower.includes('composer.json')) return 'composer';
  if (lower.includes('package.swift')) return 'swift';
  if (lower.includes('cmakeLists.txt') || lower.includes('makefile')) return 'make';
  if (lower.some(f => /\.(csproj|sln)$/.test(f))) return 'dotnet';
  // Python: check for uv, poetry, pip
  if (fs.existsSync(path.join(workspaceRoot, 'uv.lock'))) return 'uv';
  if (lower.includes('poetry.lock') || lower.includes('pyproject.toml')) return 'poetry';
  if (lower.includes('pipfile')) return 'pipenv';
  if (lower.includes('requirements.txt')) return 'pip';
  return null;
}

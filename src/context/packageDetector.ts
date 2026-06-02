import * as fs from 'fs';
import * as path from 'path';

export interface PackageInfo {
  manager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  scripts: string[];
  frameworks: string[];
}

const FRAMEWORK_MARKERS: Record<string, string[]> = {
  react: ['react'],
  vue: ['vue'],
  angular: ['@angular/core'],
  svelte: ['svelte'],
  next: ['next'],
  nuxt: ['nuxt'],
  express: ['express'],
  fastify: ['fastify'],
  nestjs: ['@nestjs/core'],
  electron: ['electron'],
};

export function detectPackageInfo(workspaceRoot: string): PackageInfo {
  const pkgPath = path.join(workspaceRoot, 'package.json');
  const hasPnpmLock = fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'));
  const hasYarnLock = fs.existsSync(path.join(workspaceRoot, 'yarn.lock'));
  const hasBunLock = fs.existsSync(path.join(workspaceRoot, 'bun.lockb'));

  let manager: PackageInfo['manager'] = 'unknown';
  if (hasBunLock) {
    manager = 'bun';
  } else if (hasPnpmLock) {
    manager = 'pnpm';
  } else if (hasYarnLock) {
    manager = 'yarn';
  } else if (fs.existsSync(path.join(workspaceRoot, 'package-lock.json'))) {
    manager = 'npm';
  }

  const scripts: string[] = [];
  const frameworks: string[] = [];

  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;

    if (pkg['scripts'] && typeof pkg['scripts'] === 'object') {
      scripts.push(...Object.keys(pkg['scripts'] as Record<string, unknown>));
    }

    const deps: Record<string, string> = {
      ...((pkg['dependencies'] as Record<string, string>) ?? {}),
      ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
    };

    for (const [name, markers] of Object.entries(FRAMEWORK_MARKERS)) {
      if (markers.some(m => deps[m] !== undefined)) {
        frameworks.push(name);
      }
    }

    if (manager === 'unknown' && fs.existsSync(pkgPath)) {
      manager = 'npm';
    }
  } catch {
    // no package.json or parse error — leave empty
  }

  return { manager, scripts, frameworks };
}

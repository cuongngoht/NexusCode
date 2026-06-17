import type { PermissionRisk } from './PermissionTypes';

// Blocked patterns - never execute
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\b(curl|wget)\b.*\|\s*(sh|bash|zsh|fish)\b/i,
  /~\/\.ssh\b/,
  /\b(id_rsa|id_ed25519|id_ecdsa|\.pem|\.key)\b/,
  /\bsudo\b/,
  /\bchmod\s+-R\s+777\b/,
  /\bchmod\s+777\b/,
  /\brm\s+-rf\s+\/\b/,
  /\brm\s+-rf\s+~\b/,
];

// High risk - irreversible operations
const HIGH_RISK_PATTERNS: readonly RegExp[] = [
  /^git\s+reset\s+--hard(\s|$)/,
  /^git\s+clean\s+-f/,
  /^git\s+push(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+publish(\s|$)/,
  /\brm\s+-rf\b/,
  /\bdel\s+\/s\b/,
  /\brmdir\s+\/s\b/,
  /^git\s+checkout\s+--\b/,
  /\bdeploy\b/,
  /\bnpm\s+install\s+-g\b/,
  /\bpnpm\s+add\s+-g\b/,
];

// Medium risk - installs, branches, stash
const MEDIUM_RISK_PATTERNS: readonly RegExp[] = [
  /^(npm|pnpm|yarn|bun)\s+install(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+add(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+i(\s|$)/,
  /^git\s+checkout\s+-b(\s|$)/,
  /^git\s+switch\s+-c(\s|$)/,
  /^git\s+restore(\s|$)/,
  /^git\s+stash(\s|$)/,
];

// Low risk - read-only / test operations
const LOW_RISK_PATTERNS: readonly RegExp[] = [
  /^(npm|pnpm|yarn|bun)\s+test(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+run\s+(test|typecheck|lint|test:webview|compile)(\s|$)/,
  /^git\s+(status|diff)(\s|$)/,
  /^git\s+rev-parse\s+HEAD$/,
  /^git\s+log(\s|$)/,
  /^git\s+branch(\s|$)/,
];

function matchesAny(str: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(p => p.test(str));
}

export class PermissionRiskClassifier {
  classifyCommand(command: string): PermissionRisk {
    const cmd = command.trim();
    if (matchesAny(cmd, BLOCKED_PATTERNS)) return 'blocked';
    if (matchesAny(cmd, HIGH_RISK_PATTERNS)) return 'high';
    if (matchesAny(cmd, MEDIUM_RISK_PATTERNS)) return 'medium';
    if (matchesAny(cmd, LOW_RISK_PATTERNS)) return 'low';
    return 'medium'; // unknown → medium to be safe
  }

  classifyFileWrite(filePath: string, _diffPreview?: string): PermissionRisk {
    const path = filePath.toLowerCase();
    // Sensitive config files → high
    if (
      path.endsWith('package.json') ||
      path.endsWith('package-lock.json') ||
      path.endsWith('yarn.lock') ||
      path.endsWith('pnpm-lock.yaml') ||
      path.endsWith('.env') ||
      path.includes('/.ssh/') ||
      path.endsWith('.pem') ||
      path.endsWith('.key')
    ) {
      return 'high';
    }
    // All other file writes → medium
    return 'medium';
  }

  classifyFileDelete(_filePath: string): PermissionRisk {
    return 'high';
  }

  explainCommand(command: string): string {
    const cmd = command.trim();
    if (matchesAny(cmd, BLOCKED_PATTERNS)) {
      return 'This command is blocked: it may expose secrets, execute remote scripts, or use elevated privileges.';
    }
    if (matchesAny(cmd, HIGH_RISK_PATTERNS)) {
      return 'This is a high-risk command that may cause irreversible changes.';
    }
    if (matchesAny(cmd, MEDIUM_RISK_PATTERNS)) {
      return 'This command modifies the environment (e.g. installs packages or creates branches).';
    }
    if (matchesAny(cmd, LOW_RISK_PATTERNS)) {
      return 'This command is read-only or runs safe test/typecheck operations.';
    }
    return 'This command is unrecognized — treating as medium risk.';
  }
}

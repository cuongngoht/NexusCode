export interface SafeCommandDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

/**
 * Patterns for commands that are unconditionally allowed (read-only diagnostics).
 * These commands only inspect/check — they do not install or mutate.
 */
const ALLOWED_PATTERNS: RegExp[] = [
  // JavaScript / TypeScript (npm, pnpm, yarn, bun)
  /^npm\s+run\s+(typecheck|compile|test|test:webview|lint|check|build:check)\b/i,
  /^pnpm\s+run\s+(typecheck|compile|test|test:webview|lint|check|build:check)\b/i,
  /^yarn\s+(typecheck|compile|test|lint|check)\b/i,
  /^bun\s+run\s+(typecheck|compile|test|lint|check)\b/i,
  /^npx\s+tsc\b.*--noEmit\b/i,
  /^npx\s+vitest\s+run\b/i,
  /^npx\s+jest\b/i,
  /^npx\s+eslint\s+\./i,
  /^node\s+--version\b/i,
  /^npm\s+--version\b/i,

  // Python
  /^python\s+-m\s+pytest\b/i,
  /^pytest\b/i,
  /^python\s+-m\s+mypy\b/i,
  /^mypy\b/i,
  /^python\s+-m\s+flake8\b/i,
  /^flake8\b/i,
  /^python\s+-m\s+black\s+--check\b/i,
  /^python\s+-m\s+ruff\s+check\b/i,
  /^ruff\s+check\b/i,
  /^poetry\s+run\s+pytest\b/i,
  /^uv\s+run\s+pytest\b/i,
  /^python\s+--version\b/i,
  /^python3\s+--version\b/i,

  // Rust
  /^cargo\s+check\b/i,
  /^cargo\s+test\b/i,
  /^cargo\s+clippy\b/i,
  /^cargo\s+build\b/i,

  // Go
  /^go\s+build\b/i,
  /^go\s+test\b/i,
  /^go\s+vet\b/i,
  /^golangci-lint\s+run\b/i,

  // Java / Kotlin (Maven, Gradle)
  /^mvn\s+test\b/i,
  /^mvn\s+compile\b/i,
  /^mvn\s+verify\b/i,
  /^gradle\s+test\b/i,
  /^gradle\s+build\b/i,
  /^\.\/gradlew\s+test\b/i,
  /^\.\/gradlew\s+build\b/i,
  /^\.\/mvnw\s+test\b/i,
  /^\.\/mvnw\s+compile\b/i,

  // C# / .NET
  /^dotnet\s+build\b/i,
  /^dotnet\s+test\b/i,
  /^dotnet\s+run\b/i,

  // Ruby
  /^bundle\s+exec\s+rspec\b/i,
  /^bundle\s+exec\s+rake\s+(test|spec)\b/i,
  /^ruby\s+-w\b/i,

  // PHP
  /^composer\s+run\s+test\b/i,
  /^phpunit\b/i,
  /^\.\/vendor\/bin\/phpunit\b/i,

  // Generic
  /^make\s+(test|build|check|lint|typecheck|verify)\b/i,
];

/**
 * Patterns for commands that are unconditionally blocked (destructive/install).
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+-?r?f?\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bsudo\b/i,
  /\bchmod\s+-R\b/i,
  /\bchown\b/i,
  /\bcurl\b.*\|\s*(sh|bash)\b/i,
  /\bwget\b.*\|\s*(sh|bash)\b/i,
  // JS/TS package managers — install
  /\bnpm\s+install\b/i,
  /\bpnpm\s+install\b/i,
  /\byarn\s+install\b/i,
  /\bbun\s+install\b/i,
  /\bnpm\s+ci\b/i,
  /\bpnpm\s+ci\b/i,
  // Python package managers — install
  /\bpip\s+install\b/i,
  /\bpip3\s+install\b/i,
  /\buv\s+add\b/i,
  /\bpoetry\s+add\b/i,
  /\bconda\s+install\b/i,
  // Rust — install
  /\bcargo\s+install\b/i,
  // Go — install
  /\bgo\s+install\b/i,
  // Ruby — install
  /\bgem\s+install\b/i,
  /\bbundle\s+install\b/i,
  // PHP — install
  /\bcomposer\s+install\b/i,
  /\bcomposer\s+update\b/i,
  // System package managers
  /\bapt(-get)?\s+install\b/i,
  /\bbrew\s+install\b/i,
  /\bchoco\s+install\b/i,
  /\bapk\s+add\b/i,
  /\byum\s+install\b/i,
  /\bdnf\s+install\b/i,
];

/**
 * Patterns for commands that require explicit user approval before running.
 */
const REQUIRES_APPROVAL_PATTERNS: RegExp[] = [
  /^npm\s+run\s+build\b/i,
  /^pnpm\s+run\s+build\b/i,
  /^yarn\s+build\b/i,
  /\bgit\s+commit\b/i,
  /\bgit\s+push\b/i,
  /^make\b(?!\s+(test|build|check|lint|typecheck|verify)\b)/i,
];

export function assessDebugCommand(command: string): SafeCommandDecision {
  const trimmed = command.trim();

  // Check blocked first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Command blocked by safe command policy: matches blocked pattern ${pattern}`,
      };
    }
  }

  // Check allowed patterns
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: true, requiresApproval: false };
    }
  }

  // Check requires-approval patterns
  for (const pattern of REQUIRES_APPROVAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Command requires approval before running: ${trimmed}`,
      };
    }
  }

  // Default: unknown command requires approval
  return {
    allowed: false,
    requiresApproval: true,
    reason: `Command not in safe allowlist — requires approval: ${trimmed}`,
  };
}

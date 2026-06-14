import type { AgentModePolicy } from './AgentModePolicy';
import type { AgentSession } from './AgentSession';

export type CommandRisk = 'low' | 'medium' | 'high' | 'blocked';

export interface AgentCommandApprovalRequest {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  risk: CommandRisk;
  reason: string;
  createdAt: number;
}

// Commands that are safe to run without approval (read-only/test operations)
const LOW_RISK_PATTERNS: readonly RegExp[] = [
  /^(npm|pnpm|yarn|bun)\s+test(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+run\s+(test|typecheck|lint|test:webview|compile)(\s|$)/,
  /^git\s+(status|diff)(\s|$)/,
  /^git\s+rev-parse\s+HEAD$/,
  /^git\s+log(\s|$)/,
  /^git\s+branch(\s|$)/,
];

// Commands that install dependencies or create branches
const MEDIUM_RISK_PATTERNS: readonly RegExp[] = [
  /^(npm|pnpm|yarn|bun)\s+install(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+add(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+i(\s|$)/,
  /^git\s+checkout\s+-b(\s|$)/,
  /^git\s+switch\s+-c(\s|$)/,
  /^git\s+restore(\s|$)/,
  /^git\s+stash(\s|$)/,
];

// Destructive or irreversible operations
const HIGH_RISK_PATTERNS: readonly RegExp[] = [
  /^git\s+reset\s+--hard(\s|$)/,
  /^git\s+clean\s+-f/,
  /^git\s+push(\s|$)/,
  /^(npm|pnpm|yarn|bun)\s+publish(\s|$)/,
  /\brm\s+-rf\b/,
  /\bdel\s+\/s\b/,
  /\brmdir\s+\/s\b/,
];

// Absolutely blocked — never run automatically
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\b(curl|wget)\b.*\|\s*(sh|bash|zsh|fish)\b/,
  /~\/\.ssh\b/,
  /\b(id_rsa|id_ed25519|id_ecdsa|\.pem|\.key)\b/,
  /\bsudo\b/,
  /\bchmod\s+-R\s+777\b/,
  /\bchmod\s+777\b/,
];

function matchesAny(command: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(p => p.test(command));
}

export class AgentCommandGuard {
  classify(command: string): CommandRisk {
    const cmd = command.trim();
    if (matchesAny(cmd, BLOCKED_PATTERNS)) return 'blocked';
    if (matchesAny(cmd, HIGH_RISK_PATTERNS)) return 'high';
    if (matchesAny(cmd, MEDIUM_RISK_PATTERNS)) return 'medium';
    if (matchesAny(cmd, LOW_RISK_PATTERNS)) return 'low';
    // Unknown commands default to medium to be safe
    return 'medium';
  }

  explain(command: string): string {
    const cmd = command.trim();
    if (matchesAny(cmd, BLOCKED_PATTERNS)) {
      return 'This command is blocked: it may expose secrets, execute remote scripts, or use elevated privileges.';
    }
    if (matchesAny(cmd, HIGH_RISK_PATTERNS)) {
      return 'This is a high-risk command that may cause irreversible changes (e.g. destructive git operations, publishing, or file deletion).';
    }
    if (matchesAny(cmd, MEDIUM_RISK_PATTERNS)) {
      return 'This command modifies the environment (e.g. installs packages or creates branches).';
    }
    if (matchesAny(cmd, LOW_RISK_PATTERNS)) {
      return 'This command is read-only or runs safe test/typecheck operations.';
    }
    return 'This command is not recognized — treating as medium risk.';
  }

  requiresApproval(command: string, policy: AgentModePolicy): boolean {
    const risk = this.classify(command);
    if (risk === 'blocked') return true; // blocked always needs "approval" (which will be denied)
    if (policy.requireApprovalBeforeTerminal) return true;
    // Even with requireApprovalBeforeTerminal off, medium/high/blocked still need approval
    return risk !== 'low';
  }

  /**
   * Validates whether the command is allowed to run based on policy.
   * - 'blocked' commands throw an error — they must never run.
   * - Commands requiring approval emit an event and throw a pending-approval error.
   * - Callers must catch the error and handle the approval flow.
   */
  assertAllowedOrRequestApproval(
    session: AgentSession,
    command: string,
    cwd: string,
    policy: AgentModePolicy,
    onApprovalRequired: (request: AgentCommandApprovalRequest) => void,
  ): AgentCommandApprovalRequest | null {
    const risk = this.classify(command);
    const reason = this.explain(command);

    if (risk === 'blocked') {
      throw new Error(`Command blocked by Agent Mode policy: ${command}\nReason: ${reason}`);
    }

    if (this.requiresApproval(command, policy)) {
      const request: AgentCommandApprovalRequest = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId: session.id,
        command,
        cwd,
        risk,
        reason,
        createdAt: Date.now(),
      };
      onApprovalRequired(request);
      return request;
    }

    return null; // allowed to run without approval
  }
}

import type { AgentSession } from './AgentSession';
import type { AgentTestResult } from './AgentTestRunner';
import type { AgentModePolicy } from './AgentModePolicy';

export interface AgentRecoveryInput {
  session: AgentSession;
  failedTestResult: AgentTestResult;
  attempt: number;
}

export interface AgentRecoveryResult {
  sessionId: string;
  attempts: number;
  recovered: boolean;
  finalTestResult?: AgentTestResult;
  errors: string[];
}

export type RunAgentFn = (prompt: string, workspaceRoot: string, providerId: string, model?: string) => Promise<void>;
export type RunTestsFn = (session: AgentSession, policy: AgentModePolicy) => Promise<AgentTestResult>;
export type CollectDiffFn = (session: AgentSession) => Promise<{ diff: string }>;

export class AgentRecovery {
  constructor(
    private readonly runAgent: RunAgentFn,
    private readonly runTests: RunTestsFn,
    private readonly collectDiff: CollectDiffFn,
  ) {}

  async recover(
    session: AgentSession,
    failedTestResult: AgentTestResult,
    policy: AgentModePolicy,
  ): Promise<AgentRecoveryResult> {
    const maxAttempts = policy.maxRecoveryAttempts;
    if (maxAttempts <= 0) {
      return {
        sessionId: session.id,
        attempts: 0,
        recovered: false,
        finalTestResult: failedTestResult,
        errors: ['maxRecoveryAttempts is 0 — recovery disabled'],
      };
    }

    const errors: string[] = [];
    let lastTestResult = failedTestResult;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Collect current diff for context
        let diffContext = '';
        try {
          const diffResult = await this.collectDiff(session);
          diffContext = diffResult.diff.slice(0, 4000);
        } catch {
          diffContext = '(diff not available)';
        }

        const failureSummary = lastTestResult.commands
          .filter(c => !c.passed)
          .map(c => `Command: ${c.command}\nExit code: ${c.exitCode}\nStdout:\n${c.stdout.slice(-2000)}\nStderr:\n${c.stderr.slice(-2000)}`)
          .join('\n\n');

        const recoveryPrompt = buildRecoveryPrompt({
          originalPrompt: session.originalPrompt,
          planText: session.planText ?? '',
          failureSummary,
          diffContext,
          attempt,
          maxAttempts,
        });

        await this.runAgent(recoveryPrompt, session.workspaceRoot, session.providerId, session.model);

        const newTestResult = await this.runTests(session, policy);
        lastTestResult = newTestResult;

        if (newTestResult.passed) {
          return {
            sessionId: session.id,
            attempts: attempt,
            recovered: true,
            finalTestResult: newTestResult,
            errors,
          };
        }

        errors.push(`Attempt ${attempt}: tests still failing after recovery`);
      } catch (err) {
        const msg = String(err);
        errors.push(`Attempt ${attempt}: ${msg}`);
      }
    }

    return {
      sessionId: session.id,
      attempts: maxAttempts,
      recovered: false,
      finalTestResult: lastTestResult,
      errors,
    };
  }
}

function buildRecoveryPrompt(params: {
  originalPrompt: string;
  planText: string;
  failureSummary: string;
  diffContext: string;
  attempt: number;
  maxAttempts: number;
}): string {
  return `You are Nexus Agent Mode Recovery.

Original user task:
${params.originalPrompt}

Approved plan:
${params.planText}

Recovery attempt ${params.attempt} of ${params.maxAttempts}.

Failing test output:
${params.failureSummary}

Current diff (changes so far):
${params.diffContext}

Your job:
- Fix only the issue causing the failure.
- Do not rewrite unrelated files.
- Do not expand scope.
- Do not introduce unrelated refactors.
- Preserve the approved implementation plan.
- If the approved plan is wrong, explain the smallest necessary correction.
- Do not run terminal commands.

After your fix, Agent Mode will run tests again.`;
}

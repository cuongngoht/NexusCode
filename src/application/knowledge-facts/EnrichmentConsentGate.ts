import type * as vscode from 'vscode';

const CONSENT_KEY = 'nexus.knowledgeFacts.enrichmentConsent';

export type ConsentPrompt = (message: string, ...items: string[]) => Promise<string | undefined>;

/**
 * No one-time-consent framework exists elsewhere in this codebase — this is new,
 * consent-specific logic. The prompt function is injected (rather than calling
 * vscode.window.showInformationMessage directly) so this class has zero runtime dependency on
 * the 'vscode' module and is unit-testable; the composition root wires the real VS Code prompt.
 */
export class EnrichmentConsentGate {
  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly prompt: ConsentPrompt,
  ) {}

  async ensureConsent(): Promise<boolean> {
    const decided = this.workspaceState.get<'granted' | 'denied'>(CONSENT_KEY);
    if (decided) return decided === 'granted';

    const choice = await this.prompt(
      "Nexus can use AI to enrich your project's Knowledge Facts (architecture notes, invariants, lessons learned) after significant changes, debug fixes, or review findings. This calls your configured AI provider up to 5x/day by default. Enable?",
      'Enable', 'Not Now', 'Never',
    );

    if (choice === 'Enable') {
      await this.workspaceState.update(CONSENT_KEY, 'granted');
      return true;
    }
    if (choice === 'Never') {
      await this.workspaceState.update(CONSENT_KEY, 'denied');
    }
    return false; // 'Not Now' or dismissed — ask again next trigger, don't persist
  }
}

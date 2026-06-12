import * as vscode from 'vscode';
import {
  loadActiveResearch,
  markCurrentStepDone,
  advanceToNextStep,
  listResearchTopics,
} from '../../context/research/activeResearchStore';
import { ensureOrchestratorExists, loadOrchestrator } from '../../context/research/researchOrchestratorLoader';

export class ResearchCommandHandler {
  async handle(action: 'done' | 'current' | 'next' | 'list' | 'reload'): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showInformationMessage('Nexus Research: No workspace folder open.');
      return;
    }

    switch (action) {
      case 'done':    this.handleDone(workspaceRoot); break;
      case 'current': this.handleCurrent(workspaceRoot); break;
      case 'next':    this.handleNext(workspaceRoot); break;
      case 'list':    this.handleList(workspaceRoot); break;
      case 'reload':  this.handleReload(workspaceRoot); break;
    }
  }

  private handleDone(workspaceRoot: string): void {
    const updated = markCurrentStepDone(workspaceRoot);
    if (!updated) {
      vscode.window.showInformationMessage('Nexus Research: No active research found.');
      return;
    }
    const allDone = updated.completedSteps.includes(updated.currentStep);
    if (allDone) {
      vscode.window.showInformationMessage(
        `Nexus Research: All steps completed for "${updated.researchId}". Ready to export plan.`,
      );
    } else {
      vscode.window.showInformationMessage(
        `Nexus Research: Moved to step → ${updated.currentStep}  (${updated.researchId})`,
      );
    }
  }

  private handleCurrent(workspaceRoot: string): void {
    const state = loadActiveResearch(workspaceRoot);
    if (!state) {
      vscode.window.showInformationMessage(
        'Nexus Research: No active research. Start with @research <problem>.',
      );
      return;
    }
    const completed = state.completedSteps.length > 0 ? state.completedSteps.join(', ') : 'none';
    vscode.window.showInformationMessage(
      [
        `Research: ${state.researchId}`,
        `Problem: ${state.problem.slice(0, 80)}`,
        `Current step: ${state.currentStep}`,
        `Completed: ${completed}`,
      ].join('  |  '),
    );
  }

  private handleNext(workspaceRoot: string): void {
    const updated = advanceToNextStep(workspaceRoot);
    if (!updated) {
      vscode.window.showInformationMessage('Nexus Research: No active research found.');
      return;
    }
    vscode.window.showInformationMessage(
      `Nexus Research: Advanced to → ${updated.currentStep}  (${updated.researchId})`,
    );
  }

  private handleList(workspaceRoot: string): void {
    const topics = listResearchTopics(workspaceRoot);
    if (topics.length === 0) {
      vscode.window.showInformationMessage(
        'Nexus Research: No research topics found. Start with @research <problem>.',
      );
      return;
    }
    const active = loadActiveResearch(workspaceRoot);
    const lines = topics.map(t => (active?.researchId === t ? `★ ${t}` : `  ${t}`));
    vscode.window.showInformationMessage(`Research topics:\n${lines.join('\n')}`);
  }

  private handleReload(workspaceRoot: string): void {
    ensureOrchestratorExists(workspaceRoot);
    const content = loadOrchestrator(workspaceRoot);
    const state = loadActiveResearch(workspaceRoot);
    const msg = state
      ? `Nexus Research: Reloaded. Active: ${state.researchId} → ${state.currentStep}. Orchestrator: ${content.length} chars.`
      : `Nexus Research: Reloaded. No active research. Orchestrator: ${content.length} chars.`;
    vscode.window.showInformationMessage(msg);
  }
}

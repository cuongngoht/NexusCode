import type { ProjectMapAiSummary } from './types';

export class ProjectMapMarkdownRenderer {
  render(input: { baseProjectMap: string; aiSummary: ProjectMapAiSummary }): string {
    return [
      input.baseProjectMap,
      '',
      '---',
      '',
      '# AI-Assisted Project Summary',
      '',
      '## Architecture Summary',
      '',
      input.aiSummary.summary,
      '',
      '## Risks',
      '',
      this.renderRisks(input.aiSummary.risks),
      '',
      '## Missing Pieces',
      '',
      this.renderMissingPieces(input.aiSummary.missingPieces),
      '',
      '## Recommended Next Steps',
      '',
      this.renderNextSteps(input.aiSummary.nextSteps),
    ].join('\n');
  }

  private renderRisks(risks: ProjectMapAiSummary['risks']): string {
    if (risks.length === 0) {
      return 'No risks identified from the provided evidence.';
    }
    return risks.map((risk, index) => [
      `### ${index + 1}. ${risk.title}`,
      `- Severity: ${risk.severity}`,
      `- Evidence: ${risk.evidence.join(', ') || 'None'}`,
      `- Recommendation: ${risk.recommendation}`,
    ].join('\n')).join('\n\n');
  }

  private renderMissingPieces(items: ProjectMapAiSummary['missingPieces']): string {
    if (items.length === 0) {
      return 'No missing pieces identified from the provided evidence.';
    }
    return items.map((item, index) => [
      `### ${index + 1}. ${item.title}`,
      `- Status: ${item.status}`,
      `- Evidence: ${item.evidence.join(', ') || 'None'}`,
    ].join('\n')).join('\n\n');
  }

  private renderNextSteps(steps: ProjectMapAiSummary['nextSteps']): string {
    if (steps.length === 0) {
      return 'No recommended next steps generated.';
    }
    return steps.map((step, index) => [
      `### ${index + 1}. ${step.title}`,
      `- Priority: ${step.priority}`,
      `- Reason: ${step.reason}`,
    ].join('\n')).join('\n\n');
  }
}

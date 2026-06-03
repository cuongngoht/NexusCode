export type PromptInput = {
  baseProjectMap: string;
  unitsJson: string;
  fileTree: string;
  docsSnippets?: string[];
};

export class ProjectMapSummaryPromptBuilder {
  build(input: PromptInput): string {
    return [
      'You are a software architecture analyst.',
      'Analyze the project map below.',
      '',
      'Return ONLY a valid JSON object. Do NOT wrap in markdown. Do NOT add explanation.',
      '',
      'Required JSON shape:',
      '{',
      '  "summary": "string — 2-4 sentences describing architecture and purpose",',
      '  "risks": [{ "title": string, "severity": "low"|"medium"|"high", "evidence": string[], "recommendation": string }],',
      '  "missingPieces": [{ "title": string, "evidence": string[], "status": "unknown"|"likely"|"confirmed" }],',
      '  "nextSteps": [{ "title": string, "priority": "low"|"medium"|"high", "reason": string }]',
      '}',
      '',
      '--- PROJECT MAP ---',
      input.baseProjectMap,
      '',
      '--- WORKSPACE UNITS ---',
      input.unitsJson,
      '',
      '--- FILE TREE ---',
      input.fileTree,
      ...(input.docsSnippets?.length
        ? ['', '--- DOCUMENTATION ---', ...input.docsSnippets]
        : []),
    ].join('\n').trim();
  }
}

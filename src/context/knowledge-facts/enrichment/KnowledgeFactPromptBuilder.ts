export type EnrichmentPromptInput = {
  triggerReason: string;
  contextForPrompt: string;
};

export class KnowledgeFactPromptBuilder {
  build(input: EnrichmentPromptInput): string {
    return [
      'You are a software knowledge extraction assistant for a codebase.',
      `Trigger: ${input.triggerReason}`,
      '',
      'Based on the context below, extract a small number of durable, useful facts about the',
      'project (architecture decisions, invariants, module contracts, risks, lessons learned).',
      'Only extract facts with clear support in the context — do not fabricate.',
      '',
      'Return ONLY a valid JSON object. Do NOT wrap in markdown. Do NOT add explanation.',
      '',
      'Required JSON shape:',
      '{',
      '  "facts": [',
      '    {',
      '      "kind": "architecture"|"module"|"symbol"|"contract"|"invariant"|"decision"|"risk"|"workflow"|"test"|"lesson",',
      '      "subject": "string — what this fact is about, e.g. a file path or symbol name",',
      '      "statement": "string — the assertion itself",',
      '      "confidence": "number between 0 and 1",',
      '      "evidenceExcerpt": "string — max 300 chars, quoted from the context below, no fabrication"',
      '    }',
      '  ]',
      '}',
      '',
      '--- CONTEXT ---',
      input.contextForPrompt,
    ].join('\n').trim();
  }
}

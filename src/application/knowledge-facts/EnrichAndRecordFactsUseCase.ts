import { randomUUID } from 'crypto';
import type { AgentId } from '../../core/agent';
import { ProjectMapAiRunner } from '../../infrastructure/ai/ProjectMapAiRunner';
import { AiJsonExtractor } from '../../context/project-map/summary/AiJsonExtractor';
import { KnowledgeFactPromptBuilder } from '../../context/knowledge-facts/enrichment/KnowledgeFactPromptBuilder';
import { KnowledgeFactAiValidator } from '../../context/knowledge-facts/enrichment/KnowledgeFactAiValidator';
import {
  buildCanonicalKey,
  KNOWLEDGE_FACT_SCHEMA_VERSION,
  JsonKnowledgeFactsStore,
  type IKnowledgeFactsStore,
  type KnowledgeFact,
} from '../../context/knowledge-facts';

export interface EnrichAndRecordFactsInput {
  workspaceRoot: string;
  provider: AgentId;
  triggerReason: string;
  contextForPrompt: string;
  taskId: string;
}

export interface EnrichAndRecordFactsOutput {
  factsWritten: number;
}

/**
 * Every fact produced here is forced to status:'candidate' / evidence[0].observedBy:'ai' —
 * enrichment can never mint a verified fact directly, only seed candidates that go through the
 * normal two-independent-task promotion path (PromoteKnowledgeFactUseCase). This prevents a
 * single hallucinated AI call from ever being treated as ground truth.
 *
 * Reuses ProjectMapAiRunner/AiJsonExtractor as-is rather than duplicating them — despite the
 * "ProjectMap" name, ProjectMapAiRunner has zero project-map-specific logic (it's a generic
 * "run this prompt against this provider in 'ask' mode" wrapper), and AiJsonExtractor is
 * already fully generic. This is the one and only "ask an LLM for structured JSON" mechanism
 * in this codebase — not a new one.
 */
export class EnrichAndRecordFactsUseCase {
  constructor(
    private readonly aiRunner: ProjectMapAiRunner,
    private readonly promptBuilder: KnowledgeFactPromptBuilder = new KnowledgeFactPromptBuilder(),
    private readonly extractor: AiJsonExtractor = new AiJsonExtractor(),
    private readonly validator: KnowledgeFactAiValidator = new KnowledgeFactAiValidator(),
    private readonly store: IKnowledgeFactsStore = new JsonKnowledgeFactsStore(),
  ) {}

  async execute(input: EnrichAndRecordFactsInput): Promise<EnrichAndRecordFactsOutput> {
    const prompt = this.promptBuilder.build({ triggerReason: input.triggerReason, contextForPrompt: input.contextForPrompt });

    const result = await this.aiRunner.run({ provider: input.provider, prompt });
    if (!result.succeeded) {
      return { factsWritten: 0 };
    }

    let parsed: unknown;
    try {
      parsed = this.extractor.extract(result.stdout);
    } catch {
      return { factsWritten: 0 };
    }

    let facts: ReturnType<KnowledgeFactAiValidator['validate']>;
    try {
      facts = this.validator.validate(parsed);
    } catch {
      return { factsWritten: 0 };
    }

    const now = Date.now();
    for (const f of facts) {
      const fact: KnowledgeFact = {
        version: 1,
        schemaVersion: KNOWLEDGE_FACT_SCHEMA_VERSION,
        id: randomUUID(),
        canonicalKey: buildCanonicalKey(f.kind, f.subject, f.statement),
        kind: f.kind,
        subject: f.subject,
        statement: f.statement,
        confidence: f.confidence,
        status: 'candidate',
        evidence: [{
          source: 'ai',
          taskId: input.taskId,
          timestamp: now,
          excerpt: f.evidenceExcerpt,
          observedBy: 'ai',
        }],
        createdAt: now,
        updatedAt: now,
        workspaceRoot: input.workspaceRoot,
      };
      await this.store.write(input.workspaceRoot, fact);
    }

    return { factsWritten: facts.length };
  }
}

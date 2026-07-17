import type { KnowledgeFact } from './types';
import type { IKnowledgeFactsStore } from './KnowledgeFactsStore';
import { JsonKnowledgeFactsStore } from './JsonKnowledgeFactsStore';

export class KnowledgeFactsLoader {
  constructor(private readonly store: IKnowledgeFactsStore = new JsonKnowledgeFactsStore()) {}

  async loadAll(workspaceRoot: string): Promise<KnowledgeFact[]> {
    const entries = await this.store.listAll(workspaceRoot);
    const facts: KnowledgeFact[] = [];
    for (const entry of entries) {
      const fact = await this.store.read(workspaceRoot, entry.canonicalKey);
      if (fact) facts.push(fact);
    }
    return facts;
  }
}

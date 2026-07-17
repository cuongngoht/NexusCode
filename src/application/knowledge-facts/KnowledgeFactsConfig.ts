import * as vscode from 'vscode';
import type { RiskLevel } from './EnrichmentTriggerEvaluator';

export interface KnowledgeFactsConfig {
  enrichmentEnabled: boolean;
  maxEnrichmentCallsPerDay: number;
  minRiskToEnrich: RiskLevel;
  retention: {
    maxEvidencePerFact: number;
    maxEvidenceAgeDays: number;
    staleCleanupDays: number;
  };
}

/**
 * Follows the autoReview convention (direct vscode.workspace.getConfiguration read, not
 * NexusConfig/DefaultConfig.ts) since this is per-workspace-settings-like config (enable/disable,
 * budget), not part of the routing/model config surface NexusConfig centralizes.
 */
export function readKnowledgeFactsConfig(): KnowledgeFactsConfig {
  const cfg = vscode.workspace.getConfiguration('nexus');
  return {
    enrichmentEnabled: cfg.get<boolean>('knowledgeFacts.enrichmentEnabled', false),
    maxEnrichmentCallsPerDay: cfg.get<number>('knowledgeFacts.maxEnrichmentCallsPerDay', 5),
    minRiskToEnrich: cfg.get<RiskLevel>('knowledgeFacts.minRiskToEnrich', 'medium'),
    retention: {
      maxEvidencePerFact: cfg.get<number>('knowledgeFacts.retention.maxEvidencePerFact', 500),
      maxEvidenceAgeDays: cfg.get<number>('knowledgeFacts.retention.maxEvidenceAgeDays', 180),
      staleCleanupDays: cfg.get<number>('knowledgeFacts.retention.staleCleanupDays', 90),
    },
  };
}

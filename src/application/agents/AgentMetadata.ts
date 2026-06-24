export type AgentPurpose =
  | 'code_review'
  | 'security_review'
  | 'architecture_review'
  | 'test_review'
  | 'implementation'
  | 'planning'
  | 'research'
  | 'general'
  | 'unknown';

export type ReviewTargetKind =
  | 'branch'
  | 'working-tree'
  | 'staged'
  | 'file'
  | 'selection';

export interface AgentMetadata {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  purpose?: AgentPurpose;
  capabilities?: string[];
  reviewTargets?: ReviewTargetKind[];
  requiresExplicitTarget?: boolean;
  sourcePath?: string;
  sourceKind?: 'file' | 'folder-index';
}

/** Defaults applied when metadata fields are missing. */
export function applyMetadataDefaults(meta: AgentMetadata): Required<AgentMetadata> {
  const isReviewPurpose =
    meta.purpose === 'code_review' ||
    meta.purpose === 'security_review' ||
    meta.purpose === 'architecture_review' ||
    meta.purpose === 'test_review';

  return {
    id: meta.id,
    name: meta.name,
    displayName: meta.displayName ?? meta.name,
    description: meta.description ?? '',
    purpose: meta.purpose ?? 'unknown',
    capabilities: meta.capabilities ?? [],
    reviewTargets: meta.reviewTargets ?? (isReviewPurpose ? ['branch', 'working-tree', 'staged', 'file', 'selection'] : []),
    requiresExplicitTarget: meta.requiresExplicitTarget ?? (isReviewPurpose ? true : false),
    sourcePath: meta.sourcePath ?? '',
    sourceKind: meta.sourceKind ?? 'file',
  };
}

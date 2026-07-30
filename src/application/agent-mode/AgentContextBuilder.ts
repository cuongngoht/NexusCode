/**
 * Project-knowledge context for Agent Mode.
 *
 * Populated by the `scan_project` step (via RunAgentModeInput.buildProjectContext)
 * and injected into the planner, editor, and reviewer prompts so Agent Mode
 * applies the same project rules / knowledge base / best practices as the
 * normal task flow (see buildEnhancedPrompt in src/context/promptBuilder.ts).
 */
export interface AgentProjectContext {
  /** Workspace name/root/branch + package manager/frameworks/scripts. */
  workspaceInfo?: string;
  /** Project rules from .nexus/rules.md. */
  rules?: string;
  /** Project map from .nexus/discovery/*. */
  projectMap?: string;
  /** Persisted project map from .nexus/project-understanding/ (authored by understand mode). */
  projectUnderstandingContext?: string;
  architectureContext?: string;
  knowledgeBaseContext?: string;
  knowledgeFactsContext?: string;
  fileIntelligenceContext?: string;
}

/** Which sections to include — planner gets everything, edit/review a subset. */
export type AgentContextSectionKey = keyof AgentProjectContext;

const SECTION_ORDER: Array<{ key: AgentContextSectionKey; header: string }> = [
  { key: 'workspaceInfo', header: '# Workspace' },
  { key: 'rules', header: '# Project Rules' },
  { key: 'projectUnderstandingContext', header: '# Project Understanding' },
  { key: 'projectMap', header: '# Project Map' },
  { key: 'architectureContext', header: '# Architecture Context' },
  { key: 'knowledgeBaseContext', header: '# Project Knowledge Base' },
  { key: 'knowledgeFactsContext', header: '# Knowledge Facts' },
  { key: 'fileIntelligenceContext', header: '# File Intelligence' },
];

const DEFAULT_MAX_SECTION_CHARS = 8_000;

export interface FormatProjectContextOptions {
  /** Restrict output to these sections (default: all, in SECTION_ORDER order). */
  include?: AgentContextSectionKey[];
  /** Per-section character cap to keep prompts bounded. */
  maxSectionChars?: number;
}

export function formatProjectContextSections(
  ctx: AgentProjectContext | undefined,
  opts: FormatProjectContextOptions = {},
): string {
  if (!ctx) return '';

  const maxChars = opts.maxSectionChars ?? DEFAULT_MAX_SECTION_CHARS;
  const include = opts.include ? new Set(opts.include) : undefined;

  const parts: string[] = [];
  for (const { key, header } of SECTION_ORDER) {
    if (include && !include.has(key)) continue;
    const raw = ctx[key];
    if (!raw || !raw.trim()) continue;
    let content = raw.trim();
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + '\n…(truncated)';
    }
    parts.push(header + '\n' + content);
  }

  return parts.join('\n\n');
}

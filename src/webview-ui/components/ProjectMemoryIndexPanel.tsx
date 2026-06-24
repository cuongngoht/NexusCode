import { useState } from 'react';
import { useT, interp } from '../i18n';
import type { ProjectMemoryDocumentView, ProjectMemoryIndexStatsView } from '../messages';

interface Props {
  documents?: ProjectMemoryDocumentView[];
  stats?: ProjectMemoryIndexStatsView;
  onClose: () => void;
}

type SourceFilter = 'all' | 'project-map' | 'workspace-units' | 'discovery';

function formatAge(builtAt: number): string {
  if (!builtAt) return '';
  const diffMs = Date.now() - builtAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '< 1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function ProjectMemoryIndexPanel({ documents, stats, onClose }: Props) {
  const t = useT();
  const pm = t.projectMemory as Record<string, unknown>;
  const idx = pm.index as Record<string, unknown>;
  const sources = idx.sources as Record<string, string>;

  const [filter, setFilter] = useState<SourceFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isLoading = documents === undefined;
  const filtered = documents
    ? (filter === 'all' ? documents : documents.filter(d => d.source === filter))
    : [];

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sourceCounts = documents
    ? (['project-map', 'workspace-units', 'discovery'] as const).reduce<Record<string, number>>(
        (acc, s) => ({ ...acc, [s]: documents.filter(d => d.source === s).length }),
        {},
      )
    : {};

  return (
    <div className="nx-pm-index-panel" role="region" aria-label={String(idx.title)}>
      <div className="nx-pm-index-header">
        <span className="nx-pm-index-title">{String(idx.title)}</span>
        {stats && stats.builtAt > 0 && (
          <span className="nx-pm-index-meta">
            {interp(String(idx.chunks), { count: stats.totalDocs })}{' · '}
            {interp(String(idx.avgLen), { chars: stats.avgDocLength })}{' · '}
            {interp(String(idx.builtAt), { time: formatAge(stats.builtAt) })}
          </span>
        )}
        <button className="nx-pm-index-close" onClick={onClose} title={String(idx.close)}>✕</button>
      </div>

      {isLoading ? (
        <div className="nx-pm-index-loading">…</div>
      ) : documents!.length === 0 ? (
        <div className="nx-pm-index-empty">{String(idx.noIndex)}</div>
      ) : (
        <>
          <div className="nx-pm-index-filters" role="tablist">
            {(['all', 'project-map', 'workspace-units', 'discovery'] as SourceFilter[]).map(src => {
              const label = src === 'all' ? 'All' : (sources[src] ?? src);
              const count = src === 'all' ? documents!.length : (sourceCounts[src] ?? 0);
              return (
                <button
                  key={src}
                  role="tab"
                  aria-selected={filter === src}
                  className={`nx-pm-index-filter-btn${filter === src ? ' active' : ''}`}
                  onClick={() => setFilter(src)}
                >
                  {label} <span className="nx-pm-index-filter-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="nx-pm-index-list">
            {filtered.map(doc => {
              const isOpen = expanded.has(doc.id);
              return (
                <div key={doc.id} className="nx-pm-index-chunk">
                  <button
                    className="nx-pm-index-chunk-header"
                    onClick={() => toggleExpand(doc.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={`nx-pm-index-source-badge nx-pm-src-${doc.source}`}>
                      {sources[doc.source] ?? doc.source}
                    </span>
                    <span className="nx-pm-index-section">{doc.section}</span>
                    <span className="nx-pm-index-chevron">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <pre className="nx-pm-index-content">{doc.content}</pre>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

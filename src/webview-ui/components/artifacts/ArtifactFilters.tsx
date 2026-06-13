import type { ArtifactKind } from '../../messages';

interface Props {
  selectedKind?: ArtifactKind | 'all';
  onKindChange: (kind: ArtifactKind | 'all') => void;
}

const KINDS: Array<ArtifactKind | 'all'> = ['all', 'plan', 'markdown', 'image', 'json', 'log', 'file'];

export function ArtifactFilters({ selectedKind = 'all', onKindChange }: Props) {
  return (
    <div className="nx-artifact-filters">
      {KINDS.map(k => (
        <button
          key={k}
          type="button"
          className={`nx-artifact-filter-btn ${selectedKind === k ? 'nx-artifact-filter-btn--active' : ''}`}
          onClick={() => onKindChange(k)}
          aria-pressed={selectedKind === k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

import type { FileDiffSummary } from '../../messages';
import { DiffStats } from './DiffStats';

interface Props {
  diffs: FileDiffSummary[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

export function DiffFileList({ diffs, selectedPath, onSelect }: Props) {
  return (
    <div className="nx-diff-file-list">
      {diffs.map(d => (
        <button
          key={d.path}
          type="button"
          className={`nx-diff-file-item ${selectedPath === d.path ? 'nx-diff-file-item--active' : ''}`}
          onClick={() => onSelect(d.path)}
          aria-pressed={selectedPath === d.path}
        >
          <span className={`nx-diff-file-status nx-diff-status-badge--${d.status}`}>{d.status[0].toUpperCase()}</span>
          <span className="nx-diff-file-path">{d.path}</span>
          <DiffStats additions={d.additions} deletions={d.deletions} />
        </button>
      ))}
    </div>
  );
}

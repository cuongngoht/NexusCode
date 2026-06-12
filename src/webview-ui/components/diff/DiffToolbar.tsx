import type { FileDiffSummary } from '../../messages';
import { getVsCodeApi } from '../../vscodeApi';
import { DiffStats } from './DiffStats';

interface Props {
  diff: FileDiffSummary;
  onClose?: () => void;
}

export function DiffToolbar({ diff, onClose }: Props) {
  const handleOpenEditor = () => {
    getVsCodeApi().postMessage({ type: 'openDiffEditor', path: diff.path });
  };
  const handleOpenFile = () => {
    getVsCodeApi().postMessage({ type: 'openFileFromDiff', path: diff.path });
  };
  const handleRevert = () => {
    if (window.confirm(`Revert changes to ${diff.path}?`)) {
      getVsCodeApi().postMessage({ type: 'revertFileChange', path: diff.path });
    }
  };

  return (
    <div className="nx-diff-toolbar">
      <span className="nx-diff-toolbar-path">{diff.path}</span>
      <span className={`nx-diff-status-badge nx-diff-status-badge--${diff.status}`}>{diff.status}</span>
      <DiffStats additions={diff.additions} deletions={diff.deletions} />
      <div className="nx-diff-toolbar-actions">
        <button type="button" className="nx-diff-btn" onClick={handleOpenFile} title="Open file" aria-label="Open file">↗</button>
        <button type="button" className="nx-diff-btn" onClick={handleOpenEditor} title="Open in VS Code diff editor" aria-label="Open in VS Code diff editor">⊞</button>
        <button type="button" className="nx-diff-btn nx-diff-btn--danger" onClick={handleRevert} title="Revert changes" aria-label="Revert file changes">↩</button>
        {onClose && <button type="button" className="nx-diff-btn" onClick={onClose} aria-label="Close diff">✕</button>}
      </div>
    </div>
  );
}

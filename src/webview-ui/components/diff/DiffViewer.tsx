import type { FileDiffSummary } from '../../messages';
import { DiffHunkView } from './DiffHunk';
import { DiffToolbar } from './DiffToolbar';

interface Props {
  diff: FileDiffSummary;
  onClose?: () => void;
}

export function DiffViewer({ diff, onClose }: Props) {
  if (diff.isBinary) {
    return (
      <div className="nx-diff-viewer">
        <DiffToolbar diff={diff} onClose={onClose} />
        <div className="nx-diff-binary-notice">Binary file — cannot show diff</div>
      </div>
    );
  }

  if (diff.isTooLarge) {
    return (
      <div className="nx-diff-viewer">
        <DiffToolbar diff={diff} onClose={onClose} />
        <div className="nx-diff-toolarge-notice">
          Diff is too large to display inline.
          <button
            type="button"
            className="nx-diff-btn"
            onClick={() => {
              import('../../vscodeApi').then(({ getVsCodeApi }) => {
                getVsCodeApi().postMessage({ type: 'openDiffEditor', path: diff.path });
              });
            }}
          >
            Open in VS Code Diff Editor
          </button>
        </div>
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="nx-diff-viewer">
        <DiffToolbar diff={diff} onClose={onClose} />
        <div className="nx-diff-empty-notice">No changes</div>
      </div>
    );
  }

  return (
    <div className="nx-diff-viewer">
      <DiffToolbar diff={diff} onClose={onClose} />
      <div className="nx-diff-content">
        <table className="nx-diff-table">
          {diff.hunks.map(hunk => (
            <DiffHunkView key={hunk.id} hunk={hunk} />
          ))}
        </table>
      </div>
    </div>
  );
}

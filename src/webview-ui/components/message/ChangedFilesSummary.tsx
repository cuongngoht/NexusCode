import type { GitFileChange } from '../../messages';

interface Props {
  changes: GitFileChange[];
  onOpenFile?: (path: string) => void;
}

const STATUS_ICON: Record<string, string> = {
  M: '✏️', A: '✚', D: '✖', R: '↻', '?': '?',
};

export function ChangedFilesSummary({ changes, onOpenFile }: Props) {
  if (changes.length === 0) return null;

  return (
    <div className="nx-changed-files">
      <div className="nx-changed-files-header">
        Changed files ({changes.length})
      </div>
      <ul className="nx-changed-files-list">
        {changes.map((f, i) => (
          <li key={i} className="nx-changed-file-item">
            <span className="nx-changed-file-status">{STATUS_ICON[f.status] ?? f.status}</span>
            <button
              type="button"
              className="nx-changed-file-path"
              onClick={() => onOpenFile?.(f.path)}
              title={`Open ${f.path}`}
            >
              {f.path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { GitChange } from '../messages';
import { IconBranch, IconClose } from '../NexusIcons';

interface Props {
  changes: GitChange[];
  message: string | undefined;
  onOpenScm: () => void;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  M: 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)',
  A: 'var(--vscode-gitDecoration-addedResourceForeground, #89d185)',
  D: 'var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)',
  R: 'var(--vscode-gitDecoration-renamedResourceForeground, #73c6e7)',
  U: 'var(--vscode-gitDecoration-untrackedResourceForeground, #73c6e7)',
};

export function GitStatusPanel({ changes, message, onOpenScm, onClose }: Props) {
  return (
    <section className="nx-git" aria-label="Changed files">
      <div className="nx-git-header">
        <span className="nx-git-title">Changed files</span>
        <button
          type="button"
          className="fl-iconbtn"
          style={{ width: 22, height: 22 }}
          onClick={onClose}
          aria-label="Close"
        >
          <IconClose size={13} />
        </button>
      </div>

      {changes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--colorNeutralForeground4)', fontStyle: 'italic', margin: '0 0 8px' }}>
          {message ?? 'No changes.'}
        </p>
      ) : (
        <ul className="nx-git-list">
          {changes.map((c, i) => (
            <li key={i} className="nx-git-item">
              <span
                className="nx-git-status"
                style={{ color: STATUS_COLOR[c.status] ?? 'inherit' }}
              >
                {c.status}
              </span>
              <span className="nx-git-path">{c.path}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="nx-git-scm-btn" onClick={onOpenScm}>
        <IconBranch size={14} />
        Open Source Control
      </button>
    </section>
  );
}

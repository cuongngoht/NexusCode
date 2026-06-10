import type { GitFileChange } from '../messages';
import { IconBranch, IconClose, IconAdd } from '../NexusIcons';
import { useT } from '../i18n';

interface Props {
  changes: GitFileChange[];
  message: string | undefined;
  onOpenScm: () => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onAttachFile: (path: string) => void;
  onAttachAll: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  M: 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)',
  A: 'var(--vscode-gitDecoration-addedResourceForeground, #89d185)',
  D: 'var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)',
  R: 'var(--vscode-gitDecoration-renamedResourceForeground, #73c6e7)',
  U: 'var(--vscode-gitDecoration-untrackedResourceForeground, #73c6e7)',
};

const fileBasename = (p: string) => p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p;
const fileDirname  = (p: string) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

export function GitStatusPanel({ changes, message, onOpenScm, onClose, onOpenFile, onAttachFile, onAttachAll }: Props) {
  const t = useT();
  return (
    <section className="nx-git" aria-label={t.git.changedFiles}>
      <div className="nx-git-header">
        <span className="nx-git-title">{t.git.changedFiles}</span>
        {changes.length > 0 && (
          <span className="nx-git-count">{changes.length}</span>
        )}
        <button
          type="button"
          className="fl-iconbtn nx-git-close-btn"
          onClick={onClose}
          aria-label={t.git.close}
        >
          <IconClose size={13} />
        </button>
      </div>

      {changes.length === 0 ? (
        <p className="nx-git-empty">
          {message ?? t.git.noChanges}
        </p>
      ) : (
        <ul className="nx-git-list">
          {changes.map((c, i) => {
            const statusChar = c.status[0] ?? c.status;
            const name = fileBasename(c.path);
            const dir  = fileDirname(c.path);
            return (
              <li key={i} className="nx-git-item">
                <button
                  type="button"
                  className="nx-git-file-btn"
                  onClick={() => onOpenFile(c.path)}
                  title={c.path}
                >
                  <span
                    className="nx-git-status"
                    style={{ color: STATUS_COLOR[statusChar] ?? 'inherit' }}
                  >
                    {statusChar}
                  </span>
                  <span className="nx-git-name">{name}</span>
                  {dir && <span className="nx-git-dir">{dir}</span>}
                </button>
                <button
                  type="button"
                  className="nx-git-attach-btn"
                  title={t.git.attachFile}
                  onClick={() => onAttachFile(c.path)}
                >
                  <IconAdd size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="nx-git-actions">
        {changes.length > 0 && (
          <button type="button" className="nx-git-attach-all-btn" onClick={onAttachAll}>
            <IconAdd size={13} />
            {t.git.attachAll}
          </button>
        )}
        <button type="button" className="nx-git-scm-btn" onClick={onOpenScm}>
          <IconBranch size={14} />
          {t.git.openScm}
        </button>
      </div>
    </section>
  );
}

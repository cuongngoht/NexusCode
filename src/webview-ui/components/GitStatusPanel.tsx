import { useState } from 'react';
import type { GitFileChange } from '../messages';
import { IconBranch, IconClose, IconAdd } from '../NexusIcons';
import { useT } from '../i18n';
import { getVsCodeApi } from '../vscodeApi';

interface Props {
  changes: GitFileChange[];
  message: string | undefined;
  onOpenScm: () => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onAttachFile: (path: string) => void;
  onAttachAll: () => void;
}

type FileGroup = {
  label: string;
  statusCodes: string[];
  files: GitFileChange[];
};

function groupChanges(changes: GitFileChange[]): FileGroup[] {
  const groups: FileGroup[] = [
    { label: 'Modified', statusCodes: ['M'], files: [] },
    { label: 'Created / Untracked', statusCodes: ['A', '?', 'U'], files: [] },
    { label: 'Deleted', statusCodes: ['D'], files: [] },
    { label: 'Renamed', statusCodes: ['R'], files: [] },
  ];
  const other: GitFileChange[] = [];
  for (const change of changes) {
    const statusChar = change.status[0] ?? change.status;
    const group = groups.find(g => g.statusCodes.includes(statusChar));
    if (group) group.files.push(change);
    else other.push(change);
  }
  const result = groups.filter(g => g.files.length > 0);
  if (other.length > 0) result.push({ label: 'Other', statusCodes: [], files: other });
  return result;
}

function copyPath(path: string) {
  navigator.clipboard.writeText(path).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = path;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function FileChangeCard({
  change,
  onOpen,
  onAttach,
}: {
  change: GitFileChange;
  onOpen: (p: string) => void;
  onAttach: (p: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const filename = change.path.split('/').pop() ?? change.path;
  const dir = change.path.includes('/') ? change.path.slice(0, change.path.lastIndexOf('/')) : '';
  const statusChar = change.status[0] ?? change.status;

  const handleCopy = () => {
    copyPath(change.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="nx-file-card">
      <span className={`nx-file-card-status nx-file-status-${statusChar}`}>{statusChar}</span>
      <div className="nx-file-card-info">
        <span className="nx-file-card-name">{filename}</span>
        {dir && <span className="nx-file-card-dir">{dir}</span>}
      </div>
      <div className="nx-file-card-actions">
        <button
          type="button"
          className="nx-file-action-btn"
          onClick={() => onOpen(change.path)}
          title="Open file"
          aria-label="Open file"
        >↗</button>
        <button
          type="button"
          className="nx-file-action-btn"
          onClick={() => getVsCodeApi().postMessage({ type: 'openDiffEditor', path: change.path })}
          title="View diff"
          aria-label="View diff"
        >⊞</button>
        <button
          type="button"
          className="nx-file-action-btn"
          onClick={() => onAttach(change.path)}
          title="Attach to chat"
          aria-label="Attach to chat"
        >⊕</button>
        <button
          type="button"
          className="nx-file-action-btn"
          onClick={handleCopy}
          title="Copy path"
          aria-label="Copy path"
        >{copied ? '✓' : '⧉'}</button>
      </div>
    </div>
  );
}

export function GitStatusPanel({ changes, message, onOpenScm, onClose, onOpenFile, onAttachFile, onAttachAll }: Props) {
  const t = useT();
  return (
    <section className="nx-git" aria-label={t.git.changedFiles}>
      <div className="nx-git-header">
        <span className="nx-git-title">{t.git.changedFiles} ({changes.length})</span>
        <div className="nx-git-header-actions">
          {changes.length > 0 && (
            <button
              type="button"
              className="nx-git-scm-btn"
              onClick={() => getVsCodeApi().postMessage({ type: 'getAllDiffs' })}
            >
              All Diffs
            </button>
          )}
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
          <button
            type="button"
            className="fl-iconbtn nx-git-close-btn"
            onClick={onClose}
            aria-label={t.git.close}
          >
            <IconClose size={13} />
          </button>
        </div>
      </div>

      {changes.length === 0 ? (
        <p className="nx-git-empty">
          {message ?? t.git.noChanges}
        </p>
      ) : (
        <div className="nx-git-groups">
          {groupChanges(changes).map(group => (
            <div key={group.label} className="nx-git-group">
              <div className="nx-git-group-label">{group.label} ({group.files.length})</div>
              {group.files.map((change, i) => (
                <FileChangeCard
                  key={`${change.path}-${i}`}
                  change={change}
                  onOpen={onOpenFile}
                  onAttach={onAttachFile}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

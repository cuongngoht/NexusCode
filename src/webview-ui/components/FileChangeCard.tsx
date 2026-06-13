import { getVsCodeApi } from '../vscodeApi';
import { useT } from '../i18n';

interface FileChangeCardProps {
  path: string;
  changeType: 'modified' | 'added' | 'deleted';
}

const CHANGE_TYPE_CLASS = {
  modified: 'nx-file-change--modified',
  added: 'nx-file-change--added',
  deleted: 'nx-file-change--deleted',
} as const;

export function FileChangeCard({ path, changeType }: FileChangeCardProps) {
  const t = useT();
  const badgeLabel = t.fileChange[changeType];

  function handleClick() {
    getVsCodeApi().postMessage({ type: 'getFileDiff', path });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      className={`nx-file-change ${CHANGE_TYPE_CLASS[changeType]}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={t.fileChange.openDiff}
      aria-label={`${badgeLabel}: ${path}`}
    >
      <span className="nx-file-change__badge">{badgeLabel}</span>
      <span className="nx-file-change__path">{path}</span>
    </div>
  );
}

import { makeStyles, Button } from '@fluentui/react-components';
import { BranchForkRegular, DismissRegular } from '@fluentui/react-icons';
import type { GitChange } from '../messages';

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

const useStyles = makeStyles({
  panel: {
    marginTop: '4px',
    padding: '8px 10px',
    background: 'var(--vscode-sideBar-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
  },
  title: {
    flex: '1',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--vscode-descriptionForeground)',
  },
  closeBtn: {
    minWidth: 'unset',
    padding: '2px',
    height: '18px',
    width: '18px',
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-descriptionForeground)',
    '&:hover': { background: 'var(--vscode-toolbar-hoverBackground)' },
  },
  list: {
    listStyle: 'none',
    margin: '0 0 6px',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
  },
  statusChar: {
    fontWeight: '700',
    minWidth: '12px',
    flexShrink: '0',
  },
  path: {
    color: 'var(--vscode-editor-foreground)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyText: {
    fontSize: '12px',
    fontStyle: 'italic',
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '6px',
  },
  scmBtn: {
    fontSize: '11px',
    color: 'var(--vscode-button-secondaryForeground)',
    background: 'var(--vscode-button-secondaryBackground)',
    border: 'none',
    '&:hover': { background: 'var(--vscode-button-secondaryHoverBackground)' },
  },
});

export function GitStatusPanel({ changes, message, onOpenScm, onClose }: Props) {
  const styles = useStyles();
  return (
    <section className={styles.panel} aria-label="Changed files">
      <div className={styles.header}>
        <span className={styles.title}>Changed files</span>
        <Button appearance="subtle" size="small" icon={<DismissRegular />}
          className={styles.closeBtn} onClick={onClose} aria-label="Close" />
      </div>

      {changes.length === 0 ? (
        <p className={styles.emptyText}>{message ?? 'No changes.'}</p>
      ) : (
        <ul className={styles.list}>
          {changes.map((c, i) => (
            <li key={i} className={styles.item}>
              <span className={styles.statusChar} style={{ color: STATUS_COLOR[c.status] ?? 'inherit' }}>
                {c.status}
              </span>
              <span className={styles.path}>{c.path}</span>
            </li>
          ))}
        </ul>
      )}

      <Button appearance="secondary" size="small" icon={<BranchForkRegular />}
        className={styles.scmBtn} onClick={onOpenScm}>
        Open Source Control
      </Button>
    </section>
  );
}

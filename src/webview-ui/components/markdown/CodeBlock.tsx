import { CopyButton } from './CopyButton';
import { useCodeBlockActions } from './CodeBlockActionsContext';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i, /sudo\s/i, /chmod\s/i, /chown\s/i,
  /curl[^|]*\|\s*sh/i, /wget[^|]*\|\s*sh/i,
  /\bdd\s+if=/i, /\bmkfs\b/i,
  /git\s+reset\s+--hard/i, /git\s+clean\s+-[ffd]+/i,
  /docker\s+system\s+prune/i,
];

function isDangerous(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(cmd));
}

interface Props {
  language?: string;
  filename?: string;
  rawText: string;
  children: React.ReactNode;
}

export function CodeBlock({ language, filename, rawText, children }: Props) {
  const actions = useCodeBlockActions();
  const isShell = /^(bash|sh|zsh|shell|fish|console)$/i.test(language ?? '');

  return (
    <div className="nx-code-block">
      <div className="nx-code-block-header">
        <span className="nx-code-block-lang">{filename ?? language ?? 'text'}</span>
        <div className="nx-cb-action-group">
          {actions.onInsertIntoFile && (
            <button
              type="button"
              className="nx-cb-action-btn"
              title="Insert into active file"
              aria-label="Insert into active file"
              onClick={() => actions.onInsertIntoFile!(rawText, language ?? '')}
            >
              ↙
            </button>
          )}
          {actions.onCreateFile && (
            <button
              type="button"
              className="nx-cb-action-btn"
              title="Create file"
              aria-label="Create file from code"
              onClick={() => actions.onCreateFile!(rawText, language ?? '')}
            >
              +
            </button>
          )}
          {isShell && actions.onRunCommand && (
            <button
              type="button"
              className={`nx-cb-action-btn${isDangerous(rawText) ? ' nx-cb-action-btn--warn' : ''}`}
              title={isDangerous(rawText) ? '⚠ Potentially destructive — click to run' : 'Run command'}
              aria-label="Run command"
              onClick={() => {
                const cmd = rawText.trim();
                if (isDangerous(cmd)) {
                  if (!window.confirm(`⚠ Potentially destructive command:\n\n${cmd}\n\nRun anyway?`)) return;
                }
                actions.onRunCommand!(cmd);
              }}
            >
              ▶
            </button>
          )}
          {actions.onSaveAsArtifact && (
            <button
              type="button"
              className="nx-cb-action-btn"
              title="Save to Artifacts"
              aria-label="Save code as artifact"
              onClick={() => actions.onSaveAsArtifact!(rawText, language ?? '')}
            >
              ⊚
            </button>
          )}
          <CopyButton text={rawText} className="nx-code-block-copy" />
        </div>
      </div>
      <pre className={`nx-code-pre ${language ? `language-${language}` : ''}`}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

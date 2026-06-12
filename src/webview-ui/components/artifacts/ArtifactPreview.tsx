import { MarkdownRenderer } from '../markdown/MarkdownRenderer';

interface Props {
  artifactId: string;
  content?: string;
  mimeType?: string;
  truncated?: boolean;
  onClose: () => void;
}

export function ArtifactPreview({ content, mimeType, truncated, onClose }: Props) {
  const renderContent = () => {
    if (!content) {
      return <span className="nx-text-muted">No preview available</span>;
    }
    if (mimeType === 'text/markdown') {
      return <MarkdownRenderer content={content} />;
    }
    if (mimeType === 'application/json') {
      let formatted = content;
      try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch { /* use raw */ }
      return <pre className="nx-code-pre">{formatted}</pre>;
    }
    return <pre className="nx-code-pre">{content}</pre>;
  };

  return (
    <div className="nx-artifact-preview">
      <div className="nx-artifact-preview-header">
        <span className="nx-artifact-preview-title">Preview</span>
        {truncated && <span className="nx-artifact-preview-truncated">Truncated — file too large</span>}
        <button type="button" className="nx-artifact-btn" onClick={onClose} aria-label="Close preview">✕</button>
      </div>
      <div className="nx-artifact-preview-content">
        {renderContent()}
      </div>
    </div>
  );
}

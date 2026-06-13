import type { ArtifactRef } from '../../messages';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  artifact: ArtifactRef;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}

const KIND_ICON: Record<string, string> = {
  plan: '📋', markdown: '📄', image: '🖼', json: '{}', patch: '⊞',
  log: '📃', html: '🌐', file: '📁', chart: '📊', 'test-report': '✅', unknown: '?',
};

export function ArtifactCard({ artifact, onPreview, onDelete }: Props) {
  const handleOpen = () => getVsCodeApi().postMessage({ type: 'openArtifact', artifactId: artifact.id });
  const handleReveal = () => getVsCodeApi().postMessage({ type: 'revealArtifactInExplorer', artifactId: artifact.id });
  const handleDelete = () => {
    if (window.confirm(`Delete artifact "${artifact.title}"?`)) {
      onDelete(artifact.id);
      getVsCodeApi().postMessage({ type: 'deleteArtifact', artifactId: artifact.id });
    }
  };

  return (
    <div className="nx-artifact-card">
      <div className="nx-artifact-card-header">
        <span className="nx-artifact-kind-icon" aria-hidden="true">{KIND_ICON[artifact.kind] ?? '?'}</span>
        <span className="nx-artifact-title" title={artifact.title}>{artifact.title}</span>
      </div>
      {artifact.description && <p className="nx-artifact-desc">{artifact.description}</p>}
      <div className="nx-artifact-meta">
        <span className="nx-artifact-kind-badge">{artifact.kind}</span>
        {artifact.sizeBytes !== undefined && (
          <span className="nx-artifact-size">{(artifact.sizeBytes / 1024).toFixed(1)}KB</span>
        )}
      </div>
      <div className="nx-artifact-actions">
        {artifact.previewable && (
          <button type="button" className="nx-artifact-btn" onClick={() => onPreview(artifact.id)} aria-label="Preview">👁</button>
        )}
        <button type="button" className="nx-artifact-btn" onClick={handleOpen} aria-label="Open in editor">↗</button>
        <button type="button" className="nx-artifact-btn" onClick={handleReveal} aria-label="Reveal in explorer">📂</button>
        <button type="button" className="nx-artifact-btn nx-artifact-btn--danger" onClick={handleDelete} aria-label="Delete artifact">🗑</button>
      </div>
    </div>
  );
}

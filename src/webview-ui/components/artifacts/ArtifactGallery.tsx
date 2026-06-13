import { useState, useCallback } from 'react';
import type { ArtifactRef, ArtifactKind, ArtifactPreviewData } from '../../messages';
import { ArtifactCard } from './ArtifactCard';
import { ArtifactFilters } from './ArtifactFilters';
import { ArtifactPreview } from './ArtifactPreview';
import { ArtifactToolbar } from './ArtifactToolbar';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  artifacts: ArtifactRef[];
  preview?: ArtifactPreviewData;
  onRequestPreview: (artifactId: string) => void;
  onDeleteArtifact: (artifactId: string) => void;
  onRescan: () => void;
}

export function ArtifactGallery({ artifacts, preview, onRequestPreview, onDeleteArtifact, onRescan }: Props) {
  const [kindFilter, setKindFilter] = useState<ArtifactKind | 'all'>('all');
  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePreview = useCallback((id: string) => {
    onRequestPreview(id);
    getVsCodeApi().postMessage({ type: 'previewArtifact', artifactId: id });
    setPreviewOpen(true);
  }, [onRequestPreview]);

  const filtered = kindFilter === 'all' ? artifacts : artifacts.filter(a => a.kind === kindFilter);

  return (
    <div className="nx-artifact-gallery">
      <ArtifactToolbar onRescan={onRescan} />
      <ArtifactFilters selectedKind={kindFilter} onKindChange={setKindFilter} />
      {previewOpen && preview && (
        <ArtifactPreview
          artifactId={preview.artifactId}
          content={preview.content}
          mimeType={preview.mimeType}
          truncated={preview.truncated}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {filtered.length === 0 ? (
        <div className="nx-artifact-empty">No artifacts yet</div>
      ) : (
        <div className="nx-artifact-grid">
          {filtered.map(a => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              onPreview={handlePreview}
              onDelete={onDeleteArtifact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

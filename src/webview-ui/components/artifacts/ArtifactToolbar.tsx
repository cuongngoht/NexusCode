interface Props {
  onRescan: () => void;
}

export function ArtifactToolbar({ onRescan }: Props) {
  return (
    <div className="nx-artifact-toolbar">
      <span className="nx-artifact-toolbar-title">Artifacts</span>
      <button type="button" className="nx-artifact-btn" onClick={onRescan} aria-label="Rescan workspace for artifacts" title="Rescan">⟳</button>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function NexusSecondaryPanel({ isOpen, onClose, children, title }: Props) {
  if (!isOpen) return null;
  return (
    <div className="nx-secondary-panel" role="complementary" aria-label={title ?? 'Secondary panel'}>
      <div className="nx-secondary-panel-header">
        {title && <span className="nx-secondary-panel-title">{title}</span>}
        <button
          type="button"
          className="nx-secondary-panel-close"
          aria-label="Close panel"
          onClick={onClose}
        >
          &#x2715;
        </button>
      </div>
      <div className="nx-secondary-panel-content">{children}</div>
    </div>
  );
}

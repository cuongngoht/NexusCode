interface Props {
  children?: React.ReactNode;
}

export function NexusStatusStrip({ children }: Props) {
  return (
    <div className="nx-status-strip" role="status" aria-label="Status">
      {children}
    </div>
  );
}

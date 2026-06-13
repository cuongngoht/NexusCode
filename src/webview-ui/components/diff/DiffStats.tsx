interface Props {
  additions: number;
  deletions: number;
}

export function DiffStats({ additions, deletions }: Props) {
  return (
    <span className="nx-diff-stats">
      <span className="nx-diff-stats-add">+{additions}</span>
      {' '}
      <span className="nx-diff-stats-del">−{deletions}</span>
    </span>
  );
}

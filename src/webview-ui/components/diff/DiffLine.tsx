import type { DiffLine as DiffLineData } from '../../messages';

interface Props {
  line: DiffLineData;
}

export function DiffLineView({ line }: Props) {
  const cls = `nx-diff-line nx-diff-line--${line.type}`;
  return (
    <tr className={cls}>
      <td className="nx-diff-line-num nx-diff-line-num--old">{line.oldLine ?? ''}</td>
      <td className="nx-diff-line-num nx-diff-line-num--new">{line.newLine ?? ''}</td>
      <td className="nx-diff-line-marker">
        {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
      </td>
      <td className="nx-diff-line-content">
        <code>{line.content}</code>
      </td>
    </tr>
  );
}

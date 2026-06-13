import { useState } from 'react';
import type { DiffHunk as DiffHunkData } from '../../messages';
import { DiffLineView } from './DiffLine';

interface Props {
  hunk: DiffHunkData;
}

export function DiffHunkView({ hunk }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <tbody>
      <tr className="nx-diff-hunk-header" onClick={() => setCollapsed(c => !c)}>
        <td colSpan={4} className="nx-diff-hunk-header-cell">
          <span className="nx-diff-hunk-toggle">{collapsed ? '▶' : '▼'}</span>
          <span className="nx-diff-hunk-range">{hunk.header}</span>
        </td>
      </tr>
      {!collapsed && hunk.lines.map((line, i) => (
        <DiffLineView key={i} line={line} />
      ))}
    </tbody>
  );
}

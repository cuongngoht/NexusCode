export type CodeReviewTargetType =
  | 'working-tree'
  | 'staged'
  | 'branch'
  | 'commit'
  | 'file'
  | 'selection';

export interface CodeReviewTarget {
  type: CodeReviewTargetType;
  baseBranch?: string;
  compareBranch?: string;
  commitSha?: string;
  filePath?: string;
  selectedText?: string;
}

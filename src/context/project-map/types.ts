export type ProjectKind =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'library'
  | 'tooling'
  | 'unknown';

export type MarkerKind =
  | 'node'
  | 'dotnet'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'docker'
  | 'github-actions'
  | 'unknown';

export type FileTreeSnapshot = {
  rootPath: string;
  generatedAt: string;
  files: string[];
  folders: string[];
  skipped: {
    files: number;
    folders: string[];
  };
};

export type MarkerHit = {
  path: string;
  kind: MarkerKind;
  weight: number;
  reason: string;
};

export type ProjectUnit = {
  id: string;
  name: string;
  rootPath: string;
  kind: ProjectKind;
  languages: string[];
  frameworks: string[];
  markers: string[];
  confidence: number;
};

export type ProjectMapResult = {
  rootPath: string;
  generatedAt: string;
  tree: FileTreeSnapshot;
  markers: MarkerHit[];
  units: ProjectUnit[];
  markdown: string;
};

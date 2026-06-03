import * as path from 'path';
import type { FileTreeSnapshot, MarkerHit, MarkerKind } from './types';

type MarkerSpec = {
  match: string;
  kind: MarkerKind;
  weight: number;
};

const MARKERS: MarkerSpec[] = [
  { match: 'package.json',      kind: 'node',   weight: 10 },
  { match: 'tsconfig.json',     kind: 'node',   weight: 6  },
  { match: 'vite.config.ts',    kind: 'node',   weight: 8  },
  { match: 'next.config.js',    kind: 'node',   weight: 8  },

  { match: '.sln',              kind: 'dotnet', weight: 10 },
  { match: '.csproj',           kind: 'dotnet', weight: 10 },
  { match: 'Program.cs',        kind: 'dotnet', weight: 8  },
  { match: 'Startup.cs',        kind: 'dotnet', weight: 8  },
  { match: 'appsettings.json',  kind: 'dotnet', weight: 6  },

  { match: 'pyproject.toml',    kind: 'python', weight: 10 },
  { match: 'requirements.txt',  kind: 'python', weight: 8  },
  { match: 'manage.py',         kind: 'python', weight: 8  },
  { match: 'main.py',           kind: 'python', weight: 5  },
  { match: 'app.py',            kind: 'python', weight: 5  },

  { match: 'pom.xml',           kind: 'java',   weight: 10 },
  { match: 'build.gradle',      kind: 'java',   weight: 10 },
  { match: 'go.mod',            kind: 'go',     weight: 10 },
  { match: 'Cargo.toml',        kind: 'rust',   weight: 10 },

  { match: 'Dockerfile',        kind: 'docker', weight: 6  },
  { match: 'docker-compose.yml',kind: 'docker', weight: 8  },
];

export class NexusMarkerDetector {
  detect(tree: FileTreeSnapshot): MarkerHit[] {
    const hits: MarkerHit[] = [];

    for (const filePath of tree.files) {
      const filename = path.basename(filePath);
      const ext = path.extname(filePath);

      for (const spec of MARKERS) {
        const isMatch =
          filename === spec.match ||
          ext === spec.match ||
          filename.endsWith(spec.match);

        if (isMatch) {
          hits.push({
            path: filePath,
            kind: spec.kind,
            weight: spec.weight,
            reason: spec.match,
          });
        }
      }
    }

    return hits;
  }
}

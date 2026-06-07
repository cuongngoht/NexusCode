import type { McpPreset, McpPresetId } from './McpTypes';

export interface IMcpPresetRegistry {
  getAll(): McpPreset[];
  getById(id: McpPresetId): McpPreset | undefined;
}

export class McpPresetRegistry implements IMcpPresetRegistry {
  private readonly presets: McpPreset[] = [
    {
      id: 'microsoftLearn',
      displayName: 'Microsoft Learn',
      description: 'Official Microsoft documentation and code samples.',
      transport: 'streamableHttp',
      endpoint: 'https://learn.microsoft.com/api/mcp',
      priority: 90,
      enabledByDefault: true,
      bestFor: [
        'azure', 'dotnet', '.net', 'csharp', 'c#', 'typescript',
        'vscode', 'visual studio code', 'microsoft', 'windows',
        'asp.net', 'power platform', 'microsoft graph',
      ],
      toolGroups: ['docs', 'samples', 'microsoft-docs'],
      risk: 'low',
    },
    {
      id: 'context7',
      displayName: 'Context7',
      description: 'Up-to-date library documentation and code examples.',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      priority: 85,
      enabledByDefault: true,
      bestFor: [
        'react', 'nextjs', 'next.js', 'vue', 'nuxt', 'tailwind',
        'prisma', 'zod', 'node', 'express', 'vite', 'typescript',
        'library', 'package', 'npm', 'api', 'sdk',
      ],
      toolGroups: ['docs', 'samples', 'library-api'],
      risk: 'low',
    },
  ];

  getAll(): McpPreset[] {
    return [...this.presets];
  }

  getById(id: McpPresetId): McpPreset | undefined {
    return this.presets.find(preset => preset.id === id);
  }
}

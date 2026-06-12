export type ArtifactKind =
  | 'file'
  | 'image'
  | 'chart'
  | 'markdown'
  | 'html'
  | 'json'
  | 'patch'
  | 'plan'
  | 'test-report'
  | 'log'
  | 'unknown';

export interface ArtifactRef {
  id: string;
  kind: ArtifactKind;
  title: string;
  path?: string;
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: number;
  updatedAt?: number;
  sourceTaskId?: string;
  sourceMessageId?: string;
  sourceConversationId?: string;
  previewable: boolean;
  description?: string;
  tags?: string[];
}

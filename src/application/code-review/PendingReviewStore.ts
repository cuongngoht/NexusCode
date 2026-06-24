import { randomUUID } from 'crypto';
import type { PromptAttachment } from '../../core/types';

export interface PendingReviewRequest {
  requestId: string;
  originalPrompt: string;
  cleanedPrompt: string;
  mode: string;
  providerId: string;
  model?: string;
  selectedAgentIds: string[];
  selectedReviewAgentIds: string[];
  attachments: PromptAttachment[];
  createdAt: number;
}

export class PendingReviewStore {
  private _pending: PendingReviewRequest | null = null;

  store(req: Omit<PendingReviewRequest, 'requestId' | 'createdAt'>): string {
    const requestId = randomUUID();
    this._pending = { ...req, requestId, createdAt: Date.now() };
    return requestId;
  }

  get(requestId: string): PendingReviewRequest | null {
    if (this._pending?.requestId === requestId) return this._pending;
    return null;
  }

  clear(requestId?: string): void {
    if (!requestId || this._pending?.requestId === requestId) {
      this._pending = null;
    }
  }

  clearAll(): void {
    this._pending = null;
  }
}

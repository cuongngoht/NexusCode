import type { ExtensionMessage } from '../webviewProtocol';
import type { IChatHistoryStore } from '../IChatHistoryStore';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';

export class HistoryHandler {
  private _latestHistory: ChatHistoryState | null = null;

  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly store: IChatHistoryStore,
  ) {}

  get latestHistory(): ChatHistoryState | null {
    return this._latestHistory;
  }

  // Returns Promise<void> so callers can uniformly await it alongside other async init steps.
  // store.load() is currently synchronous but the async signature keeps the interface stable.
  async load(): Promise<void> {
    try {
      const history = this.store.load();
      if (history) {
        this._latestHistory = history;
        this.post({ type: 'historyLoaded', history });
      }
    } catch (err) {
      this.post({ type: 'historyError', message: String(err) });
    }
  }

  async save(history: ChatHistoryState): Promise<void> {
    this._latestHistory = history;
    await this.store.save(history);
  }
}

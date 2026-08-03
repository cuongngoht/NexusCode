import { describe, it, expect } from 'vitest';
import { reducer, createInitialState, serializeHistory } from '../messages';
import type { AppState, PromptAttachment, UserMessage } from '../messages';
import { toWorkspaceResourceUri } from '../resourceUri';

function s(): AppState { return createInitialState(); }

function send(state: AppState, attachments?: PromptAttachment[]): AppState {
  return reducer(state, {
    type: 'sendUserMessage',
    prompt: 'describe this',
    provider: 'claude',
    mode: 'ask',
    timestamp: 1000,
    attachments,
  });
}

function userMessagesOf(state: AppState): UserMessage[] {
  const conv = state.conversations.find(c => c.id === state.activeConvId)!;
  return conv.messages.filter((m): m is UserMessage => m.role === 'user');
}

/** serializeHistory → historyLoaded is the real persistence round trip. */
function roundTrip(state: AppState): AppState {
  return reducer(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history: serializeHistory(state) } });
}

const IMG: PromptAttachment = { type: 'image', path: '.nexus/attachments/pasted-1-0.png' };

describe('sendUserMessage with attachments', () => {
  it('stores attachments on the user message', () => {
    const state = send(s(), [IMG]);
    expect(userMessagesOf(state)[0].attachments).toEqual([IMG]);
  });

  it('leaves attachments undefined when none are given', () => {
    const state = send(s());
    expect(userMessagesOf(state)[0].attachments).toBeUndefined();
  });

  it('keeps mixed attachment types', () => {
    const mixed: PromptAttachment[] = [IMG, { type: 'file', path: 'notes.md' }];
    const state = send(s(), mixed);
    expect(userMessagesOf(state)[0].attachments).toEqual(mixed);
  });
});

describe('attachment persistence round trip', () => {
  it('round-trips an image attachment through serialize → historyLoaded', () => {
    const restored = roundTrip(send(s(), [IMG]));
    expect(userMessagesOf(restored)[0].attachments).toEqual([IMG]);
  });

  it('never persists base64 image bytes', () => {
    const json = JSON.stringify(serializeHistory(send(s(), [IMG])));
    expect(json).not.toContain('base64');
    expect(json).not.toContain('data:image');
  });

  it('tolerates history with no attachments field at all', () => {
    const restored = roundTrip(send(s()));
    expect(userMessagesOf(restored)[0].attachments).toBeUndefined();
  });
});

describe('deserialization guards', () => {
  function restoreRaw(attachments: unknown): PromptAttachment[] | undefined {
    const history = serializeHistory(send(s(), [IMG]));
    // Overwrite the persisted value with the malformed one.
    (history.conversations[0].messages[0] as Record<string, unknown>).attachments = attachments;
    const restored = reducer(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history } });
    return userMessagesOf(restored)[0].attachments;
  }

  it('drops a non-array value', () => {
    expect(restoreRaw('not-an-array')).toBeUndefined();
    expect(restoreRaw(null)).toBeUndefined();
    expect(restoreRaw(42)).toBeUndefined();
  });

  it('drops entries with an unknown type', () => {
    expect(restoreRaw([{ type: 'evil', path: 'x.png' }])).toBeUndefined();
  });

  it('drops entries whose path escapes the workspace', () => {
    expect(restoreRaw([{ type: 'image', path: '../secrets.png' }])).toBeUndefined();
  });

  it('drops entries with an empty or non-string path', () => {
    expect(restoreRaw([{ type: 'image', path: '' }])).toBeUndefined();
    expect(restoreRaw([{ type: 'image', path: 123 }])).toBeUndefined();
  });

  it('keeps the valid entries and drops only the bad ones', () => {
    const out = restoreRaw([IMG, { type: 'evil', path: 'x' }, { type: 'file', path: 'a.md' }]);
    expect(out).toEqual([IMG, { type: 'file', path: 'a.md' }]);
  });
});

describe('toWorkspaceResourceUri', () => {
  it('returns undefined when no resource base is stamped on the document', () => {
    delete document.body.dataset.nexusResourceBase;
    expect(toWorkspaceResourceUri('a.png')).toBeUndefined();
  });

  it('builds a URL under the resource base', () => {
    document.body.dataset.nexusResourceBase = 'https://file+.vscode-resource/proj';
    expect(toWorkspaceResourceUri('.nexus/attachments/x.png'))
      .toBe('https://file+.vscode-resource/proj/.nexus/attachments/x.png');
  });

  it('encodes each segment but keeps separators', () => {
    document.body.dataset.nexusResourceBase = 'https://base';
    expect(toWorkspaceResourceUri('my dir/a b.png')).toBe('https://base/my%20dir/a%20b.png');
  });

  it('normalizes backslash separators', () => {
    document.body.dataset.nexusResourceBase = 'https://base';
    expect(toWorkspaceResourceUri('.nexus\\attachments\\x.png'))
      .toBe('https://base/.nexus/attachments/x.png');
  });

  it('does not double up on a trailing slash in the base', () => {
    document.body.dataset.nexusResourceBase = 'https://base/';
    expect(toWorkspaceResourceUri('a.png')).toBe('https://base/a.png');
  });

  it('returns undefined for an empty path', () => {
    document.body.dataset.nexusResourceBase = 'https://base';
    expect(toWorkspaceResourceUri('')).toBeUndefined();
  });
});

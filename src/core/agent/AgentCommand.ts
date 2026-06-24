/**
 * Transport key that selects a (IStreamDecoder + IProviderStreamAdapter) pair from
 * AgentStreamPipelineFactory. Use string so new providers can register custom
 * transports without modifying this file (OCP).
 *
 * Well-known built-in keys:
 *   'plain'       → PlainTextDecoder + PlainTextAdapter
 *   'stdio'       → LineDecoder + PlainTextAdapter
 *   'jsonl'       → LineDecoder + PlainTextAdapter (generic line-by-line)
 *   'codex-jsonl' → LineDecoder + CodexJsonlAdapter
 *   'codex-sse'   → SseDecoder + CodexSseAdapter
 *   'grok'        → LineDecoder + GrokStreamAdapter
 *   'antigravity' → LineDecoder + AntigravityStreamAdapter
 *
 * No transport (undefined) → null pipeline → raw stdout events (legacy behavior).
 */
export type AgentTransport = string;

export class AgentCommand {
  constructor(
    readonly executable: string,
    readonly args: ReadonlyArray<string>,
    readonly env?: Readonly<Record<string, string>>,
    readonly stdin?: string,
    readonly inputPrompt?: string,
    readonly transport?: AgentTransport,
  ) { }
}

# Integration Points

## Event & Messaging

- **Event bus definition:** `src/application/agent-mode/AgentModeEvents.ts`
- To add a new event type: extend the union type in that file.
- **Event/message type files:**
  - `src/application/agent-mode/AgentModeEvents.ts`
  - `src/core/stream/AgentStreamEvent.ts`
  - `src/core/stream/NexusStreamEvent.ts`
  - `src/webview-ui/components/AssistantMessage.tsx`
  - `src/webview-ui/components/UserMessage.tsx`
  - `src/webview-ui/messages.test.ts`
  - `src/webview-ui/messages.ts`

## Communication Protocol

- **Primary protocol:** VS Code Webview postMessage
- **Message contract:** `src/webview/webviewProtocol.ts`
- To extend: add new message types to that file and handle them in the receiver.
- **UI source roots:** src/webview-ui

## Module / Plugin System

- **Composition root:** `src/extension.ts`. Register new modules here.
- **Registries:**
  - `src/application/AgentRegistry.ts`
  - `src/application/subagents/SubagentRegistry.test.ts`
  - `src/application/subagents/SubagentRegistry.ts`
  - `src/context/history-search/rag/RagPromptInjector.ts`
  - `src/debug/tools/DebugToolRegistry.ts`
  - `src/mcp/McpPresetRegistry.ts`
  - `src/provider-hub/ProviderSpecRegistry.ts`
- **Base interfaces / abstract classes:**
  - `src/core/agent/IAgent.ts`
  - `src/providers/base/BaseAgent.ts`
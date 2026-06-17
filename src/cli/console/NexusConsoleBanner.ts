import type { NexusConsoleState } from './NexusConsoleState';
import { displayProviderRoute } from '../../application/prompt/ProviderAliasResolver';

export function printConsoleBanner(state: NexusConsoleState): void {
  process.stdout.write(`
Nexus Console
Author: Ngo Hoang Tuan Cuong

Default route: ${displayProviderRoute(state.providerRoute)}
Workspace: ${state.workspaceRoot}

Use:
  @agent-id      load .nexus/agents/<agent-id>.md
  #skill-id      load .nexus/skills/<skill-id>.md
  /command-id    load .nexus/commands/<command-id>.md

Built-ins: /help /model /provider /reload /agents /skills /commands /exit

Example:
  @software-architect #api-design /plan Implement autocomplete reload

`);
}

import { runCommandCore } from '../commands/runCommand';
import { parsePromptSourceReferences } from '../../application/prompt/PromptSourceReferenceParser';
import { resolvePromptSources } from '../../application/prompt/PromptSourceResolver';
import { PromptRunComposer } from '../../application/prompt/PromptRunComposer';
import type { NexusConsoleState } from './NexusConsoleState';

const composer = new PromptRunComposer();

export async function runConsolePrompt(line: string, state: NexusConsoleState): Promise<void> {
  const { agentIds, skillIds, commandIds, cleanedPrompt } = parsePromptSourceReferences(line);

  let resolvedSources;
  try {
    resolvedSources = resolvePromptSources(state.workspaceRoot, { commandIds, skillIds, agentIds });
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return;
  }

  const finalPrompt = composer.compose(resolvedSources, cleanedPrompt);

  await runCommandCore({
    root: state.workspaceRoot,
    mode: state.mode,
    provider: state.providerRoute,
    stage: state.stage,
    model: state.model,
    prompt: finalPrompt,
    autoApprove: state.autoApprove,
  });
}

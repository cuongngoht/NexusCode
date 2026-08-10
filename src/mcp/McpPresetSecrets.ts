import type { McpConfig } from '../config/NexusConfig';
import type { McpPreset } from './McpTypes';

/**
 * Injects configured credentials into a preset's transport settings.
 *
 * The settings panel collects, validates, masks and rehydrates
 * `mcp.presets.context7.apiKey`, but nothing ever handed it to the server — so a user
 * who pasted a key got the same anonymous rate limits as one who did not.
 *
 * Delivered via env rather than an `--api-key` argv entry: the CLI accepts both
 * (`stdioApiKey = cliOptions.apiKey || process.env.CONTEXT7_API_KEY`), and argv is
 * visible to any local process listing.
 */
export function applyPresetSecrets(preset: McpPreset, mcp: McpConfig): McpPreset {
  if (preset.id !== 'context7') return preset;

  const apiKey = mcp.presets?.context7?.apiKey?.trim();
  if (!apiKey) return preset;

  return { ...preset, env: { ...preset.env, CONTEXT7_API_KEY: apiKey } };
}

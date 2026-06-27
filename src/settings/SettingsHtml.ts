import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { NexusConfig } from '../config/NexusConfig';
import { DEFAULT_CONFIG } from '../config/DefaultConfig';

const PROVIDER_LABELS: Record<string, string> = {
  antigravity: 'Antigravity CLI',
  codex: 'Codex CLI',
  claude: 'Claude CLI',
  copilot: 'Copilot CLI',
  aider: 'Aider',
  grok: 'Grok CLI',
};

export function getSettingsHtml(
  webview: vscode.Webview,
  config: NexusConfig,
  vsCodeConfig?: {
    historyRagEnabled?: boolean;
    reviewStepReviewer?: boolean;
    reviewStepTester?: boolean;
    reviewStepSecurity?: boolean;
    reviewStepArchitect?: boolean;
    reviewMaxDiffChars?: number;
    contextMaxChars?: number;
    contextMaxMessages?: number;
    projectMapAddToGitignore?: boolean;
    autoReviewEnabled?: boolean;
    autoReviewWatchMode?: string;
    autoReviewDebounceMs?: number;
    autoReviewMaxDiffChars?: number;
    autoReviewMinRiskToRunAgent?: string;
    autoReviewBaselineEnabled?: boolean;
    autoReviewArchitectureDriftEnabled?: boolean;
    autoReviewRequireApprovalForPatch?: boolean;
    autoReviewRetentionEnabled?: boolean;
    autoReviewRetentionMaxReports?: number;
    autoReviewRetentionMaxAgeDays?: number;
  },
): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const rows = (Object.keys(config.providers) as (keyof NexusConfig['providers'])[])
    .map((id) => {
      const p = config.providers[id];
      const label = PROVIDER_LABELS[id] ?? id;
      const checked = p.enabled ? 'checked' : '';
      return /* html */`
        <div class="provider-row" data-provider="${escapeHtml(String(id))}">
          <div class="provider-main">
            <label>
              <input type="checkbox" name="${id}" ${checked} />
              <span class="provider-name">${escapeHtml(label)}</span>
            </label>
            <div class="provider-actions" data-provider-actions="${escapeHtml(String(id))}"></div>
          </div>
          <div class="provider-command">Command: <code>${escapeHtml(p.command)}</code></div>
          <div class="provider-status muted" data-provider-status="${escapeHtml(String(id))}">Not scanned yet.</div>
        </div>`;
    })
    .join('\n');

  // Merge config with defaults to ensure mcp field is always present
  const mergedConfig: NexusConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    mcp: { ...DEFAULT_CONFIG.mcp, ...(config.mcp ?? {}) },
  };
  const safeJson = JSON.stringify(mergedConfig).replace(/<\/script>/gi, '<\\/script>');
  const mcpEnabled = mergedConfig.mcp.enabled;
  const mcpAutoSelect = mergedConfig.mcp.autoSelectPreset;
  const mcpMicrosoftLearn = mergedConfig.mcp.presets.microsoftLearn.enabled;
  const mcpContext7 = mergedConfig.mcp.presets.context7.enabled;
  const mcpMaxChars = mergedConfig.mcp.maxResultChars;
  const mcpMaxRounds = mergedConfig.mcp.maxRoundsPerTask;
  const projectMapAddToGitignore = vsCodeConfig?.projectMapAddToGitignore ?? false;
  const historyRagEnabled = vsCodeConfig?.historyRagEnabled ?? mergedConfig.historyRag?.enabled ?? true;
  const contextMaxChars    = vsCodeConfig?.contextMaxChars    ?? 100_000;
  const contextMaxMessages = vsCodeConfig?.contextMaxMessages ?? 20;

  const reviewStepReviewer  = vsCodeConfig?.reviewStepReviewer  ?? true;
  const reviewStepTester    = vsCodeConfig?.reviewStepTester    ?? true;
  const reviewStepSecurity  = vsCodeConfig?.reviewStepSecurity  ?? true;
  const reviewStepArchitect = vsCodeConfig?.reviewStepArchitect ?? true;
  const reviewMaxDiffChars  = vsCodeConfig?.reviewMaxDiffChars  ?? 60_000;

  const autoReviewEnabled             = vsCodeConfig?.autoReviewEnabled              ?? false;
  const autoReviewWatchMode           = vsCodeConfig?.autoReviewWatchMode            ?? 'workingTree';
  const autoReviewDebounceMs          = vsCodeConfig?.autoReviewDebounceMs           ?? 2500;
  const autoReviewMaxDiffChars        = vsCodeConfig?.autoReviewMaxDiffChars         ?? 60000;
  const autoReviewMinRisk             = vsCodeConfig?.autoReviewMinRiskToRunAgent    ?? 'medium';
  const autoReviewBaselineEnabled     = vsCodeConfig?.autoReviewBaselineEnabled      ?? true;
  const autoReviewArchDrift           = vsCodeConfig?.autoReviewArchitectureDriftEnabled ?? true;
  const autoReviewRequireApproval     = vsCodeConfig?.autoReviewRequireApprovalForPatch  ?? true;
  const autoReviewRetentionEnabled    = vsCodeConfig?.autoReviewRetentionEnabled     ?? true;
  const autoReviewMaxReports          = vsCodeConfig?.autoReviewRetentionMaxReports  ?? 100;
  const autoReviewMaxAgeDays          = vsCodeConfig?.autoReviewRetentionMaxAgeDays  ?? 30;

  const safeSubagents = { ...(DEFAULT_CONFIG.subagents ?? {}), ...(mergedConfig.subagents ?? {}) };
  const subagentsEnabled = safeSubagents.enabled ?? false;
  const subagentsMode = safeSubagents.mode ?? 'auto';
  const subagentsPreset = safeSubagents.preset ?? 'balanced';
  const subagentsMaxRuns = safeSubagents.maxRuns ?? 4;
  const subagentsMaxParallel = safeSubagents.maxParallel ?? 2;
  const subagentsHardCap = safeSubagents.hardCap ?? 6;
  const subagentsIncludeReviewer = safeSubagents.includeReviewer ?? true;
  const subagentsIncludeTester = safeSubagents.includeTester ?? true;
  const subagentsIncludeSecurity = safeSubagents.includeSecurity ?? false;
  const subagentsIncludeDocs = safeSubagents.includeDocs ?? false;
  const subagentsFailOpen = safeSubagents.failOpen ?? true;
  const subagentsInjectMaxChars = safeSubagents.injectMaxChars ?? 8000;
  const subagentsTimeoutMs = safeSubagents.timeoutMs ?? 30000;

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px;
      margin: 0;
    }
    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin: 0 0 4px;
      color: var(--vscode-foreground);
    }
    h2 {
      font-size: 1em;
      font-weight: 600;
      margin: 24px 0 4px;
      color: var(--vscode-foreground);
    }
    .section-desc {
      font-size: 0.875em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 12px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-header h2 {
      margin: 0;
    }
    h3 {
      font-size: 0.9em;
      font-weight: 600;
      margin: 16px 0 8px;
      color: var(--vscode-foreground);
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .toggle-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .form-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .form-row input[type="number"] {
      width: 80px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
    }
    .description {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 8px 24px;
    }
    .settings-section {
      margin-top: 20px;
    }
    .provider-row {
      margin-bottom: 14px;
    }
    .provider-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .provider-row label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .provider-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .provider-name {
      font-weight: 500;
    }
    .provider-command {
      margin-top: 2px;
      margin-left: 24px;
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    .provider-status {
      margin-top: 3px;
      margin-left: 24px;
      font-size: 0.8em;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .provider-status.ok {
      color: var(--vscode-testing-iconPassed);
    }
    .provider-status.warn {
      color: var(--vscode-testing-iconQueued);
    }
    .provider-status.err {
      color: var(--vscode-errorForeground);
    }
    .provider-status.muted {
      color: var(--vscode-descriptionForeground);
    }
    .provider-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .provider-action-btn {
      padding: 3px 9px;
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBackground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8em;
      font-family: var(--vscode-font-family);
      white-space: nowrap;
    }
    .provider-action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .save-btn {
      margin-top: 24px;
      padding: 6px 18px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
    }
    .save-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .scan-btn {
      padding: 4px 12px;
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBackground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      font-family: var(--vscode-font-family);
    }
    .scan-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .scan-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .status {
      margin-top: 10px;
      font-size: 0.85em;
      min-height: 1.2em;
    }
    .status.ok  { color: var(--vscode-testing-iconPassed); }
    .status.err { color: var(--vscode-errorForeground); }
    .setting-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .setting-row label,
    .setting-row > span:first-child {
      min-width: 120px;
    }
    .setting-row select,
    .setting-row input[type="number"] {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 0.9em;
      font-family: var(--vscode-font-family);
    }
    .setting-row input[type="number"] {
      width: 80px;
    }
    .setting-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .setting-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .setting-hint {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }
    .section-description {
      font-size: 0.875em;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 12px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 20px 0;
    }
    .setting-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .setting-actions button {
      padding: 4px 12px;
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBackground);
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85em;
      font-family: var(--vscode-font-family);
    }
    .setting-actions button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <h1>Nexus Settings</h1>
  <hr />
  <h2>General</h2>
  <div class="section-header">
    <h2>CLI Providers</h2>
    <button class="scan-btn" id="scanBtn">Scan for CLIs</button>
  </div>
  <p class="section-desc">Choose which local CLI tools Nexus can use.</p>

  <div id="providers">${rows}</div>

  <section class="settings-section">
    <hr />
    <h2>MCP Tools</h2>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-enabled" ${mcpEnabled ? 'checked' : ''} />
      <span>Enable MCP</span>
    </label>

    <h3>Trusted Documentation Presets</h3>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-preset-microsoftLearn" ${mcpMicrosoftLearn ? 'checked' : ''} />
      <span>Microsoft Learn</span>
    </label>
    <p class="description">Official Microsoft documentation, Azure, .NET, VS Code, Windows.</p>

    <label class="toggle-row">
      <input type="checkbox" id="mcp-preset-context7" ${mcpContext7 ? 'checked' : ''} />
      <span>Context7</span>
    </label>
    <p class="description">Up-to-date package/library documentation and code examples.</p>

    <h3>Behavior</h3>
    <label class="toggle-row">
      <input type="checkbox" id="mcp-auto-select" ${mcpAutoSelect ? 'checked' : ''} />
      <span>Auto-select best preset</span>
    </label>
    <label class="form-row">
      <span>Max result size (chars):</span>
      <input type="number" id="mcp-max-chars" min="1000" max="20000" step="1000" value="${mcpMaxChars}" />
    </label>
    <label class="form-row">
      <span>Max MCP rounds per task:</span>
      <input type="number" id="mcp-max-rounds" min="1" max="5" value="${mcpMaxRounds}" />
    </label>
  </section>

  <section class="settings-section" id="project-map-section">
    <hr />
    <h2>Project Scan (.nexus)</h2>
    <p class="section-desc">Controls how the project scan writes the <code>.nexus/</code> folder.</p>
    <label class="toggle-row">
      <input type="checkbox" id="projectmap-add-gitignore" ${projectMapAddToGitignore ? 'checked' : ''} />
      <span>Add <code>.nexus/</code> to <code>.gitignore</code></span>
    </label>
    <p class="description">When enabled, Nexus automatically appends <code>.nexus/</code> to the root <code>.gitignore</code> after each project scan so the folder is not tracked by git.</p>
  </section>

  <section class="settings-section">
    <hr />
    <h2>History RAG</h2>
    <p class="section-desc">Automatically inject relevant past conversations as context before each task.</p>
    <label class="toggle-row">
      <input type="checkbox" id="history-rag-enabled" ${historyRagEnabled ? 'checked' : ''} />
      <span>Enable History RAG</span>
    </label>
    <p class="description">When enabled, Nexus searches previous conversations and injects relevant snippets into every prompt automatically.</p>
  </section>

  <section class="settings-section" id="context-section">
    <hr />
    <h2>Context Window</h2>
    <p class="section-description">Controls how much conversation history is injected into each prompt. Higher values give the agent more memory but use more tokens per request.</p>

    <div class="setting-row">
      <label>Max Context (chars)</label>
      <input type="number" id="context-maxChars" min="10000" max="500000" step="10000" value="${contextMaxChars}" />
      <span class="setting-hint">Characters of conversation history sent to the agent per task. Default: 100,000.</span>
    </div>

    <div class="setting-row">
      <label>Max Messages</label>
      <input type="number" id="context-maxMessages" min="4" max="50" value="${contextMaxMessages}" />
      <span class="setting-hint">Number of past messages included in context. Default: 20.</span>
    </div>
  </section>

  <section class="settings-section" id="subagents-section">
    <hr />
    <h2>Subagents</h2>
    <p class="section-description">Focused pre-agents that run before the main agent and produce compact findings to improve context quality.</p>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-enabled" ${subagentsEnabled ? 'checked' : ''} />
        Enable Subagents
      </label>
      <span class="setting-hint">Run focused pre-agents before the main agent.</span>
    </div>

    <div class="setting-row">
      <label>Mode</label>
      <select id="subagents-mode">
        <option value="off" ${subagentsMode === 'off' ? 'selected' : ''}>Off</option>
        <option value="auto" ${subagentsMode === 'auto' ? 'selected' : ''}>Auto</option>
        <option value="manual" ${subagentsMode === 'manual' ? 'selected' : ''}>Manual</option>
        <option value="full" ${subagentsMode === 'full' ? 'selected' : ''}>Full</option>
      </select>
      <span class="setting-hint">off: disabled · auto: selected by intent · manual: use selected roles · full: broader chain</span>
    </div>

    <div class="setting-row">
      <label>Preset</label>
      <select id="subagents-preset">
        <option value="fast" ${subagentsPreset === 'fast' ? 'selected' : ''}>Fast (2 subagents)</option>
        <option value="balanced" ${subagentsPreset === 'balanced' ? 'selected' : ''}>Balanced (4 subagents) — Recommended</option>
        <option value="full" ${subagentsPreset === 'full' ? 'selected' : ''}>Full (5 subagents)</option>
        <option value="safe" ${subagentsPreset === 'safe' ? 'selected' : ''}>Safe (6 subagents)</option>
      </select>
      <span class="setting-hint">Balanced is recommended for most coding and debugging tasks.</span>
    </div>

    <div class="setting-row">
      <label>Max Runs</label>
      <input type="number" id="subagents-maxRuns" min="0" max="8" value="${subagentsMaxRuns}" />
      <span class="setting-hint">Maximum subagents per task (before hard cap).</span>
    </div>

    <div class="setting-row">
      <label>Max Parallel</label>
      <input type="number" id="subagents-maxParallel" min="1" max="4" value="${subagentsMaxParallel}" />
      <span class="setting-hint">Maximum subagents running concurrently.</span>
    </div>

    <div class="setting-row">
      <label>Hard Cap</label>
      <input type="number" id="subagents-hardCap" min="1" max="8" value="${subagentsHardCap}" />
      <span class="setting-hint">Absolute maximum. Nexus clamps all runs to this cap. Running more than 6 can increase latency and token usage.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-includeReviewer" ${subagentsIncludeReviewer ? 'checked' : ''} />
        Include Reviewer
      </label>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-includeTester" ${subagentsIncludeTester ? 'checked' : ''} />
        Include Tester
      </label>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-includeSecurity" ${subagentsIncludeSecurity ? 'checked' : ''} />
        Include Security
      </label>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-includeDocs" ${subagentsIncludeDocs ? 'checked' : ''} />
        Include Docs
      </label>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="subagents-failOpen" ${subagentsFailOpen ? 'checked' : ''} />
        Fail Open
      </label>
      <span class="setting-hint">Continue to main agent when an optional subagent fails.</span>
    </div>

    <div class="setting-row">
      <label>Inject Max Chars</label>
      <input type="number" id="subagents-injectMaxChars" min="1000" max="30000" value="${subagentsInjectMaxChars}" />
      <span class="setting-hint">Maximum characters from subagent results injected into the main prompt.</span>
    </div>

    <div class="setting-row">
      <label>Timeout (ms)</label>
      <input type="number" id="subagents-timeoutMs" min="5000" max="120000" value="${subagentsTimeoutMs}" />
      <span class="setting-hint">Timeout per subagent run in milliseconds.</span>
    </div>
  </section>

  <section class="settings-section" id="review-steps-section">
    <hr />
    <h2>Review Steps</h2>
    <p class="section-description">
      Choose which analysis agents run during code review.
      All steps are enabled by default (best practice).
    </p>
    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="review-step-reviewer" ${reviewStepReviewer ? 'checked' : ''} />
        Reviewer &mdash; Bug &amp; Correctness
      </label>
      <span class="setting-hint">Checks for bugs, regressions, and logic errors</span>
    </div>
    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="review-step-tester" ${reviewStepTester ? 'checked' : ''} />
        Test Analyst &mdash; Test Coverage
      </label>
      <span class="setting-hint">Identifies missing or weak test cases</span>
    </div>
    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="review-step-security" ${reviewStepSecurity ? 'checked' : ''} />
        Security &mdash; Security Analysis
      </label>
      <span class="setting-hint">Scans for security vulnerabilities and risky patterns</span>
    </div>
    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="review-step-architect" ${reviewStepArchitect ? 'checked' : ''} />
        Architect &mdash; Architecture &amp; OOP/OOD
      </label>
      <span class="setting-hint">Reviews layer structure, coupling, design patterns, technical debt</span>
    </div>
    <div class="setting-row">
      <label class="setting-label" for="review-maxDiffChars">Max Diff Size (characters)</label>
      <input type="number" id="review-maxDiffChars" value="${reviewMaxDiffChars}" min="5000" max="500000" step="5000" style="width:120px" />
      <span class="setting-hint">Maximum characters of git diff loaded for review. Larger values cover more of the diff but increase prompt size. (5,000 – 500,000)</span>
    </div>
  </section>

  <section class="settings-section" id="auto-review-section">
    <hr />
    <h2>Auto Review</h2>
    <p class="section-description">
      Configure local-first automatic code review. Auto Review is disabled by default and only runs when explicitly enabled.
    </p>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="autoReview-enabled" ${autoReviewEnabled ? 'checked' : ''} />
        Enable Auto Review
      </label>
      <span class="setting-hint">Watch local changes and run automatic code review. Disabled by default.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-watchMode">Watch Mode</label>
      <select id="autoReview-watchMode">
        <option value="workingTree" ${autoReviewWatchMode === 'workingTree' ? 'selected' : ''}>Working Tree</option>
        <option value="staged" ${autoReviewWatchMode === 'staged' ? 'selected' : ''}>Staged Changes</option>
        <option value="branch" ${autoReviewWatchMode === 'branch' ? 'selected' : ''}>Current Branch</option>
      </select>
      <span class="setting-hint">Choose which local changes Auto Review watches.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-debounceMs">Debounce Delay (ms)</label>
      <input type="number" id="autoReview-debounceMs" min="500" max="30000" step="500" value="${autoReviewDebounceMs}" />
      <span class="setting-hint">Delay before running Auto Review after a change is detected.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-maxDiffChars">Max Diff Size</label>
      <input type="number" id="autoReview-maxDiffChars" min="5000" max="500000" step="5000" value="${autoReviewMaxDiffChars}" />
      <span class="setting-hint">Maximum characters of git diff included in Auto Review.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-minRiskToRunAgent">Minimum Risk To Run Agent</label>
      <select id="autoReview-minRiskToRunAgent">
        <option value="low" ${autoReviewMinRisk === 'low' ? 'selected' : ''}>Low</option>
        <option value="medium" ${autoReviewMinRisk === 'medium' ? 'selected' : ''}>Medium</option>
        <option value="high" ${autoReviewMinRisk === 'high' ? 'selected' : ''}>High</option>
        <option value="critical" ${autoReviewMinRisk === 'critical' ? 'selected' : ''}>Critical</option>
      </select>
      <span class="setting-hint">AI review only runs when local risk reaches this level.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="autoReview-baselineEnabled" ${autoReviewBaselineEnabled ? 'checked' : ''} />
        Enable Baseline Suppression
      </label>
      <span class="setting-hint">Suppress known findings stored in .nexus/auto-reviews/baseline.json.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="autoReview-architectureDriftEnabled" ${autoReviewArchDrift ? 'checked' : ''} />
        Enable Architecture Drift Checks
      </label>
      <span class="setting-hint">Detect architecture drift using local policy rules.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="autoReview-requireApprovalForPatch" ${autoReviewRequireApproval ? 'checked' : ''} />
        Require Approval For Suggested Patches
      </label>
      <span class="setting-hint">Auto Review must never auto-apply patches.</span>
    </div>

    <h3>History &amp; Storage</h3>

    <div class="setting-row">
      <label class="setting-label">
        <input type="checkbox" id="autoReview-retentionEnabled" ${autoReviewRetentionEnabled ? 'checked' : ''} />
        Keep Auto Review History
      </label>
      <span class="setting-hint">Keep historical reports under .nexus/auto-reviews/reports.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-retentionMaxReports">Max Reports To Keep</label>
      <input type="number" id="autoReview-retentionMaxReports" min="10" max="1000" step="10" value="${autoReviewMaxReports}" />
      <span class="setting-hint">Maximum number of Auto Review reports to retain.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label" for="autoReview-retentionMaxAgeDays">Max Report Age (days)</label>
      <input type="number" id="autoReview-retentionMaxAgeDays" min="1" max="365" step="1" value="${autoReviewMaxAgeDays}" />
      <span class="setting-hint">Maximum age in days for retained Auto Review reports.</span>
    </div>

    <div class="setting-row">
      <label class="setting-label">Storage Location</label>
      <code>.nexus/auto-reviews/</code>
      <span class="setting-hint">Reports, history, baseline, patches, and logs are stored here.</span>
    </div>

    <div class="setting-actions">
      <button type="button" id="autoReview-runNow">Run Auto Review Now</button>
      <button type="button" id="autoReview-openLatest">Open Latest Report</button>
      <button type="button" id="autoReview-openHistory">Open History</button>
      <button type="button" id="autoReview-pruneHistory">Prune History</button>
    </div>
  </section>

  <button class="save-btn" id="saveBtn">Save Settings</button>
  <div class="status" id="status"></div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const base = ${safeJson};
      const providerRows = document.getElementById('providers');

      function setProviderStatus(id, text, className) {
        const el = document.querySelector('[data-provider-status="' + id + '"]');
        if (!el) return;
        el.textContent = text;
        el.className = 'provider-status ' + className;
      }

      function clearProviderActions(id) {
        const el = document.querySelector('[data-provider-actions="' + id + '"]');
        if (el) el.textContent = '';
        return el;
      }

      function addProviderButton(container, id, action, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'provider-action-btn';
        btn.textContent = label;
        btn.dataset.providerAction = action;
        btn.dataset.providerId = id;
        container.appendChild(btn);
      }

      function renderProviderInfo(info) {
        const actions = clearProviderActions(info.id);
        if (!actions) return;

        if (!info.installed) {
          const reason = info.reason ? ' (' + info.reason + ')' : '';
          setProviderStatus(info.id, 'Not installed' + reason, 'err');
          if (info.installCommand) {
            addProviderButton(actions, info.id, 'install', 'Install CLI');
          }
          return;
        }

        const version = info.version ? ' ' + info.version : '';
        const path = info.executablePath ? ' at ' + info.executablePath : '';
        const auth = info.authStatus === 'authenticated'
          ? 'Auth: authenticated.'
          : info.authStatus === 'unauthenticated'
            ? 'Auth: not logged in.'
            : 'Auth not verified.';
        const statusClass = info.authStatus === 'unauthenticated'
          ? 'warn'
          : info.authStatus === 'authenticated'
            ? 'ok'
            : 'muted';
        setProviderStatus(info.id, 'Installed' + version + path + '. ' + auth, statusClass);
        if (info.authStatus === 'unauthenticated' && info.loginCommand) {
          addProviderButton(actions, info.id, 'login', 'Login');
        }
      }

      document.getElementById('scanBtn').addEventListener('click', function () {
        const btn = document.getElementById('scanBtn');
        btn.disabled = true;
        btn.textContent = 'Scanning…';
        document.getElementById('status').textContent = '';
        document.querySelectorAll('#providers input[type=checkbox]').forEach(function (cb) {
          setProviderStatus(cb.name, 'Scanning…', 'muted');
          clearProviderActions(cb.name);
        });
        vscode.postMessage({ type: 'settings.scan' });
      });

      providerRows.addEventListener('click', function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const btn = target.closest('button[data-provider-action]');
        if (!btn) return;
        const action = btn.dataset.providerAction;
        const providerId = btn.dataset.providerId;
        if (!providerId) return;
        if (action === 'install') {
          vscode.postMessage({ type: 'settings.installProvider', providerId: providerId });
          document.getElementById('status').textContent = 'Install command opened in terminal. Review it and press Enter to run.';
          document.getElementById('status').className = 'status ok';
        } else if (action === 'login') {
          vscode.postMessage({ type: 'settings.loginProvider', providerId: providerId });
          document.getElementById('status').textContent = 'Login command opened in terminal. Review it and press Enter to run.';
          document.getElementById('status').className = 'status ok';
        }
      });

      document.getElementById('saveBtn').addEventListener('click', function () {
        const checkboxes = document.querySelectorAll('#providers input[type=checkbox]');
        const providers = Object.assign({}, base.providers);
        checkboxes.forEach(function (cb) {
          const id = cb.name;
          if (providers[id]) {
            providers[id] = Object.assign({}, providers[id], { enabled: cb.checked });
          }
        });
        const mcp = {
          enabled: document.getElementById('mcp-enabled').checked,
          autoSelectPreset: document.getElementById('mcp-auto-select').checked,
          requireApprovalForHighRiskTools: base.mcp.requireApprovalForHighRiskTools,
          maxResultChars: parseInt(document.getElementById('mcp-max-chars').value, 10) || base.mcp.maxResultChars,
          maxRoundsPerTask: parseInt(document.getElementById('mcp-max-rounds').value, 10) || base.mcp.maxRoundsPerTask,
          presets: {
            microsoftLearn: { enabled: document.getElementById('mcp-preset-microsoftLearn').checked },
            context7: {
              enabled: document.getElementById('mcp-preset-context7').checked,
              apiKey: base.mcp.presets.context7.apiKey || '',
            },
          },
        };
        const historyRag = {
          enabled: document.getElementById('history-rag-enabled').checked,
          maxResults: base.historyRag ? base.historyRag.maxResults : 5,
          maxChars: base.historyRag ? base.historyRag.maxChars : 6000,
          minScore: base.historyRag ? base.historyRag.minScore : 1.25,
        };
        const subagents = {
          enabled: document.getElementById('subagents-enabled').checked,
          mode: document.getElementById('subagents-mode').value,
          preset: document.getElementById('subagents-preset').value,
          maxRuns: parseInt(document.getElementById('subagents-maxRuns').value, 10) || 4,
          maxParallel: parseInt(document.getElementById('subagents-maxParallel').value, 10) || 2,
          hardCap: parseInt(document.getElementById('subagents-hardCap').value, 10) || 6,
          includeReviewer: document.getElementById('subagents-includeReviewer').checked,
          includeTester: document.getElementById('subagents-includeTester').checked,
          includeSecurity: document.getElementById('subagents-includeSecurity').checked,
          includeDocs: document.getElementById('subagents-includeDocs').checked,
          failOpen: document.getElementById('subagents-failOpen').checked,
          injectMaxChars: parseInt(document.getElementById('subagents-injectMaxChars').value, 10) || 8000,
          timeoutMs: parseInt(document.getElementById('subagents-timeoutMs').value, 10) || 30000,
          selectedRoles: base.subagents ? (base.subagents.selectedRoles || []) : [],
          modeOverrides: base.subagents ? (base.subagents.modeOverrides || {}) : {},
        };
        const reviewSteps = {
          reviewer:  document.getElementById('review-step-reviewer').checked,
          tester:    document.getElementById('review-step-tester').checked,
          security:  document.getElementById('review-step-security').checked,
          architect: document.getElementById('review-step-architect').checked,
        };
        const reviewSettings = {
          maxDiffChars: parseInt(document.getElementById('review-maxDiffChars').value, 10) || 60000,
        };
        const contextSettings = {
          maxChars:    parseInt(document.getElementById('context-maxChars').value, 10) || 100000,
          maxMessages: parseInt(document.getElementById('context-maxMessages').value, 10) || 20,
        };
        const projectMapSettings = {
          addToGitignore: document.getElementById('projectmap-add-gitignore').checked,
        };
        const autoReviewSettings = {
          enabled:                   document.getElementById('autoReview-enabled').checked,
          watchMode:                 document.getElementById('autoReview-watchMode').value,
          debounceMs:                parseInt(document.getElementById('autoReview-debounceMs').value, 10) || 2500,
          maxDiffChars:              parseInt(document.getElementById('autoReview-maxDiffChars').value, 10) || 60000,
          minRiskToRunAgent:         document.getElementById('autoReview-minRiskToRunAgent').value,
          baselineEnabled:           document.getElementById('autoReview-baselineEnabled').checked,
          architectureDriftEnabled:  document.getElementById('autoReview-architectureDriftEnabled').checked,
          requireApprovalForPatch:   document.getElementById('autoReview-requireApprovalForPatch').checked,
          retentionEnabled:          document.getElementById('autoReview-retentionEnabled').checked,
          retentionMaxReports:       parseInt(document.getElementById('autoReview-retentionMaxReports').value, 10) || 100,
          retentionMaxAgeDays:       parseInt(document.getElementById('autoReview-retentionMaxAgeDays').value, 10) || 30,
        };
        const config = Object.assign({}, base, { providers: providers, mcp: mcp, historyRag: historyRag, subagents: subagents });
        vscode.postMessage({ type: 'settings.save', payload: config, reviewSteps: reviewSteps, reviewSettings: reviewSettings, contextSettings: contextSettings, projectMapSettings: projectMapSettings, autoReviewSettings: autoReviewSettings });
      });

      document.getElementById('autoReview-runNow')?.addEventListener('click', function() {
        vscode.postMessage({ type: 'settings.autoReview.runNow' });
      });
      document.getElementById('autoReview-openLatest')?.addEventListener('click', function() {
        vscode.postMessage({ type: 'settings.autoReview.openLatest' });
      });
      document.getElementById('autoReview-openHistory')?.addEventListener('click', function() {
        vscode.postMessage({ type: 'settings.autoReview.openHistory' });
      });
      document.getElementById('autoReview-pruneHistory')?.addEventListener('click', function() {
        vscode.postMessage({ type: 'settings.autoReview.pruneHistory' });
      });

      window.addEventListener('message', function (event) {
        const msg = event.data;
        const status = document.getElementById('status');

        if (msg.type === 'settings.scanResult') {
          const btn = document.getElementById('scanBtn');
          btn.disabled = false;
          btn.textContent = 'Scan for CLIs';
          const detectionMap = {};
          (msg.detection || []).forEach(function (d) { detectionMap[d.id] = d; });
          const checkboxes = document.querySelectorAll('#providers input[type=checkbox]');
          checkboxes.forEach(function (cb) {
            const info = detectionMap[cb.name];
            if (info !== undefined) {
              cb.checked = info.installed;
              renderProviderInfo(info);
            } else {
              setProviderStatus(cb.name, 'No detector configured.', 'muted');
              clearProviderActions(cb.name);
            }
          });
          const found = (msg.detection || []).filter(function (d) { return d.installed; }).length;
          status.textContent = 'Scan complete. ' + found + ' CLI(s) found.';
          status.className = 'status ok';
          return;
        }

        if (msg.type === 'settings.saved') {
          status.textContent = 'Settings saved.';
          status.className = 'status ok';
        } else if (msg.type === 'settings.error') {
          status.textContent = 'Error: ' + msg.message;
          status.className = 'status err';
        }
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

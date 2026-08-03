import * as vscode from 'vscode';
import { ConfigService } from '../config/ConfigService';
import { ProviderDetector } from '../provider-hub/ProviderDetector';
import type { ProviderId } from '../core/types';
import type { McpCustomServerConfig } from '../config/NexusConfig';
import type { IMcpBroker } from '../mcp/McpBroker';
import { buildCustomPresets } from '../mcp/McpCustomServers';
import { getSettingsHtml } from './SettingsHtml';
import { redactConfigSecrets, rehydrateConfigSecrets } from './McpServerModel';

/** A hung HTTP connect or stdio spawn must not leave the Test button spinning. */
const MCP_TEST_TIMEOUT_MS = 10_000;

export interface SettingsPanelDeps {
  mcpBroker?: IMcpBroker;
  onSaved?: () => void;
}

const TIMEOUT_MESSAGE = 'MCP connection timed out.';

/**
 * Note: this bounds how long the user waits, not the connection itself —
 * Promise.race cannot cancel an in-flight connect. Safe for a manual button;
 * do not reuse it for automatic probing.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export class SettingsPanel {
  static readonly viewType = 'nexus.settings';
  private static instance: SettingsPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly configService: ConfigService;
  private readonly detector: ProviderDetector;
  private readonly mcpBroker?: IMcpBroker;
  private readonly onSaved?: () => void;
  private readonly disposables: vscode.Disposable[] = [];

  static async createOrShow(
    extensionUri: vscode.Uri,
    configService: ConfigService,
    detector: ProviderDetector,
    deps?: SettingsPanelDeps,
  ): Promise<void> {
    if (SettingsPanel.instance) {
      SettingsPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      'Nexus Settings',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    SettingsPanel.instance = new SettingsPanel(panel, extensionUri, configService, detector, deps);
    await SettingsPanel.instance._update();
  }

  private constructor(
    panel: vscode.WebviewPanel,
    _extensionUri: vscode.Uri,
    configService: ConfigService,
    detector: ProviderDetector,
    deps?: SettingsPanelDeps,
  ) {
    this.panel = panel;
    this.configService = configService;
    this.detector = detector;
    this.mcpBroker = deps?.mcpBroker;
    this.onSaved = deps?.onSaved;

    this.panel.webview.onDidReceiveMessage(
      (msg: unknown) => { void this._handleMessage(msg); },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async _update(): Promise<void> {
    const config = await this.configService.loadConfig();
    const vsCfg = vscode.workspace.getConfiguration('nexus');
    const vsCodeConfig = {
      historyRagEnabled:       vsCfg.get<boolean>('historyRag.enabled', true),
      reviewStepReviewer:      vsCfg.get<boolean>('review.steps.reviewer', true),
      reviewStepTester:        vsCfg.get<boolean>('review.steps.tester', true),
      reviewStepSecurity:      vsCfg.get<boolean>('review.steps.security', true),
      reviewStepArchitect:     vsCfg.get<boolean>('review.steps.architect', true),
      reviewMaxDiffChars:      vsCfg.get<number>('review.maxDiffChars', 60_000),
      contextMaxChars:         vsCfg.get<number>('context.maxChars', 100_000),
      contextMaxMessages:      vsCfg.get<number>('context.maxMessages', 20),
      projectMapAddToGitignore: vsCfg.get<boolean>('projectMap.addToGitignore', false),
      autoReviewEnabled:                  vsCfg.get<boolean>('autoReview.enabled', false),
      autoReviewWatchMode:                vsCfg.get<string>('autoReview.watchMode', 'workingTree'),
      autoReviewDebounceMs:               vsCfg.get<number>('autoReview.debounceMs', 2500),
      autoReviewMaxDiffChars:             vsCfg.get<number>('autoReview.maxDiffChars', 60000),
      autoReviewMinRiskToRunAgent:        vsCfg.get<string>('autoReview.minRiskToRunAgent', 'medium'),
      autoReviewBaselineEnabled:          vsCfg.get<boolean>('autoReview.baseline.enabled', true),
      autoReviewArchitectureDriftEnabled: vsCfg.get<boolean>('autoReview.architectureDrift.enabled', true),
      autoReviewRequireApprovalForPatch:  vsCfg.get<boolean>('autoReview.requireApprovalForPatch', true),
      autoReviewRetentionEnabled:         vsCfg.get<boolean>('autoReview.retention.enabled', true),
      autoReviewRetentionMaxReports:      vsCfg.get<number>('autoReview.retention.maxReports', 100),
      autoReviewRetentionMaxAgeDays:      vsCfg.get<number>('autoReview.retention.maxAgeDays', 30),
    };
    this.panel.webview.html = getSettingsHtml(this.panel.webview, config, vsCodeConfig);
  }

  private async _handleMessage(msg: unknown): Promise<void> {
    if (typeof msg !== 'object' || msg === null) return;

    const type = (msg as Record<string, unknown>)['type'];

    if (type === 'settings.scan') {
      const detection = await this.detector.detectAll();
      await this.panel.webview.postMessage({ type: 'settings.scanResult', detection });
      return;
    }

    if (type === 'settings.installProvider' || type === 'settings.loginProvider') {
      const providerId = (msg as Record<string, unknown>)['providerId'];
      if (typeof providerId !== 'string') return;
      await this.openProviderTerminal(
        providerId as ProviderId,
        type === 'settings.installProvider' ? 'install' : 'login',
      );
      return;
    }

    if (type === 'settings.autoReview.runNow') {
      await vscode.commands.executeCommand('nexus.autoReview.runNow');
      return;
    }
    if (type === 'settings.autoReview.openLatest') {
      await vscode.commands.executeCommand('nexus.autoReview.openLatest');
      return;
    }
    if (type === 'settings.autoReview.openHistory') {
      await vscode.commands.executeCommand('nexus.autoReview.openHistory');
      return;
    }
    if (type === 'settings.autoReview.pruneHistory') {
      await vscode.commands.executeCommand('nexus.autoReview.pruneHistory');
      return;
    }

    // NOTE: any new message type must be registered ABOVE the settings.save
    // guard below, which drops everything else.
    if (type === 'settings.testMcpServer') {
      await this.testMcpServer(msg as Record<string, unknown>);
      return;
    }

    if (type !== 'settings.save') return;

    const payload = (msg as Record<string, unknown>)['payload'];
    try {
      // Secrets reach the webview as a sentinel; restore the real values from
      // disk before writing, so an unchanged token survives a round trip.
      const origins = ((msg as Record<string, unknown>)['mcpSecretOrigins'] ?? {}) as Record<string, string>;
      rehydrateConfigSecrets(payload, await this.configService.loadConfig(), origins);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.configService.saveConfig(payload as any);
      const vsCfg = vscode.workspace.getConfiguration('nexus');
      // Sync historyRag.enabled to VS Code workspace settings so RunTaskHandler picks it up
      const p = payload as Record<string, unknown>;
      const historyRag = p['historyRag'] as Record<string, unknown> | undefined;
      if (historyRag && typeof historyRag['enabled'] === 'boolean') {
        await vsCfg.update('historyRag.enabled', historyRag['enabled'], vscode.ConfigurationTarget.Workspace);
      }
      // Mirror mcp.enabled so the VS Code Settings UI stays consistent
      // (runtime reads MCP enablement from .nexus/config.json via ConfigService)
      const mcp = p['mcp'] as Record<string, unknown> | undefined;
      if (mcp && typeof mcp['enabled'] === 'boolean') {
        await vsCfg.update('mcp.enabled', mcp['enabled'], vscode.ConfigurationTarget.Workspace);
      }
      // Sync review step toggles to VS Code workspace settings
      const reviewSteps = (msg as Record<string, unknown>)['reviewSteps'] as Record<string, unknown> | undefined;
      if (reviewSteps) {
        for (const key of ['reviewer', 'tester', 'security', 'architect'] as const) {
          if (typeof reviewSteps[key] === 'boolean') {
            await vsCfg.update(`review.steps.${key}`, reviewSteps[key], vscode.ConfigurationTarget.Workspace);
          }
        }
      }
      // Sync review limit settings to VS Code workspace settings
      const reviewSettings = (msg as Record<string, unknown>)['reviewSettings'] as Record<string, unknown> | undefined;
      if (reviewSettings && typeof reviewSettings['maxDiffChars'] === 'number') {
        await vsCfg.update('review.maxDiffChars', reviewSettings['maxDiffChars'], vscode.ConfigurationTarget.Workspace);
      }
      // Sync context window settings to VS Code workspace settings
      const contextSettings = (msg as Record<string, unknown>)['contextSettings'] as Record<string, unknown> | undefined;
      if (contextSettings) {
        if (typeof contextSettings['maxChars'] === 'number') {
          await vsCfg.update('context.maxChars', contextSettings['maxChars'], vscode.ConfigurationTarget.Workspace);
        }
        if (typeof contextSettings['maxMessages'] === 'number') {
          await vsCfg.update('context.maxMessages', contextSettings['maxMessages'], vscode.ConfigurationTarget.Workspace);
        }
      }
      // Sync project map settings to VS Code workspace settings
      const projectMapSettings = (msg as Record<string, unknown>)['projectMapSettings'] as Record<string, unknown> | undefined;
      if (projectMapSettings && typeof projectMapSettings['addToGitignore'] === 'boolean') {
        await vsCfg.update('projectMap.addToGitignore', projectMapSettings['addToGitignore'], vscode.ConfigurationTarget.Workspace);
      }
      const autoReviewSettings = (msg as Record<string, unknown>)['autoReviewSettings'] as Record<string, unknown> | undefined;
      if (autoReviewSettings) {
        const boolKeys: string[] = ['enabled', 'baselineEnabled', 'architectureDriftEnabled', 'requireApprovalForPatch', 'retentionEnabled'];
        const numKeys: string[] = ['debounceMs', 'maxDiffChars', 'retentionMaxReports', 'retentionMaxAgeDays'];
        const strKeys: string[] = ['watchMode', 'minRiskToRunAgent'];
        const keyMap: Record<string, string> = {
          enabled: 'autoReview.enabled',
          watchMode: 'autoReview.watchMode',
          debounceMs: 'autoReview.debounceMs',
          maxDiffChars: 'autoReview.maxDiffChars',
          minRiskToRunAgent: 'autoReview.minRiskToRunAgent',
          baselineEnabled: 'autoReview.baseline.enabled',
          architectureDriftEnabled: 'autoReview.architectureDrift.enabled',
          requireApprovalForPatch: 'autoReview.requireApprovalForPatch',
          retentionEnabled: 'autoReview.retention.enabled',
          retentionMaxReports: 'autoReview.retention.maxReports',
          retentionMaxAgeDays: 'autoReview.retention.maxAgeDays',
        };
        for (const [flatKey, configKey] of Object.entries(keyMap)) {
          const val = autoReviewSettings[flatKey];
          if (boolKeys.includes(flatKey) && typeof val === 'boolean') {
            await vsCfg.update(configKey, val, vscode.ConfigurationTarget.Workspace);
          } else if (numKeys.includes(flatKey) && typeof val === 'number') {
            await vsCfg.update(configKey, val, vscode.ConfigurationTarget.Workspace);
          } else if (strKeys.includes(flatKey) && typeof val === 'string') {
            await vsCfg.update(configKey, val, vscode.ConfigurationTarget.Workspace);
          }
        }
      }
      // The panel HTML is only rendered once, so echo back what was written
      // (redacted) to let the webview re-seed its MCP list.
      await this.panel.webview.postMessage({
        type: 'settings.saved',
        mcp: redactConfigSecrets({ mcp: (p['mcp'] ?? {}) as Record<string, unknown> }).mcp,
      });
      vscode.window.showInformationMessage('Nexus settings saved.');
      this.onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.panel.webview.postMessage({ type: 'settings.error', message });
    }
  }

  /**
   * Probes one custom MCP server with tools/list. Validity is delegated to
   * buildCustomPresets so the button tests exactly the preset the runtime would
   * build, with no duplicated rules here.
   */
  private async testMcpServer(msg: Record<string, unknown>): Promise<void> {
    const requestId = String(msg['requestId'] ?? '');
    const name = String(msg['name'] ?? '');
    const server = msg['server'] as McpCustomServerConfig | undefined;

    const post = (result: Record<string, unknown>): Promise<boolean> =>
      Promise.resolve(this.panel.webview.postMessage({
        type: 'settings.mcpTestResult', requestId, name, ...result,
      })) as Promise<boolean>;

    if (!server || !this.mcpBroker) {
      await post({ ok: false, code: 'failed', error: 'MCP testing is unavailable in this session.' });
      return;
    }

    // Testing a masked-but-unchanged token has to use the real value.
    const origName = typeof msg['origName'] === 'string' ? msg['origName'] : name;
    const wrapped = { mcp: { customServers: { [name]: server } } };
    rehydrateConfigSecrets(wrapped, await this.configService.loadConfig(), { [name]: origName });

    const presets = buildCustomPresets(wrapped.mcp.customServers);
    if (presets.length === 0) {
      await post({
        ok: false,
        code: 'invalid',
        error: 'This server is incomplete: HTTP needs a valid URL, stdio needs a command.',
      });
      return;
    }

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    try {
      const tools = await withTimeout(
        this.mcpBroker.listTools({ preset: presets[0].preset, cwd }),
        MCP_TEST_TIMEOUT_MS,
      );
      await post({
        ok: true,
        toolCount: tools.length,
        tools: tools.slice(0, 5).map(tool => tool.name),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.message === TIMEOUT_MESSAGE;
      await post({
        ok: false,
        code: timedOut ? 'timeout' : 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async openProviderTerminal(providerId: ProviderId, action: 'install' | 'login'): Promise<void> {
    const command = action === 'install'
      ? this.detector.getInstallCommand(providerId)
      : this.detector.getLoginCommand(providerId);

    if (!command) {
      await this.panel.webview.postMessage({
        type: 'settings.error',
        message: `No ${action} command configured for ${providerId}.`,
      });
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: `Nexus AI Code: ${action === 'install' ? 'Install' : 'Login'} ${providerId}`,
    });
    terminal.sendText(command, false);
    terminal.show();
    vscode.window.showInformationMessage(
      `Nexus AI Code opened the ${action} command in a terminal. Review it and press Enter to run.`,
    );

    const disposable = vscode.window.onDidCloseTerminal(t => {
      if (t !== terminal) return;
      disposable.dispose();
      this.detector.invalidate();
      void this.postScanResult();
    });
    this.disposables.push(disposable);
  }

  private async postScanResult(): Promise<void> {
    const detection = await this.detector.detectAll();
    await this.panel.webview.postMessage({ type: 'settings.scanResult', detection });
  }

  dispose(): void {
    SettingsPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) { d.dispose(); }
    this.disposables.length = 0;
  }
}

import * as vscode from 'vscode';
import { ConfigService } from '../config/ConfigService';
import { ProviderDetector } from '../provider-hub/ProviderDetector';
import type { ProviderId } from '../core/types';
import { getSettingsHtml } from './SettingsHtml';

export class SettingsPanel {
  static readonly viewType = 'nexus.settings';
  private static instance: SettingsPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly configService: ConfigService;
  private readonly detector: ProviderDetector;
  private readonly onSaved?: () => void;
  private readonly disposables: vscode.Disposable[] = [];

  static async createOrShow(
    extensionUri: vscode.Uri,
    configService: ConfigService,
    detector: ProviderDetector,
    onSaved?: () => void,
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

    SettingsPanel.instance = new SettingsPanel(panel, extensionUri, configService, detector, onSaved);
    await SettingsPanel.instance._update();
  }

  private constructor(
    panel: vscode.WebviewPanel,
    _extensionUri: vscode.Uri,
    configService: ConfigService,
    detector: ProviderDetector,
    onSaved?: () => void,
  ) {
    this.panel = panel;
    this.configService = configService;
    this.detector = detector;
    this.onSaved = onSaved;

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
      historyRagEnabled:   vsCfg.get<boolean>('historyRag.enabled', true),
      reviewStepReviewer:  vsCfg.get<boolean>('review.steps.reviewer', true),
      reviewStepTester:    vsCfg.get<boolean>('review.steps.tester', true),
      reviewStepSecurity:  vsCfg.get<boolean>('review.steps.security', true),
      reviewStepArchitect: vsCfg.get<boolean>('review.steps.architect', true),
      contextMaxChars:     vsCfg.get<number>('context.maxChars', 100_000),
      contextMaxMessages:  vsCfg.get<number>('context.maxMessages', 20),
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

    if (type !== 'settings.save') return;

    const payload = (msg as Record<string, unknown>)['payload'];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.configService.saveConfig(payload as any);
      const vsCfg = vscode.workspace.getConfiguration('nexus');
      // Sync historyRag.enabled to VS Code workspace settings so RunTaskHandler picks it up
      const p = payload as Record<string, unknown>;
      const historyRag = p['historyRag'] as Record<string, unknown> | undefined;
      if (historyRag && typeof historyRag['enabled'] === 'boolean') {
        await vsCfg.update('historyRag.enabled', historyRag['enabled'], vscode.ConfigurationTarget.Workspace);
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
      await this.panel.webview.postMessage({ type: 'settings.saved' });
      vscode.window.showInformationMessage('Nexus settings saved.');
      this.onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.panel.webview.postMessage({ type: 'settings.error', message });
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

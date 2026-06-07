import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import type { ProviderId } from '../../core/types';
import { ProviderDetector } from '../../core/providerDetector';
import { ConfigService } from '../../config/ConfigService';
import {
  buildAgentCapabilityMatrix,
  buildAgentRecommendations,
} from '../../application/nexus/AgentCapabilityMatrix';

const SAVED_PROVIDER_KEY = 'nexus.lastProvider';

export class ProviderHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly detector: ProviderDetector,
    private readonly configService: ConfigService,
    private readonly globalState: vscode.Memento,
  ) {}

  async sendAvailable(): Promise<void> {
    const detection = await this.detector.detectAll();
    const capabilityMatrix = buildAgentCapabilityMatrix();
    const configured = await this.configService.hasConfig();
    if (!configured) {
      this.post({
        type: 'availableProviders',
        providers: [],
        detection,
        needsSetup: true,
        capabilityMatrix,
        recommendations: buildAgentRecommendations([]),
      });
      await vscode.commands.executeCommand('nexus.openSettings');
      return;
    }
    const config = await this.configService.loadConfig();
    const providers = detection
      .filter(d => d.installed && config.providers[d.id as keyof typeof config.providers]?.enabled)
      .map(d => d.id);
    const recommendationProviders = providers.length > 0 ? providers : ['custom'];
    const savedProvider = this.globalState.get<string>(SAVED_PROVIDER_KEY);
    this.post({
      type: 'availableProviders',
      providers,
      detection,
      needsSetup: false,
      savedProvider,
      capabilityMatrix,
      recommendations: buildAgentRecommendations(recommendationProviders),
    });
  }

  async refresh(): Promise<void> {
    await this.sendAvailable();
  }

  async save(provider: ProviderId): Promise<void> {
    await this.globalState.update(SAVED_PROVIDER_KEY, provider);
  }
}

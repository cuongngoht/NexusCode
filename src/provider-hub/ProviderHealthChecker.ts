import { ProviderDetector } from './ProviderDetector';
import type { ProviderAuthStatus } from './ProviderTypes';
import type { ProviderId } from '../core/types';
import { getAllProviderSpecs, getProviderSpec } from './ProviderSpecRegistry';
import { ProviderModelLister } from './ProviderModelLister';

export interface ProviderHealthEntry {
  id: ProviderId;
  displayName: string;
  installed: boolean;
  version?: string;
  executablePath?: string;
  authStatus: ProviderAuthStatus;
  modelCount: number;
  defaultModel?: string;
  issues: string[];
  installCommand?: string;
  loginCommand?: string;
}

export interface ProviderHealthReport {
  generatedAt: string;
  entries: ProviderHealthEntry[];
}

export class ProviderHealthChecker {
  private readonly detector: ProviderDetector;
  private readonly modelLister: ProviderModelLister;

  constructor(detector?: ProviderDetector, modelLister?: ProviderModelLister) {
    this.detector = detector ?? new ProviderDetector();
    this.modelLister = modelLister ?? new ProviderModelLister();
  }

  async check(onlyId?: ProviderId): Promise<ProviderHealthReport> {
    const specs = onlyId
      ? getProviderSpec(onlyId) ? [getProviderSpec(onlyId)!] : []
      : [...getAllProviderSpecs()];

    const entries: ProviderHealthEntry[] = await Promise.all(
      specs.map(async spec => {
        try {
          const detection = onlyId
            ? await this.detector.detectOne(spec.id)
            : undefined;
          // For full scan, use detectAll to share work across entries
          // Individual id path uses detectOne above
          const det = detection ?? await this.detector.detectOne(spec.id);
          const models = await this.modelLister.list(spec.id);
          const modelCount = models.length;

          const issues: string[] = [];

          if (!det || !det.installed) {
            issues.push('missing_cli');
          } else if (det.authStatus === 'unauthenticated') {
            issues.push('unauthenticated');
          }

          if (modelCount === 0) {
            issues.push('no_models');
          }

          return {
            id: spec.id,
            displayName: spec.displayName,
            installed: det?.installed ?? false,
            version: det?.version,
            executablePath: det?.executablePath,
            authStatus: det?.authStatus ?? 'unknown',
            modelCount,
            defaultModel: spec.defaultModel,
            issues,
            installCommand: det?.installCommand,
            loginCommand: spec.loginCommand,
          } satisfies ProviderHealthEntry;
        } catch {
          return {
            id: spec.id,
            displayName: spec.displayName,
            installed: false,
            authStatus: 'unknown',
            modelCount: 0,
            issues: ['missing_cli'],
            installCommand: this.detector.getInstallCommand(spec.id),
            loginCommand: spec.loginCommand,
          } satisfies ProviderHealthEntry;
        }
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      entries,
    };
  }
}

import * as vscode from 'vscode';
import type { ProviderId } from '../../core/types';
import type { ProviderDetector } from '../../provider-hub/ProviderDetector';
import type { ProviderHandler } from './ProviderHandler';

export class LoginHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly detector: ProviderDetector,
    private readonly providerHandler: ProviderHandler,
  ) {}

  async handle(providerId: string): Promise<void> {
    const command = this.detector.getLoginCommand(providerId as ProviderId);
    if (!command) return;

    const terminal = vscode.window.createTerminal({ name: `Nexus AI Code: Login ${providerId}` });
    terminal.sendText(command, false);
    terminal.show();
    vscode.window.showInformationMessage(
      'Nexus AI Code opened the login command in a terminal. Review it and press Enter to run.',
    );

    const listener = vscode.window.onDidCloseTerminal(t => {
      if (t === terminal) {
        listener.dispose();
        this.detector.invalidate();
        void this.providerHandler.refresh();
      }
    });
    this.disposables.push(listener);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}

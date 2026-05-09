import * as vscode from 'vscode';
import { SkillsPanel } from '../webview/SkillsPanel';
import { logToOutput } from '../common/UI';

/**
 * MarketplaceCommands - Registers and handles marketplace-related commands
 */
export class MarketplaceCommands {
  private extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    this.register();
  }

  /**
   * Register all marketplace commands
   */
  private register(): void {
    // Open Marketplace
    this.disposables.push(
      vscode.commands.registerCommand('Skills.OpenMarketplace', async () => {
        logToOutput('[Commands] Opening Skills Marketplace');
        await SkillsPanel.createOrShow(this.extensionUri);
      })
    );

    logToOutput('[Commands] Marketplace commands registered');
  }

  /**
   * Dispose all registered commands
   */
  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}

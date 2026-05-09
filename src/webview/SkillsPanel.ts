import * as vscode from 'vscode';
import { logToOutput } from '../common/UI';
import { skillsApiService } from '../services';
import { getStorageService } from '../services/SkillsStorageService';
import { toolInstallService } from '../services';
import { Skill } from '../services/types';
import { SkillDetailPanel } from './SkillDetailPanel';

/**
 * SkillsPanel - Manages the marketplace webview panel
 */
export class SkillsPanel {
  public static currentPanel: SkillsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly currentToolName: string;
  private readonly currentToolDisplayName: string;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    const currentTool = this.resolveCurrentTool();
    this.currentToolName = currentTool.name;
    this.currentToolDisplayName = currentTool.displayName;

    // Set up event listeners
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this.disposables
    );

    // Initial setup
    this.update();
  }

  /**
   * Create or show the Skills Marketplace panel
   */
  public static async createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (SkillsPanel.currentPanel) {
      SkillsPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create the panel
    const panel = vscode.window.createWebviewPanel(
      'skillsMarketplace',
      'Skills Marketplace',
      column,
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'marketplace')]
      }
    );

    SkillsPanel.currentPanel = new SkillsPanel(panel, extensionUri);
    logToOutput('[Webview] Skills Marketplace opened');
  }

  /**
   * Dispose the panel
   */
  private dispose() {
    SkillsPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Update the webview content
   */
  private update() {
    this.panel.webview.html = this.getHtmlContent();
  }

  /**
   * Handle messages from the webview
   */
  private async handleWebviewMessage(message: any) {
    logToOutput(`[Webview] Message received: ${message.type}`);

    switch (message.type) {
      case 'search':
        await this.handleSearch(message.query);
        break;
      case 'openSkillDetails':
        await this.handleOpenSkillDetails(message.skill);
        break;
      case 'install':
        await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
        break;
      case 'uninstall':
        await this.handleUninstall(message.skillId);
        break;
      case 'getInstalledSkills':
        await this.handleGetInstalledSkills();
        break;
      default:
        logToOutput(`[Webview] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle skill search
   */
  private async handleSearch(query: string) {
    try {
      if (!query || query.trim().length === 0) {
        this.postMessage({
          type: 'searchResults',
          results: [],
          error: null
        });
        return;
      }

      logToOutput(`[Webview] Searching for: ${query}`);
      const skills = await skillsApiService.search(query);

      this.postMessage({
        type: 'searchResults',
        results: skills,
        error: null
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Search error: ${errorMsg}`);

      this.postMessage({
        type: 'searchResults',
        results: [],
        error: errorMsg
      });
    }
  }

  /**
   * Load detail data for a selected skill.
   */
  private async handleOpenSkillDetails(skill: Skill) {
    try {
      if (!skill?.githubUrl) {
        throw new Error('This skill does not expose a GitHub URL.');
      }

      await SkillDetailPanel.createOrShow(
        this.extensionUri,
        skill,
        this.currentToolName,
        this.currentToolDisplayName
      );

      this.postMessage({
        type: 'openSkillDetailsResult',
        success: true,
        error: null
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Details error: ${errorMsg}`);
      this.postMessage({
        type: 'openSkillDetailsResult',
        success: false,
        error: errorMsg
      });
    }
  }

  /**
   * Handle skill installation
   */
  private async handleInstall(skillId: string, skillName: string, githubUrl: string) {
    try {
      logToOutput(`[Webview] Installing ${skillName} to ${this.currentToolName}`);

      const installPath = await toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);

      // Update storage
      const storage = getStorageService();
      await storage.addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installPath);

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: `Successfully installed ${skillName}`,
        error: null
      });

      logToOutput(`[Webview] Installation completed: ${skillId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Installation error: ${errorMsg}`);

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: false,
        message: null,
        error: errorMsg
      });
    }
  }

  /**
   * Handle skill uninstallation
   */
  private async handleUninstall(skillId: string) {
    try {
      logToOutput(`[Webview] Uninstalling ${skillId} from ${this.currentToolName}`);

      const storage = getStorageService();
      const installed = storage.getInstalledSkill(this.currentToolName, skillId);

      if (!installed) {
        throw new Error('Skill not found in storage');
      }

      await toolInstallService.uninstallSkill(this.currentToolName, skillId, installed.localPath);
      await storage.removeInstalled(this.currentToolName, skillId);

      this.postMessage({
        type: 'uninstallResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: 'Successfully uninstalled skill',
        error: null
      });

      logToOutput(`[Webview] Uninstallation completed: ${skillId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Uninstallation error: ${errorMsg}`);

      this.postMessage({
        type: 'uninstallResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: false,
        message: null,
        error: errorMsg
      });
    }
  }

  /**
   * Get installed skills across all tools
   */
  private async handleGetInstalledSkills() {
    try {
      const storage = getStorageService();
      const installed = storage.getInstalledByTool(this.currentToolName);

      this.postMessage({
        type: 'installedSkills',
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        installed
      });

      logToOutput(`[Webview] Retrieved installed skills`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Error getting installed skills: ${errorMsg}`);

      this.postMessage({
        type: 'installedSkills',
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        installed: []
      });
    }
  }

  /**
   * Resolve the current host where extension is running.
   */
  private resolveCurrentTool(): { name: string; displayName: string } {
    const appName = vscode.env.appName.toLowerCase();

    if (appName.includes('windsurf')) {
      return { name: 'windsurf', displayName: 'Windsurf' };
    }

    if (appName.includes('cursor')) {
      return { name: 'cursor', displayName: 'Cursor' };
    }

    if (appName.includes('antigravity')) {
      return { name: 'antigravity', displayName: 'Antigravity' };
    }

    return { name: 'vscode', displayName: 'Visual Studio Code' };
  }

  /**
   * Post a message to the webview
   */
  private postMessage(message: any) {
    this.panel.webview.postMessage(message);
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(): string {
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.css')
    );

    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skills Marketplace</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app">
    <div class="marketplace-container">
      <div class="search-section">
        <input
          type="text"
          id="searchInput"
          class="search-input"
          placeholder="Search for skills..."
          aria-label="Search skills"
        />
      </div>

      <div class="content-section">
        <div id="loadingIndicator" class="loading hidden">
          <span class="spinner"></span> Loading...
        </div>

        <div id="skillsList" class="skills-list"></div>

        <div id="errorMessage" class="error-message hidden"></div>

        <div id="emptyState" class="empty-state">
          <p>Search for skills to get started</p>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a nonce for inline scripts
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

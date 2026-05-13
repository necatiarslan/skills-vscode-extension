import * as vscode from 'vscode';
import { logToOutput } from '../common/UI';
import { skillsApiService } from '../services';
import { getStorageService } from '../services/SkillsStorageService';
import { toolInstallService } from '../services';
import { Skill } from '../services/types';
import { SkillDetailPanel } from './SkillDetailPanel';

/**
 * SkillsPanel - WebviewViewProvider for rendering marketplace in sidebar
 */
export class SkillsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'SkillsView';
  private view?: vscode.WebviewView;
  private readonly extensionUri: vscode.Uri;
  private readonly currentToolName: string;
  private readonly currentToolDisplayName: string;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    const currentTool = this.resolveCurrentTool();
    this.currentToolName = currentTool.name;
    this.currentToolDisplayName = currentTool.displayName;
  }

  /**
   * Resolve the webview view
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media', 'extension')]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this.disposables
    );

    logToOutput('[SkillsPanel] Skills Marketplace view resolved');
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
      case 'openSkillDetailsById':
        await this.handleOpenSkillDetailsById(message.skillId);
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
          query,
          results: [],
          error: null
        });
        return;
      }

      logToOutput(`[Webview] Searching for: ${query}`);
      const skills = await skillsApiService.search(query);

      this.postMessage({
        type: 'searchResults',
        query,
        results: skills,
        error: null
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Search error: ${errorMsg}`);

      this.postMessage({
        type: 'searchResults',
        query,
        results: [],
        error: errorMsg
      });
    }
  }

  /**
   * Load detail data for a selected skill id.
   */
  private async handleOpenSkillDetailsById(skillId: string) {
    try {
      if (!skillId) {
        throw new Error('Skill id is required.');
      }

      const skill = await skillsApiService.fetchDetail(skillId);

      if (!skill) {
        throw new Error('Skill detail was not found.');
      }

      await this.handleOpenSkillDetails(skill);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Details-by-id error: ${errorMsg}`);
      this.postMessage({
        type: 'openSkillDetailsResult',
        success: false,
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
    if (this.view) {
      this.view.webview.postMessage(message);
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const skillspanelCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillspanel.css')
    );
    const skillspanelJs = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillspanel.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skills Marketplace</title>
    <link rel="stylesheet" href="${skillspanelCss}">
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css"
      id="vscode-codicon-stylesheet"
    >
    <script type="module">
      import 'https://esm.sh/@vscode-elements/elements';
    </script>
</head>
<body>
  <div id="app">
    <div class="marketplace-container">
      <div class="search-section">
        <vscode-textfield id="searchInput" class="search-input" placeholder="Search Skills..." aria-label="Search skills" autocomplete="off">
          <vscode-icon slot="content-before" name="search" title="search"></vscode-icon>
        </vscode-textfield>
      </div>

      <div class="content-section" id="contentSection">
        <div id="errorMessage" class="error-message hidden"></div>

        <vscode-collapsible id="searchCollapsible" heading="Search" class="collapsible" open>
          <vscode-badge id="searchCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="searchTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="installedCollapsible" heading="Installed" class="collapsible">
          <vscode-badge id="installedCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="recommendedCollapsible" heading="Recommended" class="collapsible">
          <vscode-badge id="recommendedCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="recommendedTable" class="section-table"></div>
        </vscode-collapsible>

        <div id="emptyState" class="empty-state">Search for skills to populate results.</div>
      </div>
    </div>
  </div>
    <script src="${skillspanelJs}"></script>
</body>
</html>`;
  }

  /**
   * Dispose resources
   */
  public dispose() {
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

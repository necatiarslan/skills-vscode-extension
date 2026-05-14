import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSkillAgentLocation } from '../common/SkillLocationConfig';
import { logToOutput } from '../common/UI';
import { skillsApiService } from '../services';
import { getStorageService } from '../services/SkillsStorageService';
import { toolInstallService } from '../services';
import {
  MarketplaceInstalledGroups,
  MarketplaceInstalledSkill,
  Skill,
  SkillInstallScope,
  ToolConfig
} from '../services/types';
import { SkillDetailUnManagedPanel } from './SkillDetailUnManagedPanel';
import { SkillDetailPanel } from './SkillDetailPanel';

/**
 * SkillsPanel - WebviewViewProvider for rendering marketplace in sidebar
 */
export class SkillsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'SkillsView';
  public static Current: SkillsPanel | undefined;
  private view?: vscode.WebviewView;
  private readonly extensionUri: vscode.Uri;
  private readonly currentToolName: string;
  private readonly currentToolDisplayName: string;
  private disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    SkillsPanel.Current = this;
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

  public refreshInstalledSkills(): void {
    if (!this.view) {
      return;
    }

    this.handleGetInstalledSkills();
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
      case 'openUnmanagedSkillDetails':
        await this.handleOpenUnmanagedSkillDetails(message.skill);
        break;
      case 'install':
        await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
        break;
      case 'uninstall':
        await this.handleUninstall(message.skillId);
        break;
      case 'openInstalledFolder':
        await this.handleOpenInstalledFolder(message.skillId, message.localPath);
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
   * Load detail data for an unmanaged skill.
   */
  private async handleOpenUnmanagedSkillDetails(skill: MarketplaceInstalledSkill) {
    try {
      if (!skill?.localPath) {
        throw new Error('This skill does not have a local path.');
      }

      await SkillDetailUnManagedPanel.createOrShow(
        this.extensionUri,
        skill,
        this.currentToolName,
        this.currentToolDisplayName
      );

      this.postMessage({
        type: 'openUnmanagedSkillDetailsResult',
        success: true,
        error: null
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Unmanaged details error: ${errorMsg}`);
      this.postMessage({
        type: 'openUnmanagedSkillDetailsResult',
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

      const installResult = await toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);

      // Update storage
      const storage = getStorageService();
      await storage.addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installResult);
      await this.showInstallSuccess(skillName, installResult.installPath);

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: `Successfully installed ${skillName} to ${installResult.installPath}`,
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

  private async handleOpenInstalledFolder(skillId: string, localPath: string) {
    try {
      const storage = getStorageService();
      const installed = storage.getInstalledSkill(this.currentToolName, skillId);
      const folderPath = installed?.localPath || localPath;

      if (!folderPath) {
        throw new Error('Installed skill folder was not found.');
      }

      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
      this.postMessage({
        type: 'openFolderResult',
        skillId,
        success: true,
        error: null
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Open folder error: ${errorMsg}`);
      this.postMessage({
        type: 'openFolderResult',
        skillId,
        success: false,
        error: errorMsg
      });
    }
  }

  /**
   * Get installed skills across all tools
   */
  private async handleGetInstalledSkills() {
    try {
      const groups = this.collectInstalledGroups();

      this.postMessage({
        type: 'installedSkills',
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        groups,
        installed: [...groups.installedGlobal, ...groups.installedWorkspace]
      });

      logToOutput('[Webview] Retrieved installed skill groups');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Error getting installed skills: ${errorMsg}`);

      this.postMessage({
        type: 'installedSkills',
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        groups: {
          installedGlobal: [],
          installedWorkspace: []
        },
        installed: []
      });
    }
  }

  private collectInstalledGroups(): MarketplaceInstalledGroups {
    const storage = getStorageService();
    const installedByExtension = storage.getInstalledByTool(this.currentToolName);
    const workspaceRoots = this.getWorkspaceRoots();

    const groups: MarketplaceInstalledGroups = {
      installedGlobal: [],
      installedWorkspace: []
    };

    const managedPaths = new Set<string>();

    for (const installed of installedByExtension) {
      const scope = this.getScopeForPath(installed.localPath, workspaceRoots);
      const normalizedLocalPath = this.normalizePath(installed.localPath);
      managedPaths.add(normalizedLocalPath);

      const item: MarketplaceInstalledSkill = {
        skillId: installed.skillId,
        name: installed.name || installed.skillId,
        author: installed.author || 'Unknown',
        description: 'Managed skill',
        localPath: installed.localPath,
        scope,
        kind: 'managed',
        canOpenDetails: true,
        canUninstall: true
      };

      if (scope === 'workspace') {
        groups.installedWorkspace.push(item);
      } else {
        groups.installedGlobal.push(item);
      }
    }

    const globalOther = this.scanOtherSkills(this.getGlobalSkillRoots(), 'global', managedPaths);
    const workspaceOther = this.scanOtherSkills(this.getWorkspaceSkillRoots(), 'workspace', managedPaths);

    groups.installedGlobal.push(...globalOther);
    groups.installedWorkspace.push(...workspaceOther);

    return groups;
  }

  private scanOtherSkills(
    roots: string[],
    scope: SkillInstallScope,
    managedPaths: Set<string>
  ): MarketplaceInstalledSkill[] {
    const items: MarketplaceInstalledSkill[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        continue;
      }

      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillPath = path.join(root, entry.name);
        const normalizedPath = this.normalizePath(skillPath);

        if (managedPaths.has(normalizedPath) || seen.has(normalizedPath)) {
          continue;
        }

        const hasMetadata = fs.existsSync(path.join(skillPath, 'skill.json'));
        if (hasMetadata) {
          continue;
        }

        seen.add(normalizedPath);
        items.push({
          skillId: '',
          name: entry.name,
          author: 'Unknown',
          description: 'Unmanaged skill',
          localPath: skillPath,
          scope,
          kind: 'other',
          canOpenDetails: true,
          canUninstall: true
        });
      }
    }

    items.sort((left, right) => left.name.localeCompare(right.name));
    return items;
  }

  private getGlobalSkillRoots(): string[] {
    const toolConfig = toolInstallService.getTool(this.currentToolName);
    if (!toolConfig) {
      return [];
    }

    return [toolConfig.globalDir];
  }

  private getWorkspaceRoots(): string[] {
    return (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
  }

  private getWorkspaceSkillRoots(): string[] {
    const roots: string[] = [];
    const agentLocation = getSkillAgentLocation(this.currentToolName);
    // Always scan the canonical .agents/skills directory. For non-universal agents
    // also scan their agent-specific project directory.
    const candidates = new Set(['.agents/skills']);
    if (agentLocation && !agentLocation.isUniversal) {
      candidates.add(agentLocation.projectSkillDir);
    }

    for (const workspaceRoot of this.getWorkspaceRoots()) {
      for (const candidate of candidates) {
        roots.push(path.join(workspaceRoot, candidate));
      }
    }

    return roots;
  }

  private getScopeForPath(localPath: string, workspaceRoots: string[]): SkillInstallScope {
    const normalized = this.normalizePath(localPath);

    for (const workspaceRoot of workspaceRoots) {
      const normalizedRoot = this.normalizePath(workspaceRoot);
      if (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
        return 'workspace';
      }
    }

    return 'global';
  }

  private normalizePath(targetPath: string): string {
    try {
      return fs.realpathSync.native(targetPath);
    } catch {
      return path.resolve(targetPath);
    }
  }

  /**
   * Resolve the current host where extension is running.
   */
  private resolveCurrentTool(): { name: string; displayName: string } {
    const tool = toolInstallService.resolveCurrentTool(vscode.env.appName);
    return { name: tool.name, displayName: tool.displayName };
  }

  private async showInstallSuccess(skillName: string, installPath: string) {
    const openFolder = 'Open Folder';
    const selection = await vscode.window.showInformationMessage(
      `${skillName} is installed to ${installPath}`,
      openFolder
    );

    if (selection === openFolder) {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(installPath));
    }
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

        <vscode-collapsible id="installedGlobalCollapsible" heading="Global" class="collapsible">
          <vscode-badge id="installedGlobalCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedGlobalTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="installedWorkspaceCollapsible" heading="Workspace" class="collapsible">
          <vscode-badge id="installedWorkspaceCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedWorkspaceTable" class="section-table"></div>
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

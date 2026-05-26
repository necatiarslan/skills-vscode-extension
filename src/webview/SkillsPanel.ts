import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSkillAgentLocation, SKILL_LOCATION_CONFIG } from '../common/SkillLocationConfig';
import { logToOutput } from '../common/UI';
import { gitHubContentService, skillsApiService } from '../services';
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

  public async checkForUpdatesForManagedSkills(): Promise<void> {
    const storage = getStorageService();
    const groups = this.collectInstalledGroups();
    const managedSkills = [...groups.installedGlobal, ...groups.installedWorkspace]
      .filter((skill) => skill.kind === 'managed');

    if (managedSkills.length === 0) {
      await vscode.window.showInformationMessage('No managed skills found to check for updates.');
      return;
    }

    let checkedCount = 0;
    let outdatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const managedSkill of managedSkills) {
      const localPath = managedSkill.localPath;
      const source = this.resolveManagedSkillSource(managedSkill);

      if (!source?.githubUrl || !localPath) {
        skippedCount += 1;
        logToOutput(`[Webview] Skipping update check for ${managedSkill.name}: missing source metadata.`);
        continue;
      }

      try {
        const localSkillMarkdown = await this.readLocalSkillMarkdown(localPath);
        if (!localSkillMarkdown) {
          skippedCount += 1;
          logToOutput(`[Webview] Skipping update check for ${managedSkill.name}: local SKILL.md missing.`);
          continue;
        }

        const repoSkillMarkdown = await this.readRepositorySkillMarkdown(
          source.githubUrl,
          source.sourceBranch,
          source.sourcePath
        );

        if (!repoSkillMarkdown) {
          skippedCount += 1;
          logToOutput(`[Webview] Skipping update check for ${managedSkill.name}: repository SKILL.md missing.`);
          continue;
        }

        checkedCount += 1;

        const localNormalized = this.normalizeMarkdown(localSkillMarkdown);
        const remoteNormalized = this.normalizeMarkdown(repoSkillMarkdown);

        if (localNormalized === remoteNormalized) {
          await storage.clearOutdated(this.currentToolName, managedSkill.skillId);
          continue;
        }

        await storage.markOutdated(this.currentToolName, managedSkill.skillId);
        outdatedCount += 1;
      } catch (error) {
        failedCount += 1;
        const errorMsg = error instanceof Error ? error.message : String(error);
        logToOutput(`[ERROR] [Webview] Failed update check for ${managedSkill.name}: ${errorMsg}`);
      }
    }

    this.refreshInstalledSkills();

    if (outdatedCount > 0) {
      this.postMessage({
        type: 'applySearchQuery',
        query: 'outdated'
      });
    }

    const summary = `Checked ${checkedCount} managed skills. Outdated ${outdatedCount}.`
      + (skippedCount > 0 ? ` Skipped ${skippedCount}.` : '')
      + (failedCount > 0 ? ` Failed ${failedCount}.` : '');

    await vscode.window.showInformationMessage(summary);
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
      case 'update':
        await this.handleUpdate(message.skillId, message.skillName, message.githubUrl, message.localPath);
        break;
      case 'uninstall':
        await this.handleUninstall(message.skillId, message.localPath);
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

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: `Successfully installed ${skillName} to ${installResult.installPath}`,
        error: null
      });

      await this.handleGetInstalledSkills();
      this.showInstallSuccess(skillName, installResult.installPath).catch(() => undefined);

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

  private async handleUpdate(skillId: string, skillName: string, githubUrl: string, localPath?: string) {
    try {
      logToOutput(`[Webview] Updating ${skillName || skillId} on ${this.currentToolName}`);

      const workspaceRoots = this.getWorkspaceRoots();
      const resolvedLocalPath = localPath
        || getStorageService().getInstalledSkill(this.currentToolName, skillId)?.localPath;

      if (!resolvedLocalPath) {
        throw new Error('Skill local path not found.');
      }

      const managedSkill: MarketplaceInstalledSkill = {
        skillId,
        name: skillName || skillId,
        author: 'Unknown',
        description: 'Managed skill',
        localPath: resolvedLocalPath,
        scope: this.getScopeForPath(resolvedLocalPath, workspaceRoots),
        kind: 'managed',
        outdated: false,
        canOpenDetails: true,
        canUninstall: true
      };

      const source = this.resolveManagedSkillSource({
        ...managedSkill,
        name: skillName || managedSkill.name
      }) || {
        skillId,
        skillName: skillName || skillId,
        githubUrl,
        sourceBranch: undefined,
        sourcePath: undefined
      };

      if (!source.githubUrl) {
        throw new Error('GitHub source URL not found for this skill.');
      }

      await this.updateManagedSkill(managedSkill, source, workspaceRoots);
      await getStorageService().clearOutdated(this.currentToolName, managedSkill.skillId);

      this.postMessage({
        type: 'updateResult',
        skillId: managedSkill.skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: 'Successfully updated skill',
        error: null
      });

      await this.handleGetInstalledSkills();
      logToOutput(`[Webview] Update completed: ${managedSkill.skillId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[Webview] Update error: ${errorMsg}`);
      this.postMessage({
        type: 'updateResult',
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
  private async handleUninstall(skillId: string, localPath?: string) {
    try {
      const uninstallLabel = skillId || localPath || 'unknown';
      logToOutput(`[Webview] Uninstalling ${uninstallLabel} from ${this.currentToolName}`);

      const storage = getStorageService();
      const installed = skillId ? storage.getInstalledSkill(this.currentToolName, skillId) : null;
      const resolvedPath = installed?.localPath || localPath;
      const resolvedSkillId = skillId || path.basename(resolvedPath || '');

      if (!resolvedPath) {
        throw new Error('Skill not found in storage and no local path was provided.');
      }

      await toolInstallService.uninstallSkill(this.currentToolName, resolvedSkillId, resolvedPath);

      if (installed && skillId) {
        await storage.removeInstalled(this.currentToolName, skillId);
      }

      this.postMessage({
        type: 'uninstallResult',
        skillId: resolvedSkillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        message: 'Successfully uninstalled skill',
        error: null
      });

      await this.handleGetInstalledSkills();

      logToOutput(`[Webview] Uninstallation completed: ${resolvedSkillId}`);
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
      logToOutput(`[Webview] Opened installed folder for ${skillId || 'unknown'}: ${folderPath}`);
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
    const outdatedSkillIds = new Set(storage.getOutdatedSkillIdsByTool(this.currentToolName));
    const workspaceRoots = this.getWorkspaceRoots();

    const groups: MarketplaceInstalledGroups = {
      installedGlobal: [],
      installedWorkspace: []
    };

    const managedPaths = new Set<string>();

    for (const installed of installedByExtension) {
      const scope = this.getScopeForPath(installed.localPath, workspaceRoots);
      const normalizedLocalPath = this.normalizePath(installed.localPath);
      const normalizedLocalPathNoFollow = this.normalizePathNoFollow(installed.localPath);
      managedPaths.add(normalizedLocalPath);
      managedPaths.add(normalizedLocalPathNoFollow);

      const item: MarketplaceInstalledSkill = {
        skillId: installed.skillId,
        name: installed.name || installed.skillId,
        author: installed.author || 'Unknown',
        description: 'Managed skill',
        localPath: installed.localPath,
        scope,
        kind: 'managed',
        outdated: outdatedSkillIds.has(installed.skillId),
        canOpenDetails: true,
        canUninstall: true
      };

      if (scope === 'workspace') {
        groups.installedWorkspace.push(item);
      } else {
        groups.installedGlobal.push(item);
      }
    }

    const globalOther = this.scanOtherSkills(this.getGlobalSkillRoots(), 'global', managedPaths, outdatedSkillIds);
    const workspaceOther = this.scanOtherSkills(this.getWorkspaceSkillRoots(), 'workspace', managedPaths, outdatedSkillIds);

    groups.installedGlobal.push(...globalOther);
    groups.installedWorkspace.push(...workspaceOther);

    return groups;
  }

  private scanOtherSkills(
    roots: string[],
    scope: SkillInstallScope,
    managedPaths: Set<string>,
    outdatedSkillIds: Set<string>
  ): MarketplaceInstalledSkill[] {
    const items: MarketplaceInstalledSkill[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!root || !fs.existsSync(root)) {
        continue;
      }

      let rootStat: fs.Stats;
      try {
        rootStat = fs.statSync(root);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logToOutput(`[ERROR] [Webview] Failed reading skill root ${root}: ${errorMsg}`);
        continue;
      }

      if (!rootStat.isDirectory()) {
        continue;
      }

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logToOutput(`[ERROR] [Webview] Failed listing skill root ${root}: ${errorMsg}`);
        continue;
      }

      for (const entry of entries) {
        const skillPath = path.join(root, entry.name);
        let isSkillDirectory = entry.isDirectory();

        // Include symlinked folders (common for managed skill installs).
        if (!isSkillDirectory && entry.isSymbolicLink()) {
          try {
            isSkillDirectory = fs.statSync(skillPath).isDirectory();
          } catch {
            isSkillDirectory = false;
          }
        }

        if (!isSkillDirectory) {
          continue;
        }

        const normalizedPath = this.normalizePath(skillPath);
        const normalizedPathNoFollow = this.normalizePathNoFollow(skillPath);

        if (
          managedPaths.has(normalizedPath)
          || managedPaths.has(normalizedPathNoFollow)
          || seen.has(normalizedPath)
          || seen.has(normalizedPathNoFollow)
        ) {
          continue;
        }

        const hasMetadata = fs.existsSync(path.join(skillPath, 'skill.json'));
        let metadata: { id?: string; name?: string; author?: string } | null = null;
        if (hasMetadata) {
          try {
            const metadataRaw = fs.readFileSync(path.join(skillPath, 'skill.json'), 'utf8');
            const parsed = JSON.parse(metadataRaw) as { id?: string; name?: string; author?: string };
            metadata = parsed;
          } catch {
            metadata = null;
          }
        }

        const discoveredSkillId = (metadata?.id || entry.name || '').trim();
        const discoveredName = (metadata?.name || entry.name || discoveredSkillId).trim();
        const discoveredAuthor = (metadata?.author || 'Unknown').trim();
        const discoveredKind: 'managed' | 'other' = hasMetadata ? 'managed' : 'other';
        seen.add(normalizedPath);
        seen.add(normalizedPathNoFollow);
        items.push({
          skillId: discoveredSkillId,
          name: discoveredName,
          author: discoveredAuthor,
          description: hasMetadata ? 'Managed skill (untracked)' : 'Unmanaged skill',
          localPath: skillPath,
          scope,
          kind: discoveredKind,
          outdated: discoveredSkillId ? outdatedSkillIds.has(discoveredSkillId) : false,
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

    const roots = new Set<string>();

    if (toolConfig?.globalDir) {
      roots.add(toolConfig.globalDir);
    }

    roots.add(SKILL_LOCATION_CONFIG.canonicalSkillRoot);

    return Array.from(roots);
  }

  private resolveManagedSkillSource(skill: MarketplaceInstalledSkill): {
    skillId: string;
    skillName: string;
    githubUrl: string;
    sourceBranch?: string;
    sourcePath?: string;
  } | null {
    const storage = getStorageService();
    const installed = skill.skillId ? storage.getInstalledSkill(this.currentToolName, skill.skillId) : null;
    const metadata = this.readSkillMetadata(skill.localPath);

    const skillId = (installed?.skillId || metadata?.id || skill.skillId || path.basename(skill.localPath)).trim();
    const skillName = (installed?.name || metadata?.name || skill.name || skillId).trim();
    const githubUrl = (installed?.sourceUrl || metadata?.github_url || '').trim();
    const sourceBranch = (installed?.sourceBranch || metadata?.branch || '').trim() || undefined;
    const sourcePath = (installed?.sourcePath || metadata?.skill_path || '').trim() || undefined;

    if (!githubUrl) {
      return null;
    }

    return {
      skillId,
      skillName,
      githubUrl,
      sourceBranch,
      sourcePath
    };
  }

  private readSkillMetadata(localPath: string): {
    id?: string;
    name?: string;
    github_url?: string;
    branch?: string;
    skill_path?: string;
  } | null {
    const metadataPath = path.join(localPath, 'skill.json');
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(raw) as {
        id?: string;
        name?: string;
        github_url?: string;
        branch?: string;
        skill_path?: string;
      };
    } catch {
      return null;
    }
  }

  private async readLocalSkillMarkdown(rootPath: string): Promise<string | undefined> {
    const candidates = ['SKILL.md', 'skill.md'];
    for (const candidate of candidates) {
      const filePath = path.join(rootPath, candidate);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return fs.promises.readFile(filePath, 'utf8');
      }
    }

    return undefined;
  }

  private async readRepositorySkillMarkdown(
    githubUrl: string,
    sourceBranch?: string,
    sourcePath?: string
  ): Promise<string | undefined> {
    const repoContext = gitHubContentService.parseGitHubUrl(githubUrl);
    const repoMetadata = await gitHubContentService.getRepoMetadata(repoContext);
    const resolvedBranch = sourceBranch
      || (repoContext.branch === 'HEAD' ? repoMetadata.defaultBranch : repoContext.branch);
    const resolvedPath = sourcePath || repoContext.skillPath;

    const context = {
      ...repoContext,
      branch: resolvedBranch,
      skillPath: resolvedPath
    };

    const normalizedSkillPath = (resolvedPath || '').replace(/^\/+|\/+$/g, '');
    const candidates = normalizedSkillPath
      ? [`${normalizedSkillPath}/SKILL.md`, `${normalizedSkillPath}/skill.md`, normalizedSkillPath]
      : ['SKILL.md', 'skill.md'];

    for (const candidate of candidates) {
      try {
        const preview = await gitHubContentService.getFilePreview(context, candidate);
        if (preview?.content) {
          return preview.content;
        }
      } catch {
        // Continue with next candidate.
      }
    }

    return undefined;
  }

  private normalizeMarkdown(content: string): string {
    return content.replace(/\r\n/g, '\n').trim();
  }

  private async updateManagedSkill(
    skill: MarketplaceInstalledSkill,
    source: { skillId: string; skillName: string; githubUrl: string },
    workspaceRoots: string[]
  ): Promise<void> {
    const storage = getStorageService();
    const scope = this.getScopeForPath(skill.localPath, workspaceRoots);

    await toolInstallService.uninstallSkill(this.currentToolName, source.skillId, skill.localPath);

    const installed = storage.getInstalledSkill(this.currentToolName, source.skillId);
    if (installed?.skillId) {
      await storage.removeInstalled(this.currentToolName, installed.skillId);
    }

    const installResult = scope === 'workspace'
      ? await toolInstallService.installSkillToDirectory(
        this.currentToolName,
        source.skillId,
        source.skillName,
        source.githubUrl,
        path.dirname(skill.localPath)
      )
      : await toolInstallService.installSkill(
        this.currentToolName,
        source.skillId,
        source.skillName,
        source.githubUrl
      );

    await storage.addInstalled(this.currentToolName, source.skillId, source.skillName, 'unknown', '1.0.0', installResult);
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
    // Use lexical paths so workspace symlink installs remain classified as workspace.
    const normalized = this.normalizePathNoFollow(localPath);

    for (const workspaceRoot of workspaceRoots) {
      const normalizedRoot = this.normalizePathNoFollow(workspaceRoot);
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

  private normalizePathNoFollow(targetPath: string): string {
    return path.resolve(targetPath);
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
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillsPanel.css')
    );
    const skillspanelJs = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillsPanel.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Skills Marketplace</title>
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
        <vscode-textfield id="searchInput" class="search-input" placeholder="Search AI Agent Skills..." aria-label="Search AI Agent Skills" autocomplete="off">
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

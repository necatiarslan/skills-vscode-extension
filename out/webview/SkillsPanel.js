"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsPanel = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const SkillLocationConfig_1 = require("../common/SkillLocationConfig");
const UI_1 = require("../common/UI");
const services_1 = require("../services");
const SkillsStorageService_1 = require("../services/SkillsStorageService");
const services_2 = require("../services");
const SkillDetailPanel_1 = require("./SkillDetailPanel");
/**
 * SkillsPanel - WebviewViewProvider for rendering marketplace in sidebar
 */
class SkillsPanel {
    static viewType = 'SkillsView';
    static Current;
    view;
    extensionUri;
    currentToolName;
    currentToolDisplayName;
    disposables = [];
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        SkillsPanel.Current = this;
        const currentTool = this.resolveCurrentTool();
        this.currentToolName = currentTool.name;
        this.currentToolDisplayName = currentTool.displayName;
    }
    /**
     * Resolve the webview view
     */
    async resolveWebviewView(webviewView, _context, _token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            enableForms: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media', 'extension')]
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        (0, UI_1.logToOutput)('[SkillsPanel] Skills Marketplace view resolved');
    }
    refreshInstalledSkills() {
        if (!this.view) {
            return;
        }
        this.handleGetInstalledSkills();
    }
    /**
     * Handle messages from the webview
     */
    async handleWebviewMessage(message) {
        (0, UI_1.logToOutput)(`[Webview] Message received: ${message.type}`);
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
            case 'openInstalledFolder':
                await this.handleOpenInstalledFolder(message.skillId, message.localPath);
                break;
            case 'getInstalledSkills':
                await this.handleGetInstalledSkills();
                break;
            default:
                (0, UI_1.logToOutput)(`[Webview] Unknown message type: ${message.type}`);
        }
    }
    /**
     * Handle skill search
     */
    async handleSearch(query) {
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
            (0, UI_1.logToOutput)(`[Webview] Searching for: ${query}`);
            const skills = await services_1.skillsApiService.search(query);
            this.postMessage({
                type: 'searchResults',
                query,
                results: skills,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Search error: ${errorMsg}`);
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
    async handleOpenSkillDetailsById(skillId) {
        try {
            if (!skillId) {
                throw new Error('Skill id is required.');
            }
            const skill = await services_1.skillsApiService.fetchDetail(skillId);
            if (!skill) {
                throw new Error('Skill detail was not found.');
            }
            await this.handleOpenSkillDetails(skill);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Details-by-id error: ${errorMsg}`);
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
    async handleOpenSkillDetails(skill) {
        try {
            if (!skill?.githubUrl) {
                throw new Error('This skill does not expose a GitHub URL.');
            }
            await SkillDetailPanel_1.SkillDetailPanel.createOrShow(this.extensionUri, skill, this.currentToolName, this.currentToolDisplayName);
            this.postMessage({
                type: 'openSkillDetailsResult',
                success: true,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Details error: ${errorMsg}`);
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
    async handleInstall(skillId, skillName, githubUrl) {
        try {
            (0, UI_1.logToOutput)(`[Webview] Installing ${skillName} to ${this.currentToolName}`);
            const installResult = await services_2.toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
            // Update storage
            const storage = (0, SkillsStorageService_1.getStorageService)();
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
            (0, UI_1.logToOutput)(`[Webview] Installation completed: ${skillId}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Installation error: ${errorMsg}`);
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
    async handleUninstall(skillId) {
        try {
            (0, UI_1.logToOutput)(`[Webview] Uninstalling ${skillId} from ${this.currentToolName}`);
            const storage = (0, SkillsStorageService_1.getStorageService)();
            const installed = storage.getInstalledSkill(this.currentToolName, skillId);
            if (!installed) {
                throw new Error('Skill not found in storage');
            }
            await services_2.toolInstallService.uninstallSkill(this.currentToolName, skillId, installed.localPath);
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
            (0, UI_1.logToOutput)(`[Webview] Uninstallation completed: ${skillId}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Uninstallation error: ${errorMsg}`);
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
    async handleOpenInstalledFolder(skillId, localPath) {
        try {
            const storage = (0, SkillsStorageService_1.getStorageService)();
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
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Open folder error: ${errorMsg}`);
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
    async handleGetInstalledSkills() {
        try {
            const groups = this.collectInstalledGroups();
            this.postMessage({
                type: 'installedSkills',
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                groups,
                installed: [...groups.installedGlobal, ...groups.installedWorkspace]
            });
            (0, UI_1.logToOutput)('[Webview] Retrieved installed skill groups');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Error getting installed skills: ${errorMsg}`);
            this.postMessage({
                type: 'installedSkills',
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                groups: {
                    installedGlobal: [],
                    installedWorkspace: [],
                    installedOtherGlobal: [],
                    installedOtherWorkspace: []
                },
                installed: []
            });
        }
    }
    collectInstalledGroups() {
        const storage = (0, SkillsStorageService_1.getStorageService)();
        const installedByExtension = storage.getInstalledByTool(this.currentToolName);
        const workspaceRoots = this.getWorkspaceRoots();
        const groups = {
            installedGlobal: [],
            installedWorkspace: [],
            installedOtherGlobal: [],
            installedOtherWorkspace: []
        };
        const managedPaths = new Set();
        for (const installed of installedByExtension) {
            const scope = this.getScopeForPath(installed.localPath, workspaceRoots);
            const normalizedLocalPath = this.normalizePath(installed.localPath);
            managedPaths.add(normalizedLocalPath);
            const item = {
                skillId: installed.skillId,
                name: installed.name || installed.skillId,
                author: installed.author || 'Unknown',
                localPath: installed.localPath,
                scope,
                kind: 'managed',
                canOpenDetails: true,
                canUninstall: true
            };
            if (scope === 'workspace') {
                groups.installedWorkspace.push(item);
            }
            else {
                groups.installedGlobal.push(item);
            }
        }
        const globalOther = this.scanOtherSkills(this.getGlobalSkillRoots(), 'global', managedPaths);
        const workspaceOther = this.scanOtherSkills(this.getWorkspaceSkillRoots(), 'workspace', managedPaths);
        groups.installedOtherGlobal.push(...globalOther);
        groups.installedOtherWorkspace.push(...workspaceOther);
        return groups;
    }
    scanOtherSkills(roots, scope, managedPaths) {
        const items = [];
        const seen = new Set();
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
                    localPath: skillPath,
                    scope,
                    kind: 'other',
                    canOpenDetails: false,
                    canUninstall: false
                });
            }
        }
        items.sort((left, right) => left.name.localeCompare(right.name));
        return items;
    }
    getGlobalSkillRoots() {
        const toolConfig = services_2.toolInstallService.getTool(this.currentToolName);
        if (!toolConfig) {
            return [];
        }
        return [toolConfig.globalDir];
    }
    getWorkspaceRoots() {
        return (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
    }
    getWorkspaceSkillRoots() {
        const roots = [];
        const agentLocation = (0, SkillLocationConfig_1.getSkillAgentLocation)(this.currentToolName);
        const workspaceCandidates = agentLocation?.workspaceScanDirCandidates || [];
        for (const workspaceRoot of this.getWorkspaceRoots()) {
            for (const candidate of workspaceCandidates) {
                roots.push(path.join(workspaceRoot, candidate));
            }
        }
        return roots;
    }
    getScopeForPath(localPath, workspaceRoots) {
        const normalized = this.normalizePath(localPath);
        for (const workspaceRoot of workspaceRoots) {
            const normalizedRoot = this.normalizePath(workspaceRoot);
            if (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
                return 'workspace';
            }
        }
        return 'global';
    }
    normalizePath(targetPath) {
        try {
            return fs.realpathSync.native(targetPath);
        }
        catch {
            return path.resolve(targetPath);
        }
    }
    /**
     * Resolve the current host where extension is running.
     */
    resolveCurrentTool() {
        const tool = services_2.toolInstallService.resolveCurrentTool(vscode.env.appName);
        return { name: tool.name, displayName: tool.displayName };
    }
    async showInstallSuccess(skillName, installPath) {
        const openFolder = 'Open Folder';
        const selection = await vscode.window.showInformationMessage(`${skillName} is installed to ${installPath}`, openFolder);
        if (selection === openFolder) {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(installPath));
        }
    }
    /**
     * Post a message to the webview
     */
    postMessage(message) {
        if (this.view) {
            this.view.webview.postMessage(message);
        }
    }
    /**
     * Get the HTML content for the webview
     */
    getHtmlContent(webview) {
        const skillspanelCss = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillspanel.css'));
        const skillspanelJs = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillspanel.js'));
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

        <vscode-collapsible id="installedGlobalCollapsible" heading="Installed Global" class="collapsible">
          <vscode-badge id="installedGlobalCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedGlobalTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="installedWorkspaceCollapsible" heading="Installed Workspace" class="collapsible">
          <vscode-badge id="installedWorkspaceCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedWorkspaceTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="installedOtherGlobalCollapsible" heading="Installed Other Global" class="collapsible">
          <vscode-badge id="installedOtherGlobalCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedOtherGlobalTable" class="section-table"></div>
        </vscode-collapsible>

        <vscode-collapsible id="installedOtherWorkspaceCollapsible" heading="Installed Other Workspace" class="collapsible">
          <vscode-badge id="installedOtherWorkspaceCount" variant="counter" slot="decorations">0</vscode-badge>
          <div id="installedOtherWorkspaceTable" class="section-table"></div>
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
    dispose() {
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
exports.SkillsPanel = SkillsPanel;
//# sourceMappingURL=SkillsPanel.js.map
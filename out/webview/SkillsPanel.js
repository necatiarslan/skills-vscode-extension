"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsPanel = void 0;
const vscode = require("vscode");
const UI_1 = require("../common/UI");
const SkillsApiService_1 = require("../services/SkillsApiService");
const SkillsStorageService_1 = require("../services/SkillsStorageService");
const services_1 = require("../services");
/**
 * SkillsPanel - Manages the marketplace webview panel
 */
class SkillsPanel {
    static currentPanel;
    panel;
    extensionUri;
    currentToolName;
    currentToolDisplayName;
    disposables = [];
    constructor(panel, extensionUri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        const currentTool = this.resolveCurrentTool();
        this.currentToolName = currentTool.name;
        this.currentToolDisplayName = currentTool.displayName;
        // Set up event listeners
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        // Initial setup
        this.update();
    }
    /**
     * Create or show the Skills Marketplace panel
     */
    static async createOrShow(extensionUri) {
        const column = vscode.ViewColumn.One;
        // If we already have a panel, show it
        if (SkillsPanel.currentPanel) {
            SkillsPanel.currentPanel.panel.reveal(column);
            return;
        }
        // Create the panel
        const panel = vscode.window.createWebviewPanel('skillsMarketplace', 'Skills Marketplace', column, {
            enableScripts: true,
            enableForms: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'marketplace')]
        });
        SkillsPanel.currentPanel = new SkillsPanel(panel, extensionUri);
        (0, UI_1.logToOutput)('[Webview] Skills Marketplace opened');
    }
    /**
     * Dispose the panel
     */
    dispose() {
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
    update() {
        this.panel.webview.html = this.getHtmlContent();
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
            case 'install':
                await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
                break;
            case 'uninstall':
                await this.handleUninstall(message.skillId);
                break;
            case 'getHostInfo':
                await this.handleGetHostInfo();
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
                    results: [],
                    error: null
                });
                return;
            }
            (0, UI_1.logToOutput)(`[Webview] Searching for: ${query}`);
            const skills = await SkillsApiService_1.skillsApiService.search(query);
            this.postMessage({
                type: 'searchResults',
                results: skills,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Search error: ${errorMsg}`);
            this.postMessage({
                type: 'searchResults',
                results: [],
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
            const installPath = await services_1.toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
            // Update storage
            const storage = (0, SkillsStorageService_1.getStorageService)();
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
            await services_1.toolInstallService.uninstallSkill(this.currentToolName, skillId, installed.localPath);
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
    /**
     * Get current host info for this extension session
     */
    async handleGetHostInfo() {
        try {
            services_1.toolInstallService.detectTools();
            const tool = services_1.toolInstallService.getTool(this.currentToolName);
            const installed = !!tool?.installed;
            this.postMessage({
                type: 'hostInfo',
                host: {
                    name: this.currentToolName,
                    displayName: this.currentToolDisplayName,
                    installed
                }
            });
            (0, UI_1.logToOutput)(`[Webview] Host resolved: ${this.currentToolDisplayName} (${installed ? 'supported' : 'unsupported'})`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Error resolving host info: ${errorMsg}`);
            this.postMessage({
                type: 'hostInfo',
                host: {
                    name: this.currentToolName,
                    displayName: this.currentToolDisplayName,
                    installed: false
                }
            });
        }
    }
    /**
     * Get installed skills across all tools
     */
    async handleGetInstalledSkills() {
        try {
            const storage = (0, SkillsStorageService_1.getStorageService)();
            const installed = storage.getInstalledByTool(this.currentToolName);
            this.postMessage({
                type: 'installedSkills',
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                installed
            });
            (0, UI_1.logToOutput)(`[Webview] Retrieved installed skills`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Error getting installed skills: ${errorMsg}`);
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
    resolveCurrentTool() {
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
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    /**
     * Get the HTML content for the webview
     */
    getHtmlContent() {
        const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.css'));
        const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.js'));
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
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.SkillsPanel = SkillsPanel;
//# sourceMappingURL=SkillsPanel.js.map
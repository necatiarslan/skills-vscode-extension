"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsViewProvider = void 0;
const vscode = require("vscode");
const UI_1 = require("../common/UI");
const services_1 = require("../services");
const SkillsStorageService_1 = require("../services/SkillsStorageService");
const services_2 = require("../services");
const SkillDetailPanel_1 = require("./SkillDetailPanel");
/**
 * SkillsViewProvider - WebviewViewProvider for rendering marketplace in sidebar
 */
class SkillsViewProvider {
    static viewType = 'SkillsView';
    view;
    extensionUri;
    currentToolName;
    currentToolDisplayName;
    disposables = [];
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
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
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace')]
        };
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        (0, UI_1.logToOutput)('[WebviewViewProvider] Skills Marketplace view resolved');
    }
    /**
     * Handle messages from the webview
     */
    async handleWebviewMessage(message) {
        (0, UI_1.logToOutput)(`[SkillsView] Message received: ${message.type}`);
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
                (0, UI_1.logToOutput)(`[SkillsView] Unknown message type: ${message.type}`);
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
            (0, UI_1.logToOutput)(`[SkillsView] Searching for: ${query}`);
            const skills = await services_1.skillsApiService.search(query);
            this.postMessage({
                type: 'searchResults',
                results: skills,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[SkillsView] Search error: ${errorMsg}`);
            this.postMessage({
                type: 'searchResults',
                results: [],
                error: errorMsg
            });
        }
    }
    /**
     * Handle opening skill details
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
            (0, UI_1.logToOutput)(`[SkillsView] Details error: ${errorMsg}`);
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
            (0, UI_1.logToOutput)(`[SkillsView] Installing ${skillName} to ${this.currentToolName}`);
            const installPath = await services_2.toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
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
            (0, UI_1.logToOutput)(`[SkillsView] Installation completed: ${skillId}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[SkillsView] Installation error: ${errorMsg}`);
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
            (0, UI_1.logToOutput)(`[SkillsView] Uninstalling ${skillId} from ${this.currentToolName}`);
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
            (0, UI_1.logToOutput)(`[SkillsView] Uninstallation completed: ${skillId}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[SkillsView] Uninstallation error: ${errorMsg}`);
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
     * Handle getting installed skills
     */
    async handleGetInstalledSkills() {
        try {
            const storage = (0, SkillsStorageService_1.getStorageService)();
            const installed = storage.getInstalledByTool(this.currentToolName) || [];
            this.postMessage({
                type: 'installedSkills',
                skills: installed,
                toolName: this.currentToolName
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[SkillsView] Get installed skills error: ${errorMsg}`);
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
     * Get HTML content for the webview
     */
    getHtmlContent(webview) {
        const marketplaceCss = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.css'));
        const marketplaceJs = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'marketplace', 'marketplace.js'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skills Marketplace</title>
    <link rel="stylesheet" href="${marketplaceCss}">
</head>
<body>
    <div class="marketplace-container">
        <div class="search-container">
            <input 
                type="text" 
                id="searchInput" 
                placeholder="Search skills (e.g., ESLint, Prettier, Tailwind...)" 
                class="search-input"
                autocomplete="off"
            />
        </div>
        <div id="results" class="results-container"></div>
    </div>
    <script src="${marketplaceJs}"></script>
</body>
</html>`;
    }
    /**
     * Resolve the current tool
     */
    resolveCurrentTool() {
        const appName = vscode.env.appName;
        if (appName.includes('Cursor')) {
            return { name: 'cursor', displayName: 'Cursor' };
        }
        if (appName.includes('Windsurf')) {
            return { name: 'windsurf', displayName: 'Windsurf' };
        }
        if (appName.includes('Antigravity')) {
            return { name: 'antigravity', displayName: 'Antigravity' };
        }
        return { name: 'vscode', displayName: 'VS Code' };
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
exports.SkillsViewProvider = SkillsViewProvider;
//# sourceMappingURL=SkillsViewProvider.js.map
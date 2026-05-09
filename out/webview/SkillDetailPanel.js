"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillDetailPanel = void 0;
const vscode = require("vscode");
const UI_1 = require("../common/UI");
const services_1 = require("../services");
const SkillsStorageService_1 = require("../services/SkillsStorageService");
class SkillDetailPanel {
    static currentPanel;
    panel;
    extensionUri;
    currentToolName;
    currentToolDisplayName;
    disposables = [];
    skill;
    constructor(panel, extensionUri, skill, currentToolName, currentToolDisplayName) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.skill = skill;
        this.currentToolName = currentToolName;
        this.currentToolDisplayName = currentToolDisplayName;
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
    }
    static async createOrShow(extensionUri, skill, currentToolName, currentToolDisplayName) {
        const column = vscode.ViewColumn.Active;
        if (SkillDetailPanel.currentPanel) {
            SkillDetailPanel.currentPanel.skill = skill;
            SkillDetailPanel.currentPanel.panel.title = `Skill: ${skill.name}`;
            SkillDetailPanel.currentPanel.panel.reveal(column);
            await SkillDetailPanel.currentPanel.render();
            return;
        }
        const panel = vscode.window.createWebviewPanel('skillDetail', `Skill: ${skill.name}`, column, {
            enableScripts: true,
            enableForms: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'skill-detail')]
        });
        SkillDetailPanel.currentPanel = new SkillDetailPanel(panel, extensionUri, skill, currentToolName, currentToolDisplayName);
        await SkillDetailPanel.currentPanel.render();
        (0, UI_1.logToOutput)(`[Webview] Skill detail opened: ${skill.name}`);
    }
    dispose() {
        SkillDetailPanel.currentPanel = undefined;
        while (this.disposables.length > 0) {
            const disposable = this.disposables.pop();
            disposable?.dispose();
        }
    }
    async render() {
        const detailPayload = await this.createSkillDetailPayload(this.skill);
        const installedSkill = (0, SkillsStorageService_1.getStorageService)().getInstalledSkill(this.currentToolName, this.skill.id);
        this.panel.webview.html = this.getHtmlContent(detailPayload, !!installedSkill);
    }
    async handleWebviewMessage(message) {
        (0, UI_1.logToOutput)(`[SkillDetail] Message received: ${message.type}`);
        switch (message.type) {
            case 'loadRepoPath':
                await this.handleLoadRepoPath(message.context, message.path);
                break;
            case 'openRepoFile':
                await this.handleOpenRepoFile(message.context, message.path);
                break;
            case 'install':
                await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
                break;
            case 'uninstall':
                await this.handleUninstall(message.skillId);
                break;
            default:
                (0, UI_1.logToOutput)(`[SkillDetail] Unknown message type: ${message.type}`);
        }
    }
    async handleLoadRepoPath(context, path) {
        try {
            const directory = await services_1.gitHubContentService.listDirectory(context, path);
            this.postMessage({ type: 'repoDirectory', directory, error: null });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({ type: 'repoDirectory', directory: null, error: errorMsg });
        }
    }
    async handleOpenRepoFile(context, path) {
        try {
            const preview = await services_1.gitHubContentService.getFilePreview(context, path);
            this.postMessage({ type: 'filePreview', preview, error: null });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({ type: 'filePreview', preview: null, error: errorMsg });
        }
    }
    async handleInstall(skillId, skillName, githubUrl) {
        try {
            const installPath = await services_1.toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
            await (0, SkillsStorageService_1.getStorageService)().addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installPath);
            this.postMessage({
                type: 'installResult',
                skillId,
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                success: true,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({
                type: 'installResult',
                skillId,
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                success: false,
                error: errorMsg
            });
        }
    }
    async handleUninstall(skillId) {
        try {
            const installed = (0, SkillsStorageService_1.getStorageService)().getInstalledSkill(this.currentToolName, skillId);
            if (!installed) {
                throw new Error('Skill not found in storage');
            }
            await services_1.toolInstallService.uninstallSkill(this.currentToolName, skillId, installed.localPath);
            await (0, SkillsStorageService_1.getStorageService)().removeInstalled(this.currentToolName, skillId);
            this.postMessage({
                type: 'uninstallResult',
                skillId,
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                success: true,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({
                type: 'uninstallResult',
                skillId,
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                success: false,
                error: errorMsg
            });
        }
    }
    async createSkillDetailPayload(skill) {
        const detailSkill = await services_1.skillsApiService.fetchDetail(skill.id) ?? skill;
        const repoContext = services_1.gitHubContentService.parseGitHubUrl(detailSkill.githubUrl);
        const repoMetadata = await services_1.gitHubContentService.getRepoMetadata(repoContext);
        const resolvedContext = {
            ...repoContext,
            branch: repoContext.branch === 'HEAD' ? repoMetadata.defaultBranch : repoContext.branch
        };
        const rootDirectory = await services_1.gitHubContentService.listDirectory(resolvedContext, '');
        return {
            skill: detailSkill,
            repoContext: resolvedContext,
            repoMetadata,
            rootDirectory
        };
    }
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    getHtmlContent(detailPayload, isInstalled) {
        const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'skill-detail', 'skill-detail.css'));
        const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'skill-detail', 'skill-detail.js'));
        const nonce = this.getNonce();
        const initialState = JSON.stringify({
            detail: detailPayload,
            isInstalled
        }).replace(/</g, '\\u003c');
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill: ${this.escapeHtml(detailPayload.skill.name)}</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app" class="detail-root">
    <div id="loadingIndicator" class="loading hidden"><span class="spinner"></span> Loading...</div>
    <div id="errorMessage" class="error-message hidden"></div>
    <div id="detailContainer"></div>
  </div>
  <script nonce="${nonce}">window.__SKILL_DETAIL_INITIAL_STATE__ = ${initialState};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let index = 0; index < 32; index += 1) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
exports.SkillDetailPanel = SkillDetailPanel;
//# sourceMappingURL=SkillDetailPanel.js.map
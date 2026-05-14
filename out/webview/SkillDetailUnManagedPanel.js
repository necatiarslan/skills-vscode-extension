"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillDetailUnManagedPanel = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const UI_1 = require("../common/UI");
const SkillEmoji_1 = require("../common/SkillEmoji");
const services_1 = require("../services");
const SkillsPanel_1 = require("./SkillsPanel");
class SkillDetailUnManagedPanel {
    static currentPanel;
    panel;
    extensionUri;
    currentToolName;
    currentToolDisplayName;
    disposables = [];
    skill;
    static MAX_LOCAL_PREVIEW_BYTES = 100_000;
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
        if (SkillDetailUnManagedPanel.currentPanel) {
            SkillDetailUnManagedPanel.currentPanel.skill = skill;
            SkillDetailUnManagedPanel.currentPanel.panel.title = `Unmanaged Skill: ${skill.name}`;
            SkillDetailUnManagedPanel.currentPanel.panel.reveal(column);
            await SkillDetailUnManagedPanel.currentPanel.render();
            return;
        }
        const panel = vscode.window.createWebviewPanel('skillDetailUnManaged', `Unmanaged Skill: ${skill.name}`, column, {
            enableScripts: true,
            enableForms: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'extension')]
        });
        SkillDetailUnManagedPanel.currentPanel = new SkillDetailUnManagedPanel(panel, extensionUri, skill, currentToolName, currentToolDisplayName);
        await SkillDetailUnManagedPanel.currentPanel.render();
        (0, UI_1.logToOutput)(`[Webview] Unmanaged skill detail opened: ${skill.name}`);
    }
    dispose() {
        SkillDetailUnManagedPanel.currentPanel = undefined;
        while (this.disposables.length > 0) {
            const disposable = this.disposables.pop();
            disposable?.dispose();
        }
    }
    async render() {
        const detailPayload = await this.createSkillDetailPayload(this.skill);
        this.panel.webview.html = this.getHtmlContent(detailPayload);
    }
    async handleWebviewMessage(message) {
        (0, UI_1.logToOutput)(`[UnmanagedSkillDetail] Message received: ${message.type}`);
        switch (message.type) {
            case 'loadLocalPath':
                await this.handleLoadLocalPath(message.path);
                break;
            case 'openLocalFile':
                await this.handleOpenLocalFile(message.path);
                break;
            case 'openInstalledFolder':
                await this.handleOpenInstalledFolder();
                break;
            case 'uninstall':
                await this.handleUninstall();
                break;
            default:
                (0, UI_1.logToOutput)(`[UnmanagedSkillDetail] Unknown message type: ${message.type}`);
        }
    }
    async handleLoadLocalPath(localPath) {
        try {
            const rootPath = this.getLocalRootPath();
            const directory = await this.listLocalDirectory(rootPath, localPath || '');
            this.postMessage({ type: 'localDirectory', directory, error: null });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({ type: 'localDirectory', directory: null, error: errorMsg });
        }
    }
    async handleOpenLocalFile(localPath) {
        try {
            const rootPath = this.getLocalRootPath();
            const preview = await this.getLocalFilePreview(rootPath, localPath || '');
            this.postMessage({ type: 'localFilePreview', preview, error: null });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({ type: 'localFilePreview', preview: null, error: errorMsg });
        }
    }
    async handleOpenInstalledFolder() {
        try {
            const folderPath = this.getLocalRootPath();
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
            this.postMessage({ type: 'openFolderResult', success: true, error: null });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.postMessage({ type: 'openFolderResult', success: false, error: errorMsg });
        }
    }
    async handleUninstall() {
        try {
            const rootPath = this.getLocalRootPath();
            await services_1.toolInstallService.uninstallSkill(this.currentToolName, this.skill.skillId || this.skill.name, rootPath);
            SkillsPanel_1.SkillsPanel.Current?.refreshInstalledSkills();
            this.postMessage({
                type: 'uninstallResult',
                skillId: this.skill.skillId || this.skill.name,
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
                skillId: this.skill.skillId || this.skill.name,
                toolName: this.currentToolName,
                toolDisplayName: this.currentToolDisplayName,
                success: false,
                error: errorMsg
            });
        }
    }
    async createSkillDetailPayload(skill) {
        const rootPath = this.getLocalRootPath();
        const localRootDirectory = await this.listLocalDirectory(rootPath, '');
        const skillMarkdown = await this.readLocalSkillMarkdown(rootPath);
        // Find install date from SKILL.md or skill.md
        let installDate;
        const candidates = ['SKILL.md', 'skill.md'];
        for (const candidate of candidates) {
            const filePath = path.join(rootPath, candidate);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                try {
                    const stat = await fs.promises.stat(filePath);
                    installDate = (0, UI_1.formatDateTime)(stat.mtime);
                    break;
                }
                catch { }
            }
        }
        return {
            skill,
            localRootDirectory,
            localInitialDirectory: localRootDirectory,
            skillEmoji: (0, SkillEmoji_1.getSkillEmoji)(skill.skillId || skill.name),
            skillMarkdown,
            folderExists: true,
            installDate
        };
    }
    getLocalRootPath() {
        if (!this.skill?.localPath) {
            throw new Error('This skill does not have a local folder.');
        }
        if (!fs.existsSync(this.skill.localPath)) {
            throw new Error('Local skill folder does not exist.');
        }
        const stat = fs.statSync(this.skill.localPath);
        if (!stat.isDirectory()) {
            throw new Error('Local skill path is not a directory.');
        }
        return this.skill.localPath;
    }
    async readLocalSkillMarkdown(rootPath) {
        const candidates = ['SKILL.md', 'skill.md'];
        for (const candidate of candidates) {
            const filePath = path.join(rootPath, candidate);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                return fs.promises.readFile(filePath, 'utf8');
            }
        }
        return undefined;
    }
    async listLocalDirectory(rootPath, relativePath) {
        const safeRelativePath = this.normalizeRelativePath(relativePath);
        const absolutePath = this.resolveLocalPath(rootPath, safeRelativePath);
        const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
        const mappedEntries = await Promise.all(entries.map(async (entry) => {
            const entryRelativePath = safeRelativePath
                ? `${safeRelativePath}/${entry.name}`
                : entry.name;
            if (entry.isDirectory()) {
                return {
                    name: entry.name,
                    path: entryRelativePath,
                    type: 'dir'
                };
            }
            let size;
            if (entry.isFile()) {
                const stat = await fs.promises.stat(path.join(absolutePath, entry.name));
                size = stat.size;
            }
            return {
                name: entry.name,
                path: entryRelativePath,
                type: 'file',
                size
            };
        }));
        mappedEntries.sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === 'dir' ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
        });
        return {
            currentPath: safeRelativePath,
            entries: mappedEntries
        };
    }
    async getLocalFilePreview(rootPath, relativePath) {
        const safeRelativePath = this.normalizeRelativePath(relativePath);
        const absolutePath = this.resolveLocalPath(rootPath, safeRelativePath);
        const fileStat = await fs.promises.stat(absolutePath);
        if (!fileStat.isFile()) {
            throw new Error('Selected path is not a file.');
        }
        if (fileStat.size > SkillDetailUnManagedPanel.MAX_LOCAL_PREVIEW_BYTES) {
            return {
                path: safeRelativePath,
                name: path.basename(safeRelativePath),
                languageHint: this.getLanguageHint(safeRelativePath),
                content: '',
                truncated: true,
                tooLarge: true,
                isBinary: false
            };
        }
        const buffer = await fs.promises.readFile(absolutePath);
        const isBinary = this.looksBinary(buffer);
        return {
            path: safeRelativePath,
            name: path.basename(safeRelativePath),
            languageHint: this.getLanguageHint(safeRelativePath),
            content: isBinary ? '' : buffer.toString('utf8'),
            truncated: false,
            tooLarge: false,
            isBinary
        };
    }
    normalizeRelativePath(value) {
        return value
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+/g, '/');
    }
    resolveLocalPath(rootPath, relativePath) {
        const normalizedRoot = path.resolve(rootPath);
        const resolvedPath = path.resolve(normalizedRoot, relativePath || '.');
        const rootPrefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
        if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(rootPrefix)) {
            throw new Error('Path is outside of the unmanaged skill folder.');
        }
        return resolvedPath;
    }
    looksBinary(buffer) {
        const sample = buffer.subarray(0, 512);
        for (const byte of sample) {
            if (byte === 0) {
                return true;
            }
        }
        return false;
    }
    getLanguageHint(filePath) {
        const extension = filePath.includes('.') ? filePath.split('.').pop()?.toLowerCase() ?? '' : '';
        switch (extension) {
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'js':
            case 'jsx':
            case 'mjs':
            case 'cjs':
                return 'javascript';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'yml':
            case 'yaml':
                return 'yaml';
            case 'py':
                return 'python';
            case 'sh':
                return 'shell';
            default:
                return 'text';
        }
    }
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    getHtmlContent(detailPayload) {
        const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillDetailPanel.css'));
        const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillDetailUnManagedPanel.js'));
        const nonce = this.getNonce();
        const initialState = JSON.stringify({
            detail: detailPayload,
            installedLocalPath: detailPayload.skill.localPath,
            folderExists: detailPayload.folderExists,
            currentToolDisplayName: this.currentToolDisplayName,
            installDate: detailPayload.installDate || null
        }).replace(/</g, '\u003c');
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unmanaged Skill: ${this.escapeHtml(detailPayload.skill.name)}</title>
  <link rel="stylesheet" href="${styleUri}">
  <script type="module">
    import 'https://esm.sh/@vscode-elements/elements';
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.50.0/min/vs/loader.min.js"></script>
</head>
<body>
  <div id="app" class="detail-root">
    <div id="loadingIndicator" class="loading hidden"><span class="spinner"></span> Loading...</div>
    <div id="errorMessage" class="error-message hidden"></div>
    <div id="detailContainer"></div>
  </div>
  <script nonce="${nonce}">window.__SKILL_DETAIL_UNMANAGED_INITIAL_STATE__ = ${initialState};</script>
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
exports.SkillDetailUnManagedPanel = SkillDetailUnManagedPanel;
//# sourceMappingURL=SkillDetailUnManagedPanel.js.map
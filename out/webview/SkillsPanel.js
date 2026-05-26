"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsPanel = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SkillLocationConfig_1 = require("../common/SkillLocationConfig");
const UI_1 = require("../common/UI");
const services_1 = require("../services");
const SkillsStorageService_1 = require("../services/SkillsStorageService");
const services_2 = require("../services");
const SkillDetailUnManagedPanel_1 = require("./SkillDetailUnManagedPanel");
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
    async checkForUpdatesForManagedSkills() {
        const storage = (0, SkillsStorageService_1.getStorageService)();
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
                (0, UI_1.logToOutput)(`[Webview] Skipping update check for ${managedSkill.name}: missing source metadata.`);
                continue;
            }
            try {
                const localSkillMarkdown = await this.readLocalSkillMarkdown(localPath);
                if (!localSkillMarkdown) {
                    skippedCount += 1;
                    (0, UI_1.logToOutput)(`[Webview] Skipping update check for ${managedSkill.name}: local SKILL.md missing.`);
                    continue;
                }
                const repoSkillMarkdown = await this.readRepositorySkillMarkdown(source.githubUrl, source.sourceBranch, source.sourcePath);
                if (!repoSkillMarkdown) {
                    skippedCount += 1;
                    (0, UI_1.logToOutput)(`[Webview] Skipping update check for ${managedSkill.name}: repository SKILL.md missing.`);
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
            }
            catch (error) {
                failedCount += 1;
                const errorMsg = error instanceof Error ? error.message : String(error);
                (0, UI_1.logToOutput)(`[ERROR] [Webview] Failed update check for ${managedSkill.name}: ${errorMsg}`);
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
     * Load detail data for an unmanaged skill.
     */
    async handleOpenUnmanagedSkillDetails(skill) {
        try {
            if (!skill?.localPath) {
                throw new Error('This skill does not have a local path.');
            }
            await SkillDetailUnManagedPanel_1.SkillDetailUnManagedPanel.createOrShow(this.extensionUri, skill, this.currentToolName, this.currentToolDisplayName);
            this.postMessage({
                type: 'openUnmanagedSkillDetailsResult',
                success: true,
                error: null
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Unmanaged details error: ${errorMsg}`);
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
    async handleInstall(skillId, skillName, githubUrl) {
        try {
            (0, UI_1.logToOutput)(`[Webview] Installing ${skillName} to ${this.currentToolName}`);
            const installResult = await services_2.toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
            // Update storage
            const storage = (0, SkillsStorageService_1.getStorageService)();
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
    async handleUpdate(skillId, skillName, githubUrl, localPath) {
        try {
            (0, UI_1.logToOutput)(`[Webview] Updating ${skillName || skillId} on ${this.currentToolName}`);
            const workspaceRoots = this.getWorkspaceRoots();
            const resolvedLocalPath = localPath
                || (0, SkillsStorageService_1.getStorageService)().getInstalledSkill(this.currentToolName, skillId)?.localPath;
            if (!resolvedLocalPath) {
                throw new Error('Skill local path not found.');
            }
            const managedSkill = {
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
            await (0, SkillsStorageService_1.getStorageService)().clearOutdated(this.currentToolName, managedSkill.skillId);
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
            (0, UI_1.logToOutput)(`[Webview] Update completed: ${managedSkill.skillId}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[Webview] Update error: ${errorMsg}`);
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
    async handleUninstall(skillId, localPath) {
        try {
            const uninstallLabel = skillId || localPath || 'unknown';
            (0, UI_1.logToOutput)(`[Webview] Uninstalling ${uninstallLabel} from ${this.currentToolName}`);
            const storage = (0, SkillsStorageService_1.getStorageService)();
            const installed = skillId ? storage.getInstalledSkill(this.currentToolName, skillId) : null;
            const resolvedPath = installed?.localPath || localPath;
            const resolvedSkillId = skillId || path.basename(resolvedPath || '');
            if (!resolvedPath) {
                throw new Error('Skill not found in storage and no local path was provided.');
            }
            await services_2.toolInstallService.uninstallSkill(this.currentToolName, resolvedSkillId, resolvedPath);
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
            (0, UI_1.logToOutput)(`[Webview] Uninstallation completed: ${resolvedSkillId}`);
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
            (0, UI_1.logToOutput)(`[Webview] Opened installed folder for ${skillId || 'unknown'}: ${folderPath}`);
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
                    installedWorkspace: []
                },
                installed: []
            });
        }
    }
    collectInstalledGroups() {
        const storage = (0, SkillsStorageService_1.getStorageService)();
        const installedByExtension = storage.getInstalledByTool(this.currentToolName);
        const outdatedSkillIds = new Set(storage.getOutdatedSkillIdsByTool(this.currentToolName));
        const workspaceRoots = this.getWorkspaceRoots();
        const groups = {
            installedGlobal: [],
            installedWorkspace: []
        };
        const managedPaths = new Set();
        for (const installed of installedByExtension) {
            const scope = this.getScopeForPath(installed.localPath, workspaceRoots);
            const normalizedLocalPath = this.normalizePath(installed.localPath);
            const normalizedLocalPathNoFollow = this.normalizePathNoFollow(installed.localPath);
            managedPaths.add(normalizedLocalPath);
            managedPaths.add(normalizedLocalPathNoFollow);
            const item = {
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
            }
            else {
                groups.installedGlobal.push(item);
            }
        }
        const globalOther = this.scanOtherSkills(this.getGlobalSkillRoots(), 'global', managedPaths, outdatedSkillIds);
        const workspaceOther = this.scanOtherSkills(this.getWorkspaceSkillRoots(), 'workspace', managedPaths, outdatedSkillIds);
        groups.installedGlobal.push(...globalOther);
        groups.installedWorkspace.push(...workspaceOther);
        return groups;
    }
    scanOtherSkills(roots, scope, managedPaths, outdatedSkillIds) {
        const items = [];
        const seen = new Set();
        for (const root of roots) {
            if (!root || !fs.existsSync(root)) {
                continue;
            }
            let rootStat;
            try {
                rootStat = fs.statSync(root);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                (0, UI_1.logToOutput)(`[ERROR] [Webview] Failed reading skill root ${root}: ${errorMsg}`);
                continue;
            }
            if (!rootStat.isDirectory()) {
                continue;
            }
            let entries;
            try {
                entries = fs.readdirSync(root, { withFileTypes: true });
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                (0, UI_1.logToOutput)(`[ERROR] [Webview] Failed listing skill root ${root}: ${errorMsg}`);
                continue;
            }
            for (const entry of entries) {
                const skillPath = path.join(root, entry.name);
                let isSkillDirectory = entry.isDirectory();
                // Include symlinked folders (common for managed skill installs).
                if (!isSkillDirectory && entry.isSymbolicLink()) {
                    try {
                        isSkillDirectory = fs.statSync(skillPath).isDirectory();
                    }
                    catch {
                        isSkillDirectory = false;
                    }
                }
                if (!isSkillDirectory) {
                    continue;
                }
                const normalizedPath = this.normalizePath(skillPath);
                const normalizedPathNoFollow = this.normalizePathNoFollow(skillPath);
                if (managedPaths.has(normalizedPath)
                    || managedPaths.has(normalizedPathNoFollow)
                    || seen.has(normalizedPath)
                    || seen.has(normalizedPathNoFollow)) {
                    continue;
                }
                const hasMetadata = fs.existsSync(path.join(skillPath, 'skill.json'));
                let metadata = null;
                if (hasMetadata) {
                    try {
                        const metadataRaw = fs.readFileSync(path.join(skillPath, 'skill.json'), 'utf8');
                        const parsed = JSON.parse(metadataRaw);
                        metadata = parsed;
                    }
                    catch {
                        metadata = null;
                    }
                }
                const discoveredSkillId = (metadata?.id || entry.name || '').trim();
                const discoveredName = (metadata?.name || entry.name || discoveredSkillId).trim();
                const discoveredAuthor = (metadata?.author || 'Unknown').trim();
                const discoveredKind = hasMetadata ? 'managed' : 'other';
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
    getGlobalSkillRoots() {
        const toolConfig = services_2.toolInstallService.getTool(this.currentToolName);
        const roots = new Set();
        if (toolConfig?.globalDir) {
            roots.add(toolConfig.globalDir);
        }
        roots.add(SkillLocationConfig_1.SKILL_LOCATION_CONFIG.canonicalSkillRoot);
        return Array.from(roots);
    }
    resolveManagedSkillSource(skill) {
        const storage = (0, SkillsStorageService_1.getStorageService)();
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
    readSkillMetadata(localPath) {
        const metadataPath = path.join(localPath, 'skill.json');
        if (!fs.existsSync(metadataPath)) {
            return null;
        }
        try {
            const raw = fs.readFileSync(metadataPath, 'utf8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
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
    async readRepositorySkillMarkdown(githubUrl, sourceBranch, sourcePath) {
        const repoContext = services_1.gitHubContentService.parseGitHubUrl(githubUrl);
        const repoMetadata = await services_1.gitHubContentService.getRepoMetadata(repoContext);
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
                const preview = await services_1.gitHubContentService.getFilePreview(context, candidate);
                if (preview?.content) {
                    return preview.content;
                }
            }
            catch {
                // Continue with next candidate.
            }
        }
        return undefined;
    }
    normalizeMarkdown(content) {
        return content.replace(/\r\n/g, '\n').trim();
    }
    async updateManagedSkill(skill, source, workspaceRoots) {
        const storage = (0, SkillsStorageService_1.getStorageService)();
        const scope = this.getScopeForPath(skill.localPath, workspaceRoots);
        await services_2.toolInstallService.uninstallSkill(this.currentToolName, source.skillId, skill.localPath);
        const installed = storage.getInstalledSkill(this.currentToolName, source.skillId);
        if (installed?.skillId) {
            await storage.removeInstalled(this.currentToolName, installed.skillId);
        }
        const installResult = scope === 'workspace'
            ? await services_2.toolInstallService.installSkillToDirectory(this.currentToolName, source.skillId, source.skillName, source.githubUrl, path.dirname(skill.localPath))
            : await services_2.toolInstallService.installSkill(this.currentToolName, source.skillId, source.skillName, source.githubUrl);
        await storage.addInstalled(this.currentToolName, source.skillId, source.skillName, 'unknown', '1.0.0', installResult);
    }
    getWorkspaceRoots() {
        return (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
    }
    getWorkspaceSkillRoots() {
        const roots = [];
        const agentLocation = (0, SkillLocationConfig_1.getSkillAgentLocation)(this.currentToolName);
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
    getScopeForPath(localPath, workspaceRoots) {
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
    normalizePath(targetPath) {
        try {
            return fs.realpathSync.native(targetPath);
        }
        catch {
            return path.resolve(targetPath);
        }
    }
    normalizePathNoFollow(targetPath) {
        return path.resolve(targetPath);
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
        const skillspanelCss = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillsPanel.css'));
        const skillspanelJs = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skillsPanel.js'));
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
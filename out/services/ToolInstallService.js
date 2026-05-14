"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolInstallService = exports.ToolInstallService = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const UI_1 = require("../common/UI");
const GitHubContentService_1 = require("./GitHubContentService");
/**
 * ToolInstallService - Handles tool detection and skill installation/uninstallation
 */
class ToolInstallService {
    static CANONICAL_ROOT = path.join(os.homedir(), '.skills', 'skills');
    tools = new Map();
    constructor() {
        this.initializeTools();
        this.detectTools();
    }
    /**
     * Initialize tool directory mappings
     */
    initializeTools() {
        const homeDir = os.homedir();
        const toolConfigs = [
            {
                name: 'vscode',
                displayName: 'Visual Studio Code',
                globalDir: path.join(homeDir, '.copilot', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.vscode')],
                hostNames: ['visual studio code', 'vscode', 'github copilot', 'copilot'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'cursor',
                displayName: 'Cursor',
                globalDir: path.join(homeDir, '.cursor', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.cursor')],
                hostNames: ['cursor'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'windsurf',
                displayName: 'Windsurf',
                globalDir: path.join(homeDir, '.windsurf', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.windsurf')],
                hostNames: ['windsurf'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'antigravity',
                displayName: 'Antigravity',
                globalDir: path.join(homeDir, '.gemini', 'antigravity', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.gemini', 'antigravity')],
                hostNames: ['antigravity'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'claude-code',
                displayName: 'Claude Code',
                globalDir: path.join(homeDir, '.claude', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.claude')],
                hostNames: ['claude', 'claude code'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'codex',
                displayName: 'Codex',
                globalDir: path.join(process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex'), 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [process.env.CODEX_HOME?.trim() || path.join(homeDir, '.codex'), '/etc/codex'],
                hostNames: ['codex'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'gemini-cli',
                displayName: 'Gemini CLI',
                globalDir: path.join(homeDir, '.gemini', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.gemini')],
                hostNames: ['gemini', 'gemini cli'],
                preferredInstallMode: 'symlink',
                installed: false
            },
            {
                name: 'opencode',
                displayName: 'OpenCode',
                globalDir: path.join(homeDir, '.config', 'opencode', 'skills'),
                canonicalDir: ToolInstallService.CANONICAL_ROOT,
                detectionPaths: [path.join(homeDir, '.config', 'opencode')],
                hostNames: ['opencode', 'open code'],
                preferredInstallMode: 'symlink',
                installed: false
            }
        ];
        for (const toolConfig of toolConfigs) {
            this.tools.set(toolConfig.name, toolConfig);
        }
    }
    /**
     * Detect which tools are installed on the system
     */
    detectTools() {
        const detected = [];
        for (const [_, toolConfig] of this.tools) {
            const exists = toolConfig.detectionPaths.some((candidate) => fs.existsSync(candidate));
            toolConfig.installed = exists;
            if (exists) {
                detected.push(toolConfig);
                (0, UI_1.logToOutput)(`[Tools] Detected: ${toolConfig.displayName} at ${toolConfig.globalDir}`);
            }
            else {
                (0, UI_1.logToOutput)(`[Tools] Not found: ${toolConfig.displayName} (${toolConfig.globalDir})`);
            }
        }
        return detected;
    }
    /**
     * Get all configured tools
     */
    getAllTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Get a specific tool config
     */
    getTool(toolName) {
        return this.tools.get(toolName) || null;
    }
    /**
     * Resolve the current host where the extension is running.
     */
    resolveCurrentTool(appName) {
        const normalized = appName.toLowerCase();
        for (const tool of this.tools.values()) {
            if (tool.hostNames.some((hostName) => normalized.includes(hostName))) {
                // If we're currently running inside this host, it is available by definition.
                tool.installed = true;
                return tool;
            }
        }
        const fallback = this.tools.get('vscode');
        fallback.installed = true;
        return fallback;
    }
    /**
     * Install a skill to a specific tool
     */
    async installSkill(toolName, skillId, skillName, githubUrl) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }
            // Refresh detection at install time in case the host/tool appeared after activation.
            if (!tool.installed) {
                tool.installed = tool.detectionPaths.some((candidate) => fs.existsSync(candidate));
            }
            if (!tool.installed) {
                throw new Error(`Tool ${tool.displayName} is not installed on this system`);
            }
            (0, UI_1.logToOutput)(`[Install] Starting install of ${skillName} to ${tool.displayName}`);
            const installResult = await this.downloadSkill(githubUrl, tool, skillId, skillName);
            (0, UI_1.logToOutput)(`[Install] Successfully installed ${skillName} to ${installResult.installPath}`);
            return installResult;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Installation failed: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Uninstall a skill from a specific tool
     */
    async uninstallSkill(toolName, skillId, localPath) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }
            if (!fs.existsSync(localPath)) {
                (0, UI_1.logToOutput)(`[Uninstall] Path not found (already removed?): ${localPath}`);
                return;
            }
            // Remove the skill directory or symlink
            this.removeInstallTarget(localPath);
            (0, UI_1.logToOutput)(`[Uninstall] Successfully uninstalled skill from ${localPath}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Uninstallation failed: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Download skill from GitHub
     */
    downloadSkill(githubUrl, tool, skillId, skillName) {
        return new Promise((resolve, reject) => {
            this.installFromGithub(githubUrl, tool, skillId, skillName).then(resolve).catch(reject);
        });
    }
    async installFromGithub(githubUrl, tool, skillId, skillName) {
        const context = GitHubContentService_1.gitHubContentService.parseGitHubUrl(githubUrl);
        const metadata = await GitHubContentService_1.gitHubContentService.getRepoMetadata(context);
        const branch = context.branch === 'HEAD' ? metadata.defaultBranch : context.branch;
        const skillPath = await this.resolveSkillPath(context.owner, context.repo, branch, context.skillPath, skillName);
        if (!skillPath) {
            throw new Error('GitHub URL must point to a skill directory.');
        }
        const resolvedContext = {
            ...context,
            branch,
            skillPath
        };
        const canonicalPath = path.join(tool.canonicalDir || ToolInstallService.CANONICAL_ROOT, this.sanitizeSegment(skillId));
        const installPath = path.join(tool.globalDir, this.sanitizeSegment(skillId));
        await fs.promises.mkdir(path.dirname(canonicalPath), { recursive: true });
        await fs.promises.mkdir(path.dirname(installPath), { recursive: true });
        await this.removeInstallTarget(installPath);
        await this.removeInstallTarget(canonicalPath);
        await fs.promises.mkdir(canonicalPath, { recursive: true });
        await this.downloadDirectory(resolvedContext.owner, resolvedContext.repo, resolvedContext.branch, skillPath, canonicalPath);
        await this.writeInstallMetadata(canonicalPath, skillId, skillName, githubUrl, resolvedContext.owner, resolvedContext.repo, resolvedContext.branch, skillPath);
        const preferredMode = tool.preferredInstallMode || 'symlink';
        const installMethod = await this.materializeInstall(canonicalPath, installPath, preferredMode);
        return {
            tool,
            canonicalPath,
            installPath,
            installMethod,
            source: {
                githubUrl,
                owner: resolvedContext.owner,
                repo: resolvedContext.repo,
                branch: resolvedContext.branch,
                skillPath
            }
        };
    }
    async resolveSkillPath(owner, repo, branch, skillPath, skillName) {
        if (skillPath && skillPath.trim().length > 0) {
            return skillPath.trim().replace(/^\/+|\/+$/g, '');
        }
        return this.findSkillDirectory(owner, repo, branch, skillName);
    }
    async findSkillDirectory(owner, repo, branch, skillName) {
        const endpoint = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const payload = await this.getJson(endpoint);
        if (!payload || typeof payload !== 'object') {
            throw new Error('Unexpected GitHub tree response');
        }
        const record = payload;
        const tree = Array.isArray(record.tree) ? record.tree : [];
        const normalizedName = this.sanitizeSegment(skillName);
        const skillDirectories = tree
            .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }
            const treeEntry = entry;
            const entryPath = typeof treeEntry.path === 'string' ? treeEntry.path : '';
            const entryType = typeof treeEntry.type === 'string' ? treeEntry.type : '';
            if (entryType !== 'blob' || !entryPath.endsWith('/SKILL.md') && entryPath !== 'SKILL.md') {
                return null;
            }
            return path.posix.dirname(entryPath) === '.' ? '' : path.posix.dirname(entryPath);
        })
            .filter((entry) => entry !== null);
        if (skillDirectories.length === 0) {
            throw new Error('No SKILL.md file found in the GitHub repository.');
        }
        const exactNameMatch = skillDirectories.find((candidate) => {
            const baseName = path.posix.basename(candidate || '/');
            return this.sanitizeSegment(baseName) === normalizedName;
        });
        if (exactNameMatch !== undefined) {
            return exactNameMatch;
        }
        if (skillDirectories.length === 1) {
            return skillDirectories[0];
        }
        const skillsFolderMatch = skillDirectories.find((candidate) => candidate.includes('/skills/') || candidate.startsWith('skills/'));
        if (skillsFolderMatch !== undefined) {
            return skillsFolderMatch;
        }
        throw new Error('Could not determine which skill directory to install from this repository URL.');
    }
    async materializeInstall(canonicalPath, installPath, preferredMode) {
        if (preferredMode === 'symlink') {
            const symlinkCreated = await this.createSymlink(canonicalPath, installPath);
            if (symlinkCreated) {
                return 'symlink';
            }
            (0, UI_1.logToOutput)(`[Install] Symlink unavailable for ${installPath}; falling back to copy.`);
        }
        await fs.promises.cp(canonicalPath, installPath, { recursive: true, force: true });
        return 'copy';
    }
    async downloadDirectory(owner, repo, branch, remotePath, localPath) {
        const entries = await this.fetchDirectoryEntries(owner, repo, branch, remotePath);
        if (entries.length === 0) {
            throw new Error(`No files found at GitHub path ${remotePath}`);
        }
        for (const entry of entries) {
            const relativePath = path.posix.relative(remotePath, entry.path);
            const destinationPath = path.join(localPath, relativePath.split('/').join(path.sep));
            if (entry.type === 'dir') {
                await fs.promises.mkdir(destinationPath, { recursive: true });
                await this.downloadDirectory(owner, repo, branch, entry.path, destinationPath);
                continue;
            }
            await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
            await this.downloadFile(entry.downloadUrl, destinationPath);
        }
    }
    async fetchDirectoryEntries(owner, repo, branch, remotePath) {
        const endpointPath = remotePath
            .split('/')
            .filter((segment) => segment.length > 0)
            .map((segment) => encodeURIComponent(segment))
            .join('/');
        const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${endpointPath}?ref=${encodeURIComponent(branch)}`;
        const payload = await this.getJson(endpoint);
        if (!Array.isArray(payload)) {
            throw new Error(`Expected GitHub directory listing for ${remotePath}`);
        }
        const entries = payload
            .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }
            const record = entry;
            const entryPath = typeof record.path === 'string' ? record.path : '';
            const type = record.type === 'dir' ? 'dir' : record.type === 'file' ? 'file' : null;
            const downloadUrl = typeof record.download_url === 'string' ? record.download_url : undefined;
            if (!entryPath || !type) {
                return null;
            }
            return {
                path: entryPath,
                type,
                downloadUrl
            };
        })
            .filter((entry) => entry !== null);
        return entries;
    }
    downloadFile(downloadUrl, destinationPath) {
        return new Promise((resolve, reject) => {
            if (!downloadUrl) {
                reject(new Error(`GitHub file is missing a download URL: ${destinationPath}`));
                return;
            }
            const request = https.get(downloadUrl, {
                headers: {
                    'User-Agent': 'Skills-VSCode-Extension/1.0',
                    Accept: 'application/vnd.github.raw'
                }
            }, (response) => {
                if (!response.statusCode || response.statusCode >= 400) {
                    reject(new Error(`Failed to download file (${response.statusCode ?? 'unknown'}): ${downloadUrl}`));
                    response.resume();
                    return;
                }
                const chunks = [];
                response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on('end', async () => {
                    try {
                        await fs.promises.writeFile(destinationPath, Buffer.concat(chunks));
                        resolve();
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            request.on('error', reject);
        });
    }
    getJson(url) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'Skills-VSCode-Extension/1.0',
                    Accept: 'application/vnd.github+json'
                }
            }, (response) => {
                if (!response.statusCode || response.statusCode >= 400) {
                    reject(new Error(`GitHub request failed (${response.statusCode ?? 'unknown'}): ${url}`));
                    response.resume();
                    return;
                }
                const chunks = [];
                response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            request.on('error', reject);
        });
    }
    async createSymlink(targetPath, linkPath) {
        try {
            const linkParent = path.dirname(linkPath);
            await fs.promises.mkdir(linkParent, { recursive: true });
            const relativeTarget = path.relative(linkParent, targetPath);
            const symlinkType = process.platform === 'win32' ? 'junction' : undefined;
            await fs.promises.symlink(relativeTarget, linkPath, symlinkType);
            return true;
        }
        catch (error) {
            (0, UI_1.logToOutput)(`[Install] Symlink creation failed for ${linkPath}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    async writeInstallMetadata(canonicalPath, skillId, skillName, githubUrl, owner, repo, branch, skillPath) {
        const infoFile = path.join(canonicalPath, 'skill.json');
        const skillInfo = {
            id: skillId,
            name: skillName,
            github_url: githubUrl,
            installed_at: new Date().toISOString(),
            owner,
            repo,
            branch,
            skill_path: skillPath
        };
        await fs.promises.writeFile(infoFile, JSON.stringify(skillInfo, null, 2));
    }
    sanitizeSegment(value) {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'skill';
    }
    removeInstallTarget(targetPath) {
        if (!fs.existsSync(targetPath)) {
            return;
        }
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
            fs.unlinkSync(targetPath);
            return;
        }
        this.removeDirectoryRecursively(targetPath);
    }
    /**
     * Remove directory recursively
     */
    removeDirectoryRecursively(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file) => {
                const filePath = path.join(dirPath, file);
                if (fs.lstatSync(filePath).isDirectory()) {
                    this.removeDirectoryRecursively(filePath);
                }
                else {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
}
exports.ToolInstallService = ToolInstallService;
// Export singleton instance
exports.toolInstallService = new ToolInstallService();
//# sourceMappingURL=ToolInstallService.js.map
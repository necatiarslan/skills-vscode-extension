"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolInstallService = exports.ToolInstallService = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
const UI_1 = require("../common/UI");
/**
 * ToolInstallService - Handles tool detection and skill installation/uninstallation
 */
class ToolInstallService {
    tools = new Map();
    constructor() {
        this.initializeTools();
    }
    /**
     * Initialize tool directory mappings
     */
    initializeTools() {
        const homeDir = os.homedir();
        this.tools.set('vscode', {
            name: 'vscode',
            displayName: 'Visual Studio Code',
            globalDir: path.join(homeDir, '.vscode', 'extensions'),
            installed: false
        });
        this.tools.set('cursor', {
            name: 'cursor',
            displayName: 'Cursor',
            globalDir: path.join(homeDir, '.cursor', 'extensions'),
            installed: false
        });
        this.tools.set('windsurf', {
            name: 'windsurf',
            displayName: 'Windsurf',
            globalDir: path.join(homeDir, '.windsurf', 'extensions'),
            installed: false
        });
        this.tools.set('antigravity', {
            name: 'antigravity',
            displayName: 'Antigravity',
            globalDir: path.join(homeDir, '.antigravity', 'skills'),
            installed: false
        });
    }
    /**
     * Detect which tools are installed on the system
     */
    detectTools() {
        const detected = [];
        for (const [_, toolConfig] of this.tools) {
            const exists = fs.existsSync(toolConfig.globalDir);
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
     * Install a skill to a specific tool
     */
    async installSkill(toolName, skillId, skillName, githubUrl) {
        try {
            const tool = this.tools.get(toolName);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }
            if (!tool.installed) {
                throw new Error(`Tool ${tool.displayName} is not installed on this system`);
            }
            (0, UI_1.logToOutput)(`[Install] Starting install of ${skillName} to ${tool.displayName}`);
            // Download skill from GitHub
            const skillPath = await this.downloadSkill(githubUrl, tool, skillId);
            (0, UI_1.logToOutput)(`[Install] Successfully installed ${skillName} to ${skillPath}`);
            return skillPath;
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
            // Remove the skill directory
            this.removeDirectoryRecursively(localPath);
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
    downloadSkill(githubUrl, tool, skillId) {
        return new Promise((resolve, reject) => {
            try {
                // Extract owner/repo from GitHub URL
                const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
                if (!match) {
                    reject(new Error('Invalid GitHub URL'));
                    return;
                }
                const [, owner, repo] = match;
                const extractPath = path.join(tool.globalDir, skillId);
                (0, UI_1.logToOutput)(`[Download] Installing skill from: ${githubUrl}`);
                // Ensure extraction directory exists
                if (!fs.existsSync(extractPath)) {
                    fs.mkdirSync(extractPath, { recursive: true });
                }
                // For MVP, create a placeholder structure with repo reference
                // Future: implement actual tarball download and extraction or use GitHub API
                const infoFile = path.join(extractPath, 'skill.json');
                const skillInfo = {
                    id: skillId,
                    github_url: githubUrl,
                    installed_at: new Date().toISOString(),
                    owner,
                    repo
                };
                fs.writeFileSync(infoFile, JSON.stringify(skillInfo, null, 2));
                (0, UI_1.logToOutput)(`[Download] Skill registered at ${extractPath}`);
                resolve(extractPath);
            }
            catch (error) {
                reject(error);
            }
        });
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
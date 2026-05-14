"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsStorageService = void 0;
exports.initializeStorageService = initializeStorageService;
exports.getStorageService = getStorageService;
const UI_1 = require("../common/UI");
/**
 * SkillsStorageService - Manages persistence of installed skills
 * Stores per-tool installed skills in VS Code globalState
 */
class SkillsStorageService {
    globalState;
    static STORAGE_KEY_PREFIX = 'skills.installed';
    constructor(globalState) {
        this.globalState = globalState;
    }
    /**
     * Get the storage key for a specific tool
     */
    getToolKey(tool) {
        return `${SkillsStorageService.STORAGE_KEY_PREFIX}.${tool}`;
    }
    /**
     * Add an installed skill for a tool
     */
    async addInstalled(tool, skillId, skillName, author, version, installResult) {
        try {
            const toolKey = this.getToolKey(tool);
            const installed = this.globalState.get(toolKey, {});
            const localPath = typeof installResult === 'string' ? installResult : installResult.installPath;
            installed[skillId] = {
                skillId,
                name: skillName,
                author,
                version,
                installedAt: Date.now(),
                localPath,
                canonicalPath: typeof installResult === 'string' ? undefined : installResult.canonicalPath,
                installMethod: typeof installResult === 'string' ? undefined : installResult.installMethod,
                sourceUrl: typeof installResult === 'string' ? undefined : installResult.source.githubUrl,
                sourceBranch: typeof installResult === 'string' ? undefined : installResult.source.branch,
                sourcePath: typeof installResult === 'string' ? undefined : installResult.source.skillPath
            };
            await this.globalState.update(toolKey, installed);
            (0, UI_1.logToOutput)(`[Storage] Added skill ${skillId} to ${tool}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Failed to add installed skill: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Remove an installed skill from a tool
     */
    async removeInstalled(tool, skillId) {
        try {
            const toolKey = this.getToolKey(tool);
            const installed = this.globalState.get(toolKey, {});
            delete installed[skillId];
            await this.globalState.update(toolKey, installed);
            (0, UI_1.logToOutput)(`[Storage] Removed skill ${skillId} from ${tool}`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            (0, UI_1.logToOutput)(`[ERROR] Failed to remove installed skill: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Get all installed skills for a specific tool
     */
    getInstalledByTool(tool) {
        const toolKey = this.getToolKey(tool);
        const installed = this.globalState.get(toolKey, {});
        return Object.values(installed);
    }
    /**
     * Check if a skill is installed for a specific tool
     */
    isInstalled(tool, skillId) {
        const toolKey = this.getToolKey(tool);
        const installed = this.globalState.get(toolKey, {});
        return skillId in installed;
    }
    /**
     * Get a specific installed skill
     */
    getInstalledSkill(tool, skillId) {
        const toolKey = this.getToolKey(tool);
        const installed = this.globalState.get(toolKey, {});
        return installed[skillId] || null;
    }
    /**
     * Get all installed skills across all tools
     */
    getAllInstalled() {
        const result = {};
        const tools = ['vscode', 'cursor', 'windsurf', 'antigravity'];
        for (const tool of tools) {
            result[tool] = this.getInstalledByTool(tool);
        }
        return result;
    }
    /**
     * Clear all installed skills for a tool
     */
    async clearToolInstalls(tool) {
        const toolKey = this.getToolKey(tool);
        await this.globalState.update(toolKey, {});
        (0, UI_1.logToOutput)(`[Storage] Cleared all installations for ${tool}`);
    }
}
exports.SkillsStorageService = SkillsStorageService;
// Export singleton for use in extension
let storageService = null;
function initializeStorageService(globalState) {
    storageService = new SkillsStorageService(globalState);
    return storageService;
}
function getStorageService() {
    if (!storageService) {
        throw new Error('SkillsStorageService not initialized. Call initializeStorageService first.');
    }
    return storageService;
}
//# sourceMappingURL=SkillsStorageService.js.map
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
    static OUTDATED_KEY_PREFIX = 'skills.outdated';
    constructor(globalState) {
        this.globalState = globalState;
    }
    /**
     * Get the storage key for a specific tool
     */
    getToolKey(tool) {
        return `${SkillsStorageService.STORAGE_KEY_PREFIX}.${tool}`;
    }
    getOutdatedToolKey(tool) {
        return `${SkillsStorageService.OUTDATED_KEY_PREFIX}.${tool}`;
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
            const outdatedToolKey = this.getOutdatedToolKey(tool);
            const outdated = this.globalState.get(outdatedToolKey, {});
            if (outdated[skillId]) {
                delete outdated[skillId];
                await this.globalState.update(outdatedToolKey, outdated);
            }
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
            const outdatedToolKey = this.getOutdatedToolKey(tool);
            const outdated = this.globalState.get(outdatedToolKey, {});
            delete installed[skillId];
            delete outdated[skillId];
            await this.globalState.update(toolKey, installed);
            await this.globalState.update(outdatedToolKey, outdated);
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
    getOutdatedSkillIdsByTool(tool) {
        const outdatedToolKey = this.getOutdatedToolKey(tool);
        const outdated = this.globalState.get(outdatedToolKey, {});
        return Object.keys(outdated).filter((skillId) => !!outdated[skillId]);
    }
    isOutdated(tool, skillId) {
        const outdatedToolKey = this.getOutdatedToolKey(tool);
        const outdated = this.globalState.get(outdatedToolKey, {});
        return !!outdated[skillId];
    }
    async markOutdated(tool, skillId) {
        const outdatedToolKey = this.getOutdatedToolKey(tool);
        const outdated = this.globalState.get(outdatedToolKey, {});
        outdated[skillId] = true;
        await this.globalState.update(outdatedToolKey, outdated);
        (0, UI_1.logToOutput)(`[Storage] Marked outdated skill ${skillId} for ${tool}`);
    }
    async clearOutdated(tool, skillId) {
        const outdatedToolKey = this.getOutdatedToolKey(tool);
        const outdated = this.globalState.get(outdatedToolKey, {});
        if (!outdated[skillId]) {
            return;
        }
        delete outdated[skillId];
        await this.globalState.update(outdatedToolKey, outdated);
        (0, UI_1.logToOutput)(`[Storage] Cleared outdated skill ${skillId} for ${tool}`);
    }
    /**
     * Clear all installed skills for a tool
     */
    async clearToolInstalls(tool) {
        const toolKey = this.getToolKey(tool);
        const outdatedToolKey = this.getOutdatedToolKey(tool);
        await this.globalState.update(toolKey, {});
        await this.globalState.update(outdatedToolKey, {});
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
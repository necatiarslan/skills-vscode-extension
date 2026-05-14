import * as vscode from 'vscode';
import { logToOutput } from '../common/UI';
import { InstalledSkill, InstallResult } from './types';

/**
 * SkillsStorageService - Manages persistence of installed skills
 * Stores per-tool installed skills in VS Code globalState
 */
export class SkillsStorageService {
  private static readonly STORAGE_KEY_PREFIX = 'skills.installed';

  constructor(private globalState: vscode.Memento) {}

  /**
   * Get the storage key for a specific tool
   */
  private getToolKey(tool: string): string {
    return `${SkillsStorageService.STORAGE_KEY_PREFIX}.${tool}`;
  }

  /**
   * Add an installed skill for a tool
   */
  public async addInstalled(
    tool: string,
    skillId: string,
    skillName: string,
    author: string,
    version: string,
    installResult: string | InstallResult
  ): Promise<void> {
    try {
      const toolKey = this.getToolKey(tool);
      const installed = this.globalState.get<Record<string, InstalledSkill>>(toolKey, {});

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
      logToOutput(`[Storage] Added skill ${skillId} to ${tool}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Failed to add installed skill: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Remove an installed skill from a tool
   */
  public async removeInstalled(tool: string, skillId: string): Promise<void> {
    try {
      const toolKey = this.getToolKey(tool);
      const installed = this.globalState.get<Record<string, InstalledSkill>>(toolKey, {});

      delete installed[skillId];

      await this.globalState.update(toolKey, installed);
      logToOutput(`[Storage] Removed skill ${skillId} from ${tool}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Failed to remove installed skill: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Get all installed skills for a specific tool
   */
  public getInstalledByTool(tool: string): InstalledSkill[] {
    const toolKey = this.getToolKey(tool);
    const installed = this.globalState.get<Record<string, InstalledSkill>>(toolKey, {});
    return Object.values(installed);
  }

  /**
   * Check if a skill is installed for a specific tool
   */
  public isInstalled(tool: string, skillId: string): boolean {
    const toolKey = this.getToolKey(tool);
    const installed = this.globalState.get<Record<string, InstalledSkill>>(toolKey, {});
    return skillId in installed;
  }

  /**
   * Get a specific installed skill
   */
  public getInstalledSkill(tool: string, skillId: string): InstalledSkill | null {
    const toolKey = this.getToolKey(tool);
    const installed = this.globalState.get<Record<string, InstalledSkill>>(toolKey, {});
    return installed[skillId] || null;
  }

  /**
   * Get all installed skills across all tools
   */
  public getAllInstalled(): Record<string, InstalledSkill[]> {
    const result: Record<string, InstalledSkill[]> = {};
    const tools = ['vscode', 'cursor', 'windsurf', 'antigravity'];

    for (const tool of tools) {
      result[tool] = this.getInstalledByTool(tool);
    }

    return result;
  }

  /**
   * Clear all installed skills for a tool
   */
  public async clearToolInstalls(tool: string): Promise<void> {
    const toolKey = this.getToolKey(tool);
    await this.globalState.update(toolKey, {});
    logToOutput(`[Storage] Cleared all installations for ${tool}`);
  }
}

// Export singleton for use in extension
let storageService: SkillsStorageService | null = null;

export function initializeStorageService(globalState: vscode.Memento): SkillsStorageService {
  storageService = new SkillsStorageService(globalState);
  return storageService;
}

export function getStorageService(): SkillsStorageService {
  if (!storageService) {
    throw new Error('SkillsStorageService not initialized. Call initializeStorageService first.');
  }
  return storageService;
}

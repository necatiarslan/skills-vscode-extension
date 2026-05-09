import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { logToOutput } from '../common/UI';
import { ToolConfig } from './types';

/**
 * ToolInstallService - Handles tool detection and skill installation/uninstallation
 */
export class ToolInstallService {
  private tools: Map<string, ToolConfig> = new Map();

  constructor() {
    this.initializeTools();
  }

  /**
   * Initialize tool directory mappings
   */
  private initializeTools(): void {
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
  public detectTools(): ToolConfig[] {
    const detected: ToolConfig[] = [];

    for (const [_, toolConfig] of this.tools) {
      const exists = fs.existsSync(toolConfig.globalDir);
      toolConfig.installed = exists;

      if (exists) {
        detected.push(toolConfig);
        logToOutput(`[Tools] Detected: ${toolConfig.displayName} at ${toolConfig.globalDir}`);
      } else {
        logToOutput(`[Tools] Not found: ${toolConfig.displayName} (${toolConfig.globalDir})`);
      }
    }

    return detected;
  }

  /**
   * Get all configured tools
   */
  public getAllTools(): ToolConfig[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool config
   */
  public getTool(toolName: string): ToolConfig | null {
    return this.tools.get(toolName) || null;
  }

  /**
   * Install a skill to a specific tool
   */
  public async installSkill(
    toolName: string,
    skillId: string,
    skillName: string,
    githubUrl: string
  ): Promise<string> {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      if (!tool.installed) {
        throw new Error(`Tool ${tool.displayName} is not installed on this system`);
      }

      logToOutput(`[Install] Starting install of ${skillName} to ${tool.displayName}`);

      // Download skill from GitHub
      const skillPath = await this.downloadSkill(githubUrl, tool, skillId);

      logToOutput(`[Install] Successfully installed ${skillName} to ${skillPath}`);
      return skillPath;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Installation failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Uninstall a skill from a specific tool
   */
  public async uninstallSkill(toolName: string, skillId: string, localPath: string): Promise<void> {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      if (!fs.existsSync(localPath)) {
        logToOutput(`[Uninstall] Path not found (already removed?): ${localPath}`);
        return;
      }

      // Remove the skill directory
      this.removeDirectoryRecursively(localPath);
      logToOutput(`[Uninstall] Successfully uninstalled skill from ${localPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Uninstallation failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Download skill from GitHub
   */
  private downloadSkill(
    githubUrl: string,
    tool: ToolConfig,
    skillId: string
  ): Promise<string> {
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

        logToOutput(`[Download] Installing skill from: ${githubUrl}`);

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
        logToOutput(`[Download] Skill registered at ${extractPath}`);

        resolve(extractPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Remove directory recursively
   */
  private removeDirectoryRecursively(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach((file) => {
        const filePath = path.join(dirPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          this.removeDirectoryRecursively(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  }
}

// Export singleton instance
export const toolInstallService = new ToolInstallService();

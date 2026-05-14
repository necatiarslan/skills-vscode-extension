import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { logToOutput } from '../common/UI';
import { SKILL_LOCATION_CONFIG } from '../common/SkillLocationConfig';
import { gitHubContentService } from './GitHubContentService';
import { InstallMethod, InstallResult, ToolConfig } from './types';

/**
 * ToolInstallService - Handles tool detection and skill installation/uninstallation
 */
export class ToolInstallService {
  private static readonly CANONICAL_ROOT = SKILL_LOCATION_CONFIG.canonicalSkillRoot;
  private tools: Map<string, ToolConfig> = new Map();

  constructor() {
    this.initializeTools();
    this.detectTools();
  }

  /**
   * Initialize tool directory mappings
   */
  private initializeTools(): void {
    const toolConfigs: ToolConfig[] = SKILL_LOCATION_CONFIG.agents.map((agent) => ({
      name: agent.name,
      displayName: agent.displayName,
      globalDir: agent.globalSkillDir,
      canonicalDir: ToolInstallService.CANONICAL_ROOT,
      detectionPaths: agent.detectionPaths,
      hostNames: agent.hostNames,
      preferredInstallMode: agent.preferredInstallMode,
      installed: false
    }));

    for (const toolConfig of toolConfigs) {
      this.tools.set(toolConfig.name, toolConfig);
    }
  }

  /**
   * Detect which tools are installed on the system
   */
  public detectTools(): ToolConfig[] {
    const detected: ToolConfig[] = [];

    for (const [_, toolConfig] of this.tools) {
      const exists = toolConfig.detectionPaths.some((candidate) => fs.existsSync(candidate));
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
   * Resolve the current host where the extension is running.
   */
  public resolveCurrentTool(appName: string): ToolConfig {
    const normalized = appName.toLowerCase();

    for (const tool of this.tools.values()) {
      if (tool.hostNames.some((hostName) => normalized.includes(hostName))) {
        // If we're currently running inside this host, it is available by definition.
        tool.installed = true;
        return tool;
      }
    }

    const fallback = this.tools.get('vscode')!;
    fallback.installed = true;
    return fallback;
  }

  /**
   * Install a skill to a specific tool
   */
  public async installSkill(
    toolName: string,
    skillId: string,
    skillName: string,
    githubUrl: string
  ): Promise<InstallResult> {
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

      logToOutput(`[Install] Starting install of ${skillName} to ${tool.displayName}`);

      const installResult = await this.downloadSkill(githubUrl, tool, skillId, skillName);

      logToOutput(`[Install] Successfully installed ${skillName} to ${installResult.installPath}`);
      return installResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Installation failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Install a skill to a custom directory (used for workspace installs).
   */
  public async installSkillToDirectory(
    toolName: string,
    skillId: string,
    skillName: string,
    githubUrl: string,
    installDirectory: string
  ): Promise<InstallResult> {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      if (!installDirectory || installDirectory.trim().length === 0) {
        throw new Error('Install directory is required.');
      }

      const resolvedInstallDirectory = path.resolve(installDirectory);

      // Refresh detection at install time in case the host/tool appeared after activation.
      if (!tool.installed) {
        tool.installed = tool.detectionPaths.some((candidate) => fs.existsSync(candidate));
      }

      if (!tool.installed) {
        throw new Error(`Tool ${tool.displayName} is not installed on this system`);
      }

      const targetTool: ToolConfig = {
        ...tool,
        globalDir: resolvedInstallDirectory
      };

      logToOutput(`[Install] Starting workspace install of ${skillName} to ${resolvedInstallDirectory}`);

      const installResult = await this.downloadSkill(githubUrl, targetTool, skillId, skillName);

      logToOutput(`[Install] Successfully installed ${skillName} to ${installResult.installPath}`);
      return installResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logToOutput(`[ERROR] Workspace installation failed: ${errorMsg}`);
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

      // Remove the skill directory or symlink
      this.removeInstallTarget(localPath);
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
    skillId: string,
    skillName: string
  ): Promise<InstallResult> {
    return new Promise((resolve, reject) => {
      this.installFromGithub(githubUrl, tool, skillId, skillName).then(resolve).catch(reject);
    });
  }

  private async installFromGithub(
    githubUrl: string,
    tool: ToolConfig,
    skillId: string,
    skillName: string
  ): Promise<InstallResult> {
    const context = gitHubContentService.parseGitHubUrl(githubUrl);
    const metadata = await gitHubContentService.getRepoMetadata(context);
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

  private async resolveSkillPath(
    owner: string,
    repo: string,
    branch: string,
    skillPath: string,
    skillName: string
  ): Promise<string> {
    if (skillPath && skillPath.trim().length > 0) {
      return skillPath.trim().replace(/^\/+|\/+$/g, '');
    }

    return this.findSkillDirectory(owner, repo, branch, skillName);
  }

  private async findSkillDirectory(owner: string, repo: string, branch: string, skillName: string): Promise<string> {
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const payload = await this.getJson(endpoint);

    if (!payload || typeof payload !== 'object') {
      throw new Error('Unexpected GitHub tree response');
    }

    const record = payload as Record<string, unknown>;
    const tree = Array.isArray(record.tree) ? record.tree : [];
    const normalizedName = this.sanitizeSegment(skillName);
    const skillDirectories = tree
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const treeEntry = entry as Record<string, unknown>;
        const entryPath = typeof treeEntry.path === 'string' ? treeEntry.path : '';
        const entryType = typeof treeEntry.type === 'string' ? treeEntry.type : '';

        if (entryType !== 'blob' || !entryPath.endsWith('/SKILL.md') && entryPath !== 'SKILL.md') {
          return null;
        }

        return path.posix.dirname(entryPath) === '.' ? '' : path.posix.dirname(entryPath);
      })
      .filter((entry): entry is string => entry !== null);

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

  private async materializeInstall(canonicalPath: string, installPath: string, preferredMode: InstallMethod): Promise<InstallMethod> {
    if (preferredMode === 'symlink') {
      const symlinkCreated = await this.createSymlink(canonicalPath, installPath);
      if (symlinkCreated) {
        return 'symlink';
      }

      logToOutput(`[Install] Symlink unavailable for ${installPath}; falling back to copy.`);
    }

    await fs.promises.cp(canonicalPath, installPath, { recursive: true, force: true });
    return 'copy';
  }

  private async downloadDirectory(
    owner: string,
    repo: string,
    branch: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
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

  private async fetchDirectoryEntries(owner: string, repo: string, branch: string, remotePath: string): Promise<Array<{ path: string; type: 'file' | 'dir'; downloadUrl?: string }>> {
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
      .map((entry): { path: string; type: 'file' | 'dir'; downloadUrl?: string } | null => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
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

  private downloadFile(downloadUrl: string | undefined, destinationPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!downloadUrl) {
        reject(new Error(`GitHub file is missing a download URL: ${destinationPath}`));
        return;
      }

      const request = https.get(
        downloadUrl,
        {
          headers: {
            'User-Agent': 'Skills-VSCode-Extension/1.0',
            Accept: 'application/vnd.github.raw'
          }
        },
        (response) => {
          if (!response.statusCode || response.statusCode >= 400) {
            reject(new Error(`Failed to download file (${response.statusCode ?? 'unknown'}): ${downloadUrl}`));
            response.resume();
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', async () => {
            try {
              await fs.promises.writeFile(destinationPath, Buffer.concat(chunks));
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      request.on('error', reject);
    });
  }

  private getJson(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request = https.get(
        url,
        {
          headers: {
            'User-Agent': 'Skills-VSCode-Extension/1.0',
            Accept: 'application/vnd.github+json'
          }
        },
        (response) => {
          if (!response.statusCode || response.statusCode >= 400) {
            reject(new Error(`GitHub request failed (${response.statusCode ?? 'unknown'}): ${url}`));
            response.resume();
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      request.on('error', reject);
    });
  }

  private async createSymlink(targetPath: string, linkPath: string): Promise<boolean> {
    try {
      const linkParent = path.dirname(linkPath);
      await fs.promises.mkdir(linkParent, { recursive: true });
      const relativeTarget = path.relative(linkParent, targetPath);
      const symlinkType: fs.symlink.Type | undefined = process.platform === 'win32' ? 'junction' : undefined;
      await fs.promises.symlink(relativeTarget, linkPath, symlinkType);
      return true;
    } catch (error) {
      logToOutput(`[Install] Symlink creation failed for ${linkPath}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async writeInstallMetadata(
    canonicalPath: string,
    skillId: string,
    skillName: string,
    githubUrl: string,
    owner: string,
    repo: string,
    branch: string,
    skillPath: string
  ): Promise<void> {
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

  private sanitizeSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill';
  }

  private removeInstallTarget(targetPath: string): void {
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

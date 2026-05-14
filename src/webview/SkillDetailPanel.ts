import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getSkillAgentLocation } from '../common/SkillLocationConfig';
import { logToOutput } from '../common/UI';
import { getSkillEmoji } from '../common/SkillEmoji';
import { gitHubContentService, skillsApiService, toolInstallService } from '../services';
import { getStorageService } from '../services/SkillsStorageService';
import { SkillsPanel } from './SkillsPanel';
import {
  GitHubRepoContext,
  LocalDirectoryResult,
  LocalFilePreview,
  LocalRepoEntry,
  Skill,
  SkillDetailPayload
} from '../services/types';

export class SkillDetailPanel {
  public static currentPanel: SkillDetailPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly currentToolName: string;
  private readonly currentToolDisplayName: string;
  private disposables: vscode.Disposable[] = [];
  private skill: Skill;
  private static readonly MAX_LOCAL_PREVIEW_BYTES = 100_000;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    skill: Skill,
    currentToolName: string,
    currentToolDisplayName: string
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.skill = skill;
    this.currentToolName = currentToolName;
    this.currentToolDisplayName = currentToolDisplayName;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this.disposables
    );
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    skill: Skill,
    currentToolName: string,
    currentToolDisplayName: string
  ): Promise<void> {
    const column = vscode.ViewColumn.Active;

    if (SkillDetailPanel.currentPanel) {
      SkillDetailPanel.currentPanel.skill = skill;
      SkillDetailPanel.currentPanel.panel.title = `Skill: ${skill.name}`;
      SkillDetailPanel.currentPanel.panel.reveal(column);
      await SkillDetailPanel.currentPanel.render();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'skillDetail',
      `Skill: ${skill.name}`,
      column,
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'extension')]
      }
    );

    SkillDetailPanel.currentPanel = new SkillDetailPanel(
      panel,
      extensionUri,
      skill,
      currentToolName,
      currentToolDisplayName
    );
    await SkillDetailPanel.currentPanel.render();
    logToOutput(`[Webview] Skill detail opened: ${skill.name}`);
  }

  private dispose() {
    SkillDetailPanel.currentPanel = undefined;

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }

  private async render(): Promise<void> {
    const detailPayload = await this.createSkillDetailPayload(this.skill);
    const installedSkill = getStorageService().getInstalledSkill(this.currentToolName, this.skill.id);
    this.panel.webview.html = this.getHtmlContent(detailPayload, !!installedSkill);
  }

  private async handleWebviewMessage(message: any) {
    logToOutput(`[SkillDetail] Message received: ${message.type}`);

    switch (message.type) {
      case 'loadRepoPath':
        await this.handleLoadRepoPath(message.context, message.path);
        break;
      case 'openRepoFile':
        await this.handleOpenRepoFile(message.context, message.path);
        break;
      case 'loadLocalPath':
        await this.handleLoadLocalPath(message.skillId, message.path);
        break;
      case 'openLocalFile':
        await this.handleOpenLocalFile(message.skillId, message.path);
        break;
      case 'openExternal':
        await this.handleOpenExternal(message.url);
        break;
      case 'openInstalledFolder':
        await this.handleOpenInstalledFolder(message.skillId, message.localPath);
        break;
      case 'install':
        await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
        break;
      case 'installWorkspace':
        await this.handleInstallWorkspace(message.skillId, message.skillName, message.githubUrl);
        break;
      case 'uninstall':
        await this.handleUninstall(message.skillId);
        break;
      default:
        logToOutput(`[SkillDetail] Unknown message type: ${message.type}`);
    }
  }

  private async handleLoadRepoPath(context: GitHubRepoContext, path: string) {
    try {
      const directory = await gitHubContentService.listDirectory(context, path);
      this.postMessage({ type: 'repoDirectory', directory, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'repoDirectory', directory: null, error: errorMsg });
    }
  }

  private async handleOpenRepoFile(context: GitHubRepoContext, path: string) {
    try {
      const preview = await gitHubContentService.getFilePreview(context, path);
      this.postMessage({ type: 'filePreview', preview, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'filePreview', preview: null, error: errorMsg });
    }
  }

  private async handleLoadLocalPath(skillId: string, localPath: string) {
    try {
      const rootPath = this.getInstalledSkillRoot(skillId);
      const directory = await this.listLocalDirectory(rootPath, localPath || '');
      this.postMessage({ type: 'localDirectory', directory, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'localDirectory', directory: null, error: errorMsg });
    }
  }

  private async handleOpenLocalFile(skillId: string, localPath: string) {
    try {
      const rootPath = this.getInstalledSkillRoot(skillId);
      const preview = await this.getLocalFilePreview(rootPath, localPath || '');
      this.postMessage({ type: 'localFilePreview', preview, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'localFilePreview', preview: null, error: errorMsg });
    }
  }

  private async handleOpenExternal(url: string) {
    if (!url) {
      return;
    }

    try {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'externalOpenResult', success: false, error: errorMsg });
    }
  }

  private async handleInstall(skillId: string, skillName: string, githubUrl: string) {
    try {
      const installResult = await toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
      await getStorageService().addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installResult);

      const localSkillMarkdown = await this.readLocalSkillMarkdown(installResult.installPath);
      const localRootDirectory = await this.listLocalDirectory(installResult.installPath, '');

      SkillsPanel.Current?.refreshInstalledSkills();

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        localPath: installResult.installPath,
        localSkillMarkdown,
        localRootDirectory,
        error: null
      });
    } catch (error) {
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

  private async handleInstallWorkspace(skillId: string, skillName: string, githubUrl: string) {
    try {
      const workspaceInstallDir = this.getWorkspaceInstallDirectory();
      const installResult = await toolInstallService.installSkillToDirectory(
        this.currentToolName,
        skillId,
        skillName,
        githubUrl,
        workspaceInstallDir
      );

      await getStorageService().addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installResult);

      const localSkillMarkdown = await this.readLocalSkillMarkdown(installResult.installPath);
      const localRootDirectory = await this.listLocalDirectory(installResult.installPath, '');

      SkillsPanel.Current?.refreshInstalledSkills();

      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        localPath: installResult.installPath,
        localSkillMarkdown,
        localRootDirectory,
        error: null
      });
    } catch (error) {
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

  private async handleUninstall(skillId: string) {
    try {
      const installed = getStorageService().getInstalledSkill(this.currentToolName, skillId);
      if (!installed) {
        throw new Error('Skill not found in storage');
      }

      await toolInstallService.uninstallSkill(this.currentToolName, skillId, installed.localPath);
      await getStorageService().removeInstalled(this.currentToolName, skillId);
      SkillsPanel.Current?.refreshInstalledSkills();
      this.postMessage({
        type: 'uninstallResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
        error: null
      });
    } catch (error) {
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

  private async handleOpenInstalledFolder(skillId: string, localPath: string) {
    try {
      const installed = getStorageService().getInstalledSkill(this.currentToolName, skillId);
      const folderPath = installed?.localPath || localPath;

      if (!folderPath) {
        throw new Error('Installed skill folder was not found.');
      }

      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
      this.postMessage({ type: 'openFolderResult', skillId, success: true, error: null });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'openFolderResult', skillId, success: false, error: errorMsg });
    }
  }

  private async createSkillDetailPayload(skill: Skill): Promise<SkillDetailPayload> {
    const detailSkill = await skillsApiService.fetchDetail(skill.id) ?? skill;
    const repoContext = gitHubContentService.parseGitHubUrl(detailSkill.githubUrl);
    const repoMetadata = await gitHubContentService.getRepoMetadata(repoContext);
    const resolvedContext: GitHubRepoContext = {
      ...repoContext,
      branch: repoContext.branch === 'HEAD' ? repoMetadata.defaultBranch : repoContext.branch
    };
    const initialPath = resolvedContext.skillPath || '';

    let initialDirectory;
    let initialPreview;

    if (initialPath) {
      try {
        initialDirectory = await gitHubContentService.listDirectory(resolvedContext, initialPath);
      } catch {
        const parentPath = initialPath.includes('/') ? initialPath.slice(0, initialPath.lastIndexOf('/')) : '';

        try {
          initialPreview = await gitHubContentService.getFilePreview(resolvedContext, initialPath);
        } catch {
          initialPreview = undefined;
        }

        initialDirectory = await gitHubContentService.listDirectory(resolvedContext, parentPath);
      }
    } else {
      initialDirectory = await gitHubContentService.listDirectory(resolvedContext, '');
    }

    const rootDirectory = initialDirectory;
    const skillEmoji = getSkillEmoji(detailSkill.id);
    const installedSkill = getStorageService().getInstalledSkill(this.currentToolName, detailSkill.id);

    let localRootDirectory: LocalDirectoryResult | undefined;
    if (installedSkill?.localPath && fs.existsSync(installedSkill.localPath)) {
      try {
        localRootDirectory = await this.listLocalDirectory(installedSkill.localPath, '');
      } catch {
        localRootDirectory = undefined;
      }
    }

    let skillMarkdown: string | undefined;
    if (installedSkill?.localPath && fs.existsSync(installedSkill.localPath)) {
      skillMarkdown = await this.readLocalSkillMarkdown(installedSkill.localPath);
    }

    if (!skillMarkdown) {
      try {
        const skillMarkdownPath = resolvedContext.skillPath
          ? `${resolvedContext.skillPath}/SKILL.md`
          : 'SKILL.md';
        const preview = await gitHubContentService.getFilePreview(resolvedContext, skillMarkdownPath);
        skillMarkdown = preview.content;
      } catch {
        // SKILL.md not found, that's okay
        skillMarkdown = undefined;
      }
    }

    return {
      skill: detailSkill,
      repoContext: resolvedContext,
      repoMetadata,
      rootDirectory,
      initialDirectory,
      initialPreview,
      localRootDirectory,
      localInitialDirectory: localRootDirectory,
      skillEmoji,
      skillMarkdown
    };
  }

  private getInstalledSkillRoot(skillId: string): string {
    const installed = getStorageService().getInstalledSkill(this.currentToolName, skillId);
    if (!installed?.localPath) {
      throw new Error('This skill is not installed locally.');
    }

    if (!fs.existsSync(installed.localPath)) {
      throw new Error('Local skill folder does not exist.');
    }

    return installed.localPath;
  }

  private getWorkspaceInstallDirectory(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder is open for workspace installation.');
    }

    const agentLocation = getSkillAgentLocation(this.currentToolName);
    const workspaceInstallDir = agentLocation?.workspaceInstallDir || 'skills';

    return path.join(workspaceFolder.uri.fsPath, workspaceInstallDir);
  }

  private async readLocalSkillMarkdown(rootPath: string): Promise<string | undefined> {
    const candidates = ['SKILL.md', 'skill.md'];
    for (const candidate of candidates) {
      const filePath = path.join(rootPath, candidate);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return fs.promises.readFile(filePath, 'utf8');
      }
    }

    return undefined;
  }

  private async listLocalDirectory(rootPath: string, relativePath: string): Promise<LocalDirectoryResult> {
    const safeRelativePath = this.normalizeRelativePath(relativePath);
    const absolutePath = this.resolveLocalPath(rootPath, safeRelativePath);
    const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });

    const mappedEntries: LocalRepoEntry[] = await Promise.all(entries.map(async (entry) => {
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

      let size: number | undefined;
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

  private async getLocalFilePreview(rootPath: string, relativePath: string): Promise<LocalFilePreview> {
    const safeRelativePath = this.normalizeRelativePath(relativePath);
    const absolutePath = this.resolveLocalPath(rootPath, safeRelativePath);
    const fileStat = await fs.promises.stat(absolutePath);

    if (!fileStat.isFile()) {
      throw new Error('Selected path is not a file.');
    }

    if (fileStat.size > SkillDetailPanel.MAX_LOCAL_PREVIEW_BYTES) {
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

  private normalizeRelativePath(value: string): string {
    return value
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  private resolveLocalPath(rootPath: string, relativePath: string): string {
    const normalizedRoot = path.resolve(rootPath);
    const resolvedPath = path.resolve(normalizedRoot, relativePath || '.');
    const rootPrefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;

    if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(rootPrefix)) {
      throw new Error('Path is outside of the installed skill folder.');
    }

    return resolvedPath;
  }

  private looksBinary(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, 512);
    for (const byte of sample) {
      if (byte === 0) {
        return true;
      }
    }

    return false;
  }

  private getLanguageHint(filePath: string): string {
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

  private postMessage(message: any) {
    this.panel.webview.postMessage(message);
  }

  private getHtmlContent(detailPayload: SkillDetailPayload, isInstalled: boolean): string {
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skilldetailpanel.css')
    );
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'extension', 'skilldetailpanel.js')
    );
    const nonce = this.getNonce();
    const installedSkill = getStorageService().getInstalledSkill(this.currentToolName, detailPayload.skill.id);
    const initialState = JSON.stringify({
      detail: detailPayload,
      isInstalled,
      installedLocalPath: installedSkill?.localPath || '',
      currentToolDisplayName: this.currentToolDisplayName
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill: ${this.escapeHtml(detailPayload.skill.name)}</title>
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
    <div id="monacoEditor" style="display: none; width: 100%; height: 600px;"></div>
  </div>
  <script nonce="${nonce}">window.__SKILL_DETAIL_INITIAL_STATE__ = ${initialState};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let index = 0; index < 32; index += 1) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
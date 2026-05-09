import * as vscode from 'vscode';
import { logToOutput } from '../common/UI';
import { gitHubContentService, skillsApiService, toolInstallService } from '../services';
import { getStorageService } from '../services/SkillsStorageService';
import { GitHubRepoContext, Skill, SkillDetailPayload } from '../services/types';

export class SkillDetailPanel {
  public static currentPanel: SkillDetailPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly currentToolName: string;
  private readonly currentToolDisplayName: string;
  private disposables: vscode.Disposable[] = [];
  private skill: Skill;

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
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media', 'skill-detail')]
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
      case 'install':
        await this.handleInstall(message.skillId, message.skillName, message.githubUrl);
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

  private async handleInstall(skillId: string, skillName: string, githubUrl: string) {
    try {
      const installPath = await toolInstallService.installSkill(this.currentToolName, skillId, skillName, githubUrl);
      await getStorageService().addInstalled(this.currentToolName, skillId, skillName, 'unknown', '1.0.0', installPath);
      this.postMessage({
        type: 'installResult',
        skillId,
        toolName: this.currentToolName,
        toolDisplayName: this.currentToolDisplayName,
        success: true,
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

  private async createSkillDetailPayload(skill: Skill): Promise<SkillDetailPayload> {
    const detailSkill = await skillsApiService.fetchDetail(skill.id) ?? skill;
    const repoContext = gitHubContentService.parseGitHubUrl(detailSkill.githubUrl);
    const repoMetadata = await gitHubContentService.getRepoMetadata(repoContext);
    const resolvedContext: GitHubRepoContext = {
      ...repoContext,
      branch: repoContext.branch === 'HEAD' ? repoMetadata.defaultBranch : repoContext.branch
    };
    const rootDirectory = await gitHubContentService.listDirectory(resolvedContext, '');

    return {
      skill: detailSkill,
      repoContext: resolvedContext,
      repoMetadata,
      rootDirectory
    };
  }

  private postMessage(message: any) {
    this.panel.webview.postMessage(message);
  }

  private getHtmlContent(detailPayload: SkillDetailPayload, isInstalled: boolean): string {
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'skill-detail', 'skill-detail.css')
    );
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'skill-detail', 'skill-detail.js')
    );
    const nonce = this.getNonce();
    const initialState = JSON.stringify({
      detail: detailPayload,
      isInstalled
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill: ${this.escapeHtml(detailPayload.skill.name)}</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app" class="detail-root">
    <div id="loadingIndicator" class="loading hidden"><span class="spinner"></span> Loading...</div>
    <div id="errorMessage" class="error-message hidden"></div>
    <div id="detailContainer"></div>
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
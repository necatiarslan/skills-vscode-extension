import * as vscode from 'vscode';
import * as ui from './common/UI';
import { Session } from './common/Session';
import { initializeStorageService } from './services/SkillsStorageService';
import { SkillsPanel } from './webview/SkillsPanel';

/**
 * Activates the AI Skills extension.
 * This is the entry point for the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
    ui.logToOutput('Activating AI Skills...');

    try {
        const session = new Session(context); // Initialize session management
        
        // Initialize marketplace services
        initializeStorageService(context.globalState);
        
        // Register the AI Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsPanel(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SkillsPanel.viewType,
                skillsViewProvider,
                { webviewOptions: { retainContextWhenHidden: true } }
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.Refresh', () => {
                SkillsPanel.Current?.refreshInstalledSkills();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.Donate', () => {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.BugAndNewFeatureRequest', () => {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/skills-vscode-extension/issues'));
            })
        );

        ui.logToOutput('AI Skills activated successfully.');
    } catch (error) {
        ui.logToOutput('Fatal error activating AI Skills:', error as Error);
        ui.showInfoMessage('AI Skills failed to activate. Check debug console for details.');
    }
}



export function deactivate(): void {
    // Nothing to clean up for webview views
}

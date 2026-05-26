import * as vscode from 'vscode';
import * as ui from './common/UI';
import { Session } from './common/Session';
import { initializeStorageService } from './services/SkillsStorageService';
import { SkillsPanel } from './webview/SkillsPanel';

/**
 * Activates the AI Agent Skills extension.
 * This is the entry point for the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
    ui.logToOutput('Activating AI Agent Skills...');

    try {
        const session = new Session(context); // Initialize session management
        ui.logToOutput('[Activation] Session initialized');
        
        // Initialize marketplace services
        initializeStorageService(context.globalState);
        ui.logToOutput('[Activation] Storage initialized');
        
        // Register the AI Agent Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsPanel(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SkillsPanel.viewType,
                skillsViewProvider,
                { webviewOptions: { retainContextWhenHidden: true } }
            )
        );
        ui.logToOutput('[Activation] Skills webview provider registered');

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.Refresh', () => {
                SkillsPanel.Current?.refreshInstalledSkills();
            })
        );
        ui.logToOutput('[Activation] Command registered: Skills.Refresh');

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.Donate', () => {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
            })
        );
        ui.logToOutput('[Activation] Command registered: Skills.Donate');

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.CheckForUpdates', async () => {
                await SkillsPanel.Current?.checkForUpdatesForManagedSkills();
            })
        );
        ui.logToOutput('[Activation] Command registered: Skills.CheckForUpdates');

        context.subscriptions.push(
            vscode.commands.registerCommand('Skills.BugAndNewFeatureRequest', () => {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/skills-vscode-extension/issues'));
            })
        );
        ui.logToOutput('[Activation] Command registered: Skills.BugAndNewFeatureRequest');

        ui.logToOutput('AI Agent Skills activated successfully.');
    } catch (error) {
        ui.logToOutput('Fatal error activating AI Agent Skills:', error as Error);
        ui.showInfoMessage('AI Agent Skills failed to activate. Check debug console for details.');
    }
}



export function deactivate(): void {
    ui.logToOutput('AI Agent Skills deactivated.');
}

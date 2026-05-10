import * as vscode from 'vscode';
import * as ui from './common/UI';
import { Session } from './common/Session';
import { ServiceHub } from './tree/ServiceHub';
import { initializeStorageService } from './services/SkillsStorageService';
import { SkillsViewProvider } from './webview/SkillsViewProvider';

/**
 * Activates the Skills extension.
 * This is the entry point for the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
    ui.logToOutput('Activating Skills...');

    try {
        const session = new Session(context); // Initialize session management
        new ServiceHub(context);    // Initialize service hub
        
        // Initialize marketplace services
        initializeStorageService(context.globalState);
        
        // Register the Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsViewProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SkillsViewProvider.viewType,
                skillsViewProvider,
                { webviewOptions: { retainContextWhenHidden: true } }
            )
        );

        ui.logToOutput('Skills activated successfully.');
    } catch (error) {
        ui.logToOutput('Fatal error activating Skills:', error as Error);
        ui.showInfoMessage('Skills failed to activate. Check debug console for details.');
    }
}



export function deactivate(): void {
    // Nothing to clean up for webview views
}

import * as vscode from 'vscode';
import * as ui from './common/UI';
import { Session } from './common/Session';
import { TreeView } from './tree/TreeView';
import { ServiceHub } from './tree/ServiceHub';
import { TreeState } from './tree/TreeState';


/**
 * Activates the Skills extension.
 * This is the entry point for the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
    ui.logToOutput('Activating Skills...');

    try {
        const session = new Session(context); // Initialize session management
        new ServiceHub(context);    // Initialize service hub
        
		// 1. Initialize the unified Skills tree provider
        new TreeView(context);

        // 2. Load saved tree state after TreeView is initialized
        TreeState.load();
        
        // 3. Refresh tree to display loaded nodes
        TreeView.Current.Refresh();

        ui.logToOutput('Skills activated successfully.');
    } catch (error) {
        ui.logToOutput('Fatal error activating Skills:', error as Error);
        ui.showInfoMessage('Skills failed to activate. Check debug console for details.');
    }
}



export function deactivate(): void {
    // Save tree state immediately before deactivation
    TreeState.saveImmediate();
}

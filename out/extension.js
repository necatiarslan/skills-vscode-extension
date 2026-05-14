"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const ui = require("./common/UI");
const Session_1 = require("./common/Session");
const SkillsStorageService_1 = require("./services/SkillsStorageService");
const SkillsPanel_1 = require("./webview/SkillsPanel");
/**
 * Activates the Skills extension.
 * This is the entry point for the extension.
 */
function activate(context) {
    ui.logToOutput('Activating Skills...');
    try {
        const session = new Session_1.Session(context); // Initialize session management
        // Initialize marketplace services
        (0, SkillsStorageService_1.initializeStorageService)(context.globalState);
        // Register the Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsPanel_1.SkillsPanel(context.extensionUri);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(SkillsPanel_1.SkillsPanel.viewType, skillsViewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
        context.subscriptions.push(vscode.commands.registerCommand('Skills.Refresh', () => {
            SkillsPanel_1.SkillsPanel.Current?.refreshInstalledSkills();
        }));
        ui.logToOutput('Skills activated successfully.');
    }
    catch (error) {
        ui.logToOutput('Fatal error activating Skills:', error);
        ui.showInfoMessage('Skills failed to activate. Check debug console for details.');
    }
}
function deactivate() {
    // Nothing to clean up for webview views
}
//# sourceMappingURL=extension.js.map
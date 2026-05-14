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
 * Activates the AI Skills extension.
 * This is the entry point for the extension.
 */
function activate(context) {
    ui.logToOutput('Activating AI Skills...');
    try {
        const session = new Session_1.Session(context); // Initialize session management
        // Initialize marketplace services
        (0, SkillsStorageService_1.initializeStorageService)(context.globalState);
        // Register the AI Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsPanel_1.SkillsPanel(context.extensionUri);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(SkillsPanel_1.SkillsPanel.viewType, skillsViewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
        context.subscriptions.push(vscode.commands.registerCommand('Skills.Refresh', () => {
            SkillsPanel_1.SkillsPanel.Current?.refreshInstalledSkills();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('Skills.Donate', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
        }));
        context.subscriptions.push(vscode.commands.registerCommand('Skills.BugAndNewFeatureRequest', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/skills-vscode-extension/issues'));
        }));
        ui.logToOutput('AI Skills activated successfully.');
    }
    catch (error) {
        ui.logToOutput('Fatal error activating AI Skills:', error);
        ui.showInfoMessage('AI Skills failed to activate. Check debug console for details.');
    }
}
function deactivate() {
    // Nothing to clean up for webview views
}
//# sourceMappingURL=extension.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const ui = require("./common/UI");
const Session_1 = require("./common/Session");
const TreeView_1 = require("./tree/TreeView");
const ServiceHub_1 = require("./tree/ServiceHub");
const TreeState_1 = require("./tree/TreeState");
const SkillsStorageService_1 = require("./services/SkillsStorageService");
const MarketplaceCommands_1 = require("./webview/MarketplaceCommands");
/**
 * Activates the Skills extension.
 * This is the entry point for the extension.
 */
function activate(context) {
    ui.logToOutput('Activating Skills...');
    try {
        const session = new Session_1.Session(context); // Initialize session management
        new ServiceHub_1.ServiceHub(context); // Initialize service hub
        // Initialize marketplace services
        (0, SkillsStorageService_1.initializeStorageService)(context.globalState);
        new MarketplaceCommands_1.MarketplaceCommands(context.extensionUri);
        // 1. Initialize the unified Skills tree provider
        new TreeView_1.TreeView(context);
        // 2. Load saved tree state after TreeView is initialized
        TreeState_1.TreeState.load();
        // 3. Refresh tree to display loaded nodes
        TreeView_1.TreeView.Current.Refresh();
        ui.logToOutput('Skills activated successfully.');
    }
    catch (error) {
        ui.logToOutput('Fatal error activating Skills:', error);
        ui.showInfoMessage('Skills failed to activate. Check debug console for details.');
    }
}
function deactivate() {
    // Save tree state immediately before deactivation
    TreeState_1.TreeState.saveImmediate();
}
//# sourceMappingURL=extension.js.map
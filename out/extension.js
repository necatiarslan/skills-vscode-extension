"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ui = __importStar(require("./common/UI"));
const Session_1 = require("./common/Session");
const SkillsStorageService_1 = require("./services/SkillsStorageService");
const SkillsPanel_1 = require("./webview/SkillsPanel");
const DAILY_UPDATE_CHECK_KEY = 'skills.lastDailyUpdateCheckDate';
/**
 * Activates the AI Agent Skills extension.
 * This is the entry point for the extension.
 */
function activate(context) {
    ui.logToOutput('Activating AI Agent Skills...');
    try {
        const session = new Session_1.Session(context); // Initialize session management
        ui.logToOutput('[Activation] Session initialized');
        // Initialize marketplace services
        (0, SkillsStorageService_1.initializeStorageService)(context.globalState);
        ui.logToOutput('[Activation] Storage initialized');
        // Register the AI Agent Skills Marketplace as a webview view
        const skillsViewProvider = new SkillsPanel_1.SkillsPanel(context.extensionUri);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(SkillsPanel_1.SkillsPanel.viewType, skillsViewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
        ui.logToOutput('[Activation] Skills webview provider registered');
        void runDailyUpdateCheckIfNeeded(context);
        context.subscriptions.push(vscode.commands.registerCommand('Skills.Refresh', () => {
            SkillsPanel_1.SkillsPanel.Current?.refreshInstalledSkills();
        }));
        ui.logToOutput('[Activation] Command registered: Skills.Refresh');
        context.subscriptions.push(vscode.commands.registerCommand('Skills.Donate', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
        }));
        ui.logToOutput('[Activation] Command registered: Skills.Donate');
        context.subscriptions.push(vscode.commands.registerCommand('Skills.CheckForUpdates', async () => {
            await SkillsPanel_1.SkillsPanel.Current?.checkForUpdatesForManagedSkills();
        }));
        ui.logToOutput('[Activation] Command registered: Skills.CheckForUpdates');
        context.subscriptions.push(vscode.commands.registerCommand('Skills.BugAndNewFeatureRequest', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/skills-vscode-extension/issues'));
        }));
        ui.logToOutput('[Activation] Command registered: Skills.BugAndNewFeatureRequest');
        ui.logToOutput('AI Agent Skills activated successfully.');
    }
    catch (error) {
        ui.logToOutput('Fatal error activating AI Agent Skills:', error);
        ui.showInfoMessage('AI Agent Skills failed to activate. Check debug console for details.');
    }
}
async function runDailyUpdateCheckIfNeeded(context) {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const lastCheckDate = context.globalState.get(DAILY_UPDATE_CHECK_KEY, '');
        if (lastCheckDate === today) {
            ui.logToOutput(`[Activation] Daily update check already completed for ${today}`);
            return;
        }
        ui.logToOutput('[Activation] Running daily managed skills update check');
        await SkillsPanel_1.SkillsPanel.Current?.checkForUpdatesForManagedSkills({ silent: true });
        await context.globalState.update(DAILY_UPDATE_CHECK_KEY, today);
        ui.logToOutput(`[Activation] Daily update check completed for ${today}`);
    }
    catch (error) {
        ui.logToOutput('[Activation] Daily update check failed:', error);
    }
}
function deactivate() {
    ui.logToOutput('AI Agent Skills deactivated.');
}
//# sourceMappingURL=extension.js.map
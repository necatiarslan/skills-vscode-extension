"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceCommands = void 0;
const vscode = require("vscode");
const SkillsPanel_1 = require("../webview/SkillsPanel");
const UI_1 = require("../common/UI");
/**
 * MarketplaceCommands - Registers and handles marketplace-related commands
 */
class MarketplaceCommands {
    extensionUri;
    disposables = [];
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.register();
    }
    /**
     * Register all marketplace commands
     */
    register() {
        // Open Marketplace
        this.disposables.push(vscode.commands.registerCommand('Skills.OpenMarketplace', async () => {
            (0, UI_1.logToOutput)('[Commands] Opening Skills Marketplace');
            await SkillsPanel_1.SkillsPanel.createOrShow(this.extensionUri);
        }));
        (0, UI_1.logToOutput)('[Commands] Marketplace commands registered');
    }
    /**
     * Dispose all registered commands
     */
    dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }
}
exports.MarketplaceCommands = MarketplaceCommands;
//# sourceMappingURL=MarketplaceCommands.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const ui = require("./UI");
const vscode = require("vscode");
class Session {
    static Current;
    Context;
    ExtensionUri;
    FilterString = '';
    IsShowOnlyFavorite = false;
    IsShowHiddenNodes = false;
    HostAppName = '';
    constructor(context) {
        Session.Current = this;
        this.Context = context;
        this.ExtensionUri = context.extensionUri;
        this.LoadState();
        this.HostAppName = vscode.env.appName;
    }
    IsHostSupportLanguageTools() {
        const supportedHosts = ['Visual Studio Code', 'Visual Studio Code - Insiders', 'VSCodium'];
        return supportedHosts.includes(this.HostAppName);
    }
    IsDebugMode() {
        return this.Context.extensionMode !== vscode.ExtensionMode.Production;
    }
    async SaveState() {
        ui.logToOutput('Saving state...');
        try {
            this.Context.globalState.update('FilterString', Session.Current?.FilterString);
            this.Context.globalState.update('IsShowOnlyFavorite', Session.Current?.IsShowOnlyFavorite);
            this.Context.globalState.update('IsShowHiddenNodes', Session.Current?.IsShowHiddenNodes);
            ui.logToOutput('State saved');
        }
        catch (error) {
            ui.logToOutput("Session.SaveState Error !!!", error);
        }
    }
    LoadState() {
        ui.logToOutput('Loading state...');
        try {
            const FilterStringTemp = this.Context.globalState.get('FilterString');
            const IsShowOnlyFavoriteTemp = this.Context.globalState.get('IsShowOnlyFavorite');
            const IsShowHiddenNodesTemp = this.Context.globalState.get('IsShowHiddenNodes');
            if (FilterStringTemp) {
                Session.Current.FilterString = FilterStringTemp;
            }
            if (IsShowOnlyFavoriteTemp !== undefined) {
                Session.Current.IsShowOnlyFavorite = IsShowOnlyFavoriteTemp;
            }
            if (IsShowHiddenNodesTemp !== undefined) {
                Session.Current.IsShowHiddenNodes = IsShowHiddenNodesTemp;
            }
            ui.logToOutput('State loaded');
        }
        catch (error) {
            ui.logToOutput("Session.LoadState Error !!!", error);
        }
    }
    dispose() {
    }
}
exports.Session = Session;
//# sourceMappingURL=Session.js.map
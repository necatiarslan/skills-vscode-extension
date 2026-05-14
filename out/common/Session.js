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
exports.Session = void 0;
const ui = __importStar(require("./UI"));
const vscode = __importStar(require("vscode"));
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
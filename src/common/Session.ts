import * as ui from './UI';
import * as vscode from 'vscode';

export interface Folder {
    id: string;
    name: string;
    parentFolderId: string | null;
    createdAt: number;
}

export class Session implements vscode.Disposable {
    public static Current: Session;

    public Context: vscode.ExtensionContext;
    public ExtensionUri: vscode.Uri;
    public FilterString: string = '';
    public IsShowOnlyFavorite: boolean = false;
    public IsShowHiddenNodes: boolean = false;
    public HostAppName: string = '';

    public constructor(context: vscode.ExtensionContext) {
        Session.Current = this;
        this.Context = context;
        this.ExtensionUri = context.extensionUri;
        this.LoadState();
        this.HostAppName = vscode.env.appName;
    }

    public IsHostSupportLanguageTools(): boolean {
        const supportedHosts = ['Visual Studio Code', 'Visual Studio Code - Insiders', 'VSCodium'];
        return supportedHosts.includes(this.HostAppName);
    }

    public IsDebugMode(): boolean {
        return this.Context.extensionMode !== vscode.ExtensionMode.Production;
    }

    public async SaveState() {
        ui.logToOutput('Saving state...');

        try {
            this.Context.globalState.update('FilterString', Session.Current?.FilterString);
            this.Context.globalState.update('IsShowOnlyFavorite', Session.Current?.IsShowOnlyFavorite);
            this.Context.globalState.update('IsShowHiddenNodes', Session.Current?.IsShowHiddenNodes);
            ui.logToOutput('State saved');
        } catch (error: any) {
            ui.logToOutput("Session.SaveState Error !!!", error);
        }
    }

    public LoadState() {
        ui.logToOutput('Loading state...');

        try {
            const FilterStringTemp: string | undefined = this.Context.globalState.get('FilterString');
            const IsShowOnlyFavoriteTemp: boolean | undefined = this.Context.globalState.get('IsShowOnlyFavorite');
            const IsShowHiddenNodesTemp: boolean | undefined = this.Context.globalState.get('IsShowHiddenNodes');
            if (FilterStringTemp) { Session.Current!.FilterString = FilterStringTemp; }
            if (IsShowOnlyFavoriteTemp !== undefined) { Session.Current!.IsShowOnlyFavorite = IsShowOnlyFavoriteTemp; }
            if (IsShowHiddenNodesTemp !== undefined) { Session.Current!.IsShowHiddenNodes = IsShowHiddenNodesTemp; }
            ui.logToOutput('State loaded');
        } catch (error: any) {
            ui.logToOutput("Session.LoadState Error !!!", error);
        }
    }

    public dispose() {
    }
}
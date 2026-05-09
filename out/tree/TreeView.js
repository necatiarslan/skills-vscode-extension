"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeView = void 0;
const vscode = require("vscode");
const NodeBase_1 = require("./NodeBase");
const TreeProvider_1 = require("./TreeProvider");
const Session_1 = require("../common/Session");
const ServiceHub_1 = require("./ServiceHub");
const TreeState_1 = require("./TreeState");
const ui = require("../common/UI");
class TreeView {
    static Current;
    view;
    treeDataProvider;
    context;
    constructor(context) {
        TreeView.Current = this;
        this.context = context;
        this.treeDataProvider = new TreeProvider_1.TreeProvider();
        this.view = vscode.window.createTreeView('SkillsView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
        context.subscriptions.push(this.view);
        this.RegisterCommands();
    }
    RegisterCommands() {
        vscode.commands.registerCommand('Skills.Refresh', () => {
            this.Refresh();
        });
        vscode.commands.registerCommand('Skills.Filter', () => {
            this.Filter();
        });
        vscode.commands.registerCommand('Skills.ShowOnlyFavorite', () => {
            this.ShowOnlyFavorite();
        });
        vscode.commands.registerCommand('Skills.ShowHidden', () => {
            this.ShowHidden();
        });
        vscode.commands.registerCommand('Skills.Hide', (node) => {
            this.Hide(node);
        });
        vscode.commands.registerCommand('Skills.UnHide', (node) => {
            this.UnHide(node);
        });
        vscode.commands.registerCommand('Skills.AddFav', (node) => {
            this.AddFav(node);
        });
        vscode.commands.registerCommand('Skills.RemoveFav', (node) => {
            this.RemoveFav(node);
        });
        vscode.commands.registerCommand('Skills.ShowOnlyInThisWorkspace', (node) => {
            this.ShowOnlyInThisWorkspace(node);
        });
        vscode.commands.registerCommand('Skills.ShowInAnyWorkspace', (node) => {
            this.ShowInAnyWorkspace(node);
        });
        vscode.commands.registerCommand('Skills.NodeAdd', (node) => {
            this.NodeAdd(node);
        });
        vscode.commands.registerCommand('Skills.NodeRemove', (node) => {
            this.NodeRemove(node);
        });
        vscode.commands.registerCommand('Skills.NodeRefresh', (node) => {
            this.NodeRefresh(node);
        });
        vscode.commands.registerCommand('Skills.NodeView', (node) => {
            this.NodeView(node);
        });
        vscode.commands.registerCommand('Skills.NodeEdit', (node) => {
            this.NodeEdit(node);
        });
        vscode.commands.registerCommand('Skills.NodeRun', (node) => {
            this.NodeRun(node);
        });
        vscode.commands.registerCommand('Skills.NodeStop', (node) => {
            this.NodeStop(node);
        });
        vscode.commands.registerCommand('Skills.NodeOpen', (node) => {
            this.NodeOpen(node);
        });
        vscode.commands.registerCommand('Skills.NodeInfo', (node) => {
            this.NodeInfo(node);
        });
        vscode.commands.registerCommand('Skills.NodeCopy', (node) => {
            this.NodeCopy(node);
        });
        vscode.commands.registerCommand('Skills.NodeAlias', (node) => {
            this.NodeAlias(node);
        });
        vscode.commands.registerCommand('Skills.SetTooltip', (node) => {
            this.SetTooltip(node);
        });
        vscode.commands.registerCommand('Skills.SetColor', (node) => {
            this.SetColor(node);
        });
        vscode.commands.registerCommand('Skills.MoveUp', (node) => {
            this.MoveUp(node);
        });
        vscode.commands.registerCommand('Skills.MoveDown', (node) => {
            this.MoveDown(node);
        });
        vscode.commands.registerCommand('Skills.MoveToFolder', (node) => {
            this.MoveToFolder(node);
        });
        vscode.commands.registerCommand('Skills.BugAndNewFeatureRequest', () => {
            this.BugAndNewFeatureRequest();
        });
        vscode.commands.registerCommand('Skills.Donate', () => {
            this.Donate();
        });
        vscode.commands.registerCommand('Skills.ExportConfig', () => {
            this.ExportConfig();
        });
        vscode.commands.registerCommand('Skills.ImportConfig', () => {
            this.ImportConfig();
        });
        vscode.commands.registerCommand('Skills.Add', (node) => {
            this.Add(undefined);
        });
        vscode.commands.registerCommand('Skills.Remove', (node) => {
            this.Remove(node);
        });
    }
    GetBoolenSign(value) {
        return value ? "✓ " : "✗ ";
    }
    async SetViewMessage() {
        const visibleNodeCount = NodeBase_1.NodeBase.RootNodes.filter(node => node.IsVisible).length;
        if (visibleNodeCount > 0) {
            this.view.message =
                this.GetBoolenSign(Session_1.Session.Current.IsShowOnlyFavorite) + "Fav, "
                    + this.GetBoolenSign(Session_1.Session.Current.IsShowHiddenNodes) + "Hidden, "
                    + (Session_1.Session.Current.FilterString ? `Filter: ${Session_1.Session.Current.FilterString}` : "");
        }
    }
    async Remove(node) {
        if (!node) {
            return;
        }
        node.Remove();
        TreeState_1.TreeState.save();
    }
    async Add(node) {
        const result = [];
        result.push("Folder");
        result.push("Note");
        result.push("File Link");
        result.push("Bash Script");
        result.push("Bash File");
        result.push("VS Code Command");
        result.push("Web Link");
        let nodeType = await vscode.window.showQuickPick(result, { canPickMany: false, placeHolder: 'Select Item Type' });
        if (!nodeType) {
            return;
        }
        switch (nodeType) {
            case "Folder":
                await ServiceHub_1.ServiceHub.Current.FileSystemService.Add(node, "Folder");
                break;
            case "Note":
                await ServiceHub_1.ServiceHub.Current.FileSystemService.Add(node, "Note");
                break;
            case "File Link":
                await ServiceHub_1.ServiceHub.Current.FileSystemService.Add(node, "File Link");
                break;
            case "Bash Script":
                await ServiceHub_1.ServiceHub.Current.FileSystemService.Add(node, "Bash Script");
                break;
            case "Bash File":
                await ServiceHub_1.ServiceHub.Current.FileSystemService.Add(node, "Bash File");
                break;
            case "VS Code Command":
                await ServiceHub_1.ServiceHub.Current.VscodeService.Add(node, "Command");
                break;
            case "Web Link":
                await ServiceHub_1.ServiceHub.Current.WebService.Add(node, "Web Link");
                break;
        }
        TreeState_1.TreeState.save();
    }
    Refresh(node) {
        this.treeDataProvider.Refresh(node);
        this.SetViewMessage();
    }
    async Filter() {
        const filterString = await vscode.window.showInputBox({ placeHolder: 'Enter filter string', value: Session_1.Session.Current.FilterString });
        if (filterString === undefined) {
            return;
        }
        Session_1.Session.Current.FilterString = filterString;
        Session_1.Session.Current.SaveState();
        NodeBase_1.NodeBase.RootNodes.forEach(node => {
            node.SetVisible();
        });
        this.Refresh();
    }
    ShowOnlyFavorite() {
        Session_1.Session.Current.IsShowOnlyFavorite = !Session_1.Session.Current.IsShowOnlyFavorite;
        Session_1.Session.Current.SaveState();
        NodeBase_1.NodeBase.RootNodes.forEach(node => {
            node.SetVisible();
        });
        this.Refresh();
    }
    ShowHidden() {
        Session_1.Session.Current.IsShowHiddenNodes = !Session_1.Session.Current.IsShowHiddenNodes;
        Session_1.Session.Current.SaveState();
        NodeBase_1.NodeBase.RootNodes.forEach(node => {
            node.SetVisible();
        });
        this.Refresh();
    }
    Hide(node) {
        node.IsHidden = true;
        node.SetVisible();
        this.Refresh(node);
        TreeState_1.TreeState.save();
    }
    UnHide(node) {
        node.IsHidden = false;
        node.SetVisible();
        this.Refresh(node);
        TreeState_1.TreeState.save();
    }
    AddFav(node) {
        node.IsFavorite = true;
        node.SetVisible();
        this.Refresh(node);
        TreeState_1.TreeState.save();
    }
    RemoveFav(node) {
        node.IsFavorite = false;
        node.SetVisible();
        this.Refresh(node);
        TreeState_1.TreeState.save();
    }
    ShowOnlyInThisWorkspace(node) {
        if (!vscode.workspace.name) {
            ui.showInfoMessage("Please open a workspace first.");
            return;
        }
        node.Workspace = vscode.workspace.name;
        node.SetContextValue();
        this.treeDataProvider.Refresh(node);
        TreeState_1.TreeState.save();
    }
    ShowInAnyWorkspace(node) {
        node.Workspace = "";
        node.SetContextValue();
        this.treeDataProvider.Refresh(node);
        TreeState_1.TreeState.save();
    }
    NodeAdd(node) {
        node.NodeAdd();
    }
    NodeRemove(node) {
        node.NodeRemove();
    }
    NodeRefresh(node) {
        node.NodeRefresh();
    }
    NodeView(node) {
        node.NodeView();
    }
    NodeEdit(node) {
        node.NodeEdit();
    }
    NodeRun(node) {
        node.NodeRun();
    }
    NodeStop(node) {
        node.NodeStop();
    }
    NodeOpen(node) {
        node.NodeOpen();
    }
    NodeInfo(node) {
        node.NodeInfo();
    }
    NodeCopy(node) {
        node.NodeCopy();
    }
    NodeAlias(node) {
        node.NodeAlias();
    }
    SetTooltip(node) {
        node.SetCustomTooltip();
    }
    SetColor(node) {
        node.SetIconColor();
    }
    MoveUp(node) {
        node.MoveUp();
    }
    MoveDown(node) {
        node.MoveDown();
    }
    async MoveToFolder(node) {
        // Collect all FolderNode instances recursively
        const folders = [];
        const collectFolders = (nodes, path = "") => {
            for (const n of nodes) {
                if (n.constructor.name === 'FolderNode') {
                    const fullPath = path ? `${path}/${n.label}` : n.label;
                    folders.push({ label: fullPath, node: n });
                }
                if (n.Children.length > 0) {
                    const newPath = n.constructor.name === 'FolderNode'
                        ? (path ? `${path}/${n.label}` : n.label)
                        : path;
                    collectFolders(n.Children, newPath);
                }
            }
        };
        collectFolders(NodeBase_1.NodeBase.RootNodes);
        if (folders.length === 0) {
            vscode.window.showInformationMessage('No folders available. Create a folder first.');
            return;
        }
        const selected = await vscode.window.showQuickPick(folders.map(f => f.label), { placeHolder: 'Select destination folder' });
        if (!selected) {
            return;
        }
        const targetFolder = folders.find(f => f.label === selected)?.node;
        if (targetFolder && targetFolder !== node && targetFolder !== node.Parent) {
            node.MoveToFolder(targetFolder);
        }
    }
    BugAndNewFeatureRequest() {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/skills-vscode-extension/issues/new'));
    }
    Donate() {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
    }
    async ExportConfig() {
        const filePath = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('skills.json'),
            saveLabel: 'Save',
            filters: { 'JSON': ['json'] },
        });
        if (!filePath) {
            return;
        }
        TreeState_1.TreeState.save(filePath.fsPath);
    }
    async ImportConfig() {
        const filePath = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            canSelectFolders: false,
            defaultUri: vscode.Uri.file('skills.json'),
            filters: { 'JSON': ['json'] },
        });
        if (!filePath) {
            return;
        }
        TreeState_1.TreeState.load(filePath[0].fsPath);
    }
}
exports.TreeView = TreeView;
//# sourceMappingURL=TreeView.js.map
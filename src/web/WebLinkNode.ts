import { NodeBase } from '../tree/NodeBase';
import { Serialize } from '../common/serialization/Serialize';
import { NodeRegistry } from '../common/serialization/NodeRegistry';
import * as vscode from 'vscode';

export class WebLinkNode extends NodeBase {

    @Serialize()
    public Title: string = "";

    @Serialize()
    public Url: string = "";

    constructor(title: string, parent?: NodeBase) {
        super(title, parent);
        this.Icon = "link";
        this.Title = title;

        this.OnNodeRemove.subscribe(() => this.handleNodeRemove());
        this.OnNodeView.subscribe(() => this.handleNodeView());
        this.OnNodeEdit.subscribe(() => this.handleNodeEdit());
        this.OnNodeCopy.subscribe(() => this.handleNodeCopy());

        this.EnableNodeAlias = true;
        this.SetContextValue();
    }

    private handleNodeRemove(): void {
        this.Remove();
        this.TreeSave();
    }

    private handleNodeView(): void {
        vscode.env.openExternal(vscode.Uri.parse(this.Url));
    }

    private async handleNodeEdit(): Promise<void> {
        const url = await vscode.window.showInputBox({ placeHolder: 'Enter URL', value: this.Url, prompt: 'URL' });
        if (url === undefined) { return; }
        this.Url = url;

        const title = await vscode.window.showInputBox({ placeHolder: 'Enter Alias', value: this.Title, prompt: 'Alias' });
        if (title === undefined) { return; }
        this.Title = title;
        this.label = title;
        this.TreeSave();
    }

    private handleNodeCopy(): void {
        vscode.env.clipboard.writeText(this.Url);
    }

}

// Register with NodeRegistry for deserialization
NodeRegistry.register('WebLinkNode', WebLinkNode);

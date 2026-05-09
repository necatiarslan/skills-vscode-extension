import * as vscode from "vscode";
import { ServiceBase } from "../tree/ServiceBase";
import { NodeBase } from "../tree/NodeBase";
import { WebLinkNode } from "./WebLinkNode";

export class WebService extends ServiceBase {

    public static Current: WebService;

    public constructor() {
        super();
        WebService.Current = this;
    }

    public async Add(node?: NodeBase, type?: string): Promise<void> {
        if (type === "Web Link") {
            const url = await vscode.window.showInputBox({ placeHolder: 'Enter URL (e.g. https://example.com)', prompt: 'URL' });
            if (!url) { return; }

            const alias = await vscode.window.showInputBox({ placeHolder: 'Enter Alias', prompt: 'Alias' });
            if (!alias) { return; }

            const webLinkNode = new WebLinkNode(alias, node);
            webLinkNode.Url = url;
            this.TreeSave();
        }
    }

}

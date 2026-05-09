"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebService = void 0;
const vscode = require("vscode");
const ServiceBase_1 = require("../tree/ServiceBase");
const WebLinkNode_1 = require("./WebLinkNode");
class WebService extends ServiceBase_1.ServiceBase {
    static Current;
    constructor() {
        super();
        WebService.Current = this;
    }
    async Add(node, type) {
        if (type === "Web Link") {
            const url = await vscode.window.showInputBox({ placeHolder: 'Enter URL (e.g. https://example.com)', prompt: 'URL' });
            if (!url) {
                return;
            }
            const alias = await vscode.window.showInputBox({ placeHolder: 'Enter Alias', prompt: 'Alias' });
            if (!alias) {
                return;
            }
            const webLinkNode = new WebLinkNode_1.WebLinkNode(alias, node);
            webLinkNode.Url = url;
            this.TreeSave();
        }
    }
}
exports.WebService = WebService;
//# sourceMappingURL=WebService.js.map
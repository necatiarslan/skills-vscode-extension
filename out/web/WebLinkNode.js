"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebLinkNode = void 0;
const NodeBase_1 = require("../tree/NodeBase");
const Serialize_1 = require("../common/serialization/Serialize");
const NodeRegistry_1 = require("../common/serialization/NodeRegistry");
const vscode = require("vscode");
class WebLinkNode extends NodeBase_1.NodeBase {
    Title = "";
    Url = "";
    constructor(title, parent) {
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
    handleNodeRemove() {
        this.Remove();
        this.TreeSave();
    }
    handleNodeView() {
        vscode.env.openExternal(vscode.Uri.parse(this.Url));
    }
    async handleNodeEdit() {
        const url = await vscode.window.showInputBox({ placeHolder: 'Enter URL', value: this.Url, prompt: 'URL' });
        if (url === undefined) {
            return;
        }
        this.Url = url;
        const title = await vscode.window.showInputBox({ placeHolder: 'Enter Alias', value: this.Title, prompt: 'Alias' });
        if (title === undefined) {
            return;
        }
        this.Title = title;
        this.label = title;
        this.TreeSave();
    }
    handleNodeCopy() {
        vscode.env.clipboard.writeText(this.Url);
    }
}
exports.WebLinkNode = WebLinkNode;
__decorate([
    (0, Serialize_1.Serialize)(),
    __metadata("design:type", String)
], WebLinkNode.prototype, "Title", void 0);
__decorate([
    (0, Serialize_1.Serialize)(),
    __metadata("design:type", String)
], WebLinkNode.prototype, "Url", void 0);
// Register with NodeRegistry for deserialization
NodeRegistry_1.NodeRegistry.register('WebLinkNode', WebLinkNode);
//# sourceMappingURL=WebLinkNode.js.map
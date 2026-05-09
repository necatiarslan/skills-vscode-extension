import * as vscode from 'vscode';
import { FileSystemService } from "../filesystem/FileSystemService";
import { VscodeService } from '../vscode/VscodeService';
import { WebService } from '../web/WebService';

export class ServiceHub {
    public static Current: ServiceHub;
    public Context: vscode.ExtensionContext;
    public FileSystemService: FileSystemService = new FileSystemService();
    public VscodeService: VscodeService = new VscodeService();
    public WebService: WebService = new WebService();
    
    public constructor(context: vscode.ExtensionContext) {
        this.Context = context;
        ServiceHub.Current = this;
    }

}
/**
 * Formats a date/time value as a local string, e.g. "May 13, 2026, 14:45:00".
 * Accepts ISO strings, JS Date, or epoch (seconds/milliseconds).
 */
export function formatDateTime(value: string | number | Date | undefined | null): string {
  if (!value) {
    return 'Unknown';
  }
  let date: Date;
  if (typeof value === 'string') {
    // Try ISO string or epoch string
    const asNum = Number(value);
    if (!isNaN(asNum)) {
      // If it's a 10-digit number, assume seconds; convert to ms
      date = new Date(asNum < 10000000000 ? asNum * 1000 : asNum);
    } else {
      date = new Date(value);
    }
  } else if (typeof value === 'number') {
    date = new Date(value < 10000000000 ? value * 1000 : value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    return 'Unknown';
  }
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MethodResult } from './MethodResult';
import path = require('path');

var outputChannel: vscode.OutputChannel;
var logsOutputChannel: vscode.OutputChannel;

var NEW_LINE:string = " | ";

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export function withProgress<T>(task: (progress: vscode.Progress<{ increment: number; message?: string }>) => Promise<T>): Promise<T> {
  return Promise.resolve(vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: false }, task));
}

export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

export function showOutputMessage(message: any, popupMessage: string = "Results are printed to OUTPUT / AI-Skills-Extension", clearPrevMessages:boolean=true): void {

  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("AI-Skills-Extension");
  }

  if(clearPrevMessages)
  {
    outputChannel.clear();
  }

  if (typeof message === "object") {
    outputChannel.appendLine(JSON.stringify(message, null, 4));
  }
  else {
    outputChannel.appendLine(message);
  }
  outputChannel.show();

  if(popupMessage && popupMessage.length > 0)
  {
    showInfoMessage(popupMessage);
  }
}

export function logToOutput(message: any, error?: Error): void {
  let now = new Date().toLocaleString();

  if (!logsOutputChannel) {
    logsOutputChannel = vscode.window.createOutputChannel("AI-Skills-Log");
  }

  if (typeof message === "object") {
    logsOutputChannel.appendLine("[" + now + "] " + JSON.stringify(message, null, 4));
  }
  else {
    logsOutputChannel.appendLine("[" + now + "] " + message);
  }

  if(error instanceof AggregateError)
  {
    error = error.errors[0];
  }

  if (error) {
    logsOutputChannel.appendLine(error.name);
    logsOutputChannel.appendLine(error.message);
    if(error.stack)
    {
      logsOutputChannel.appendLine(error.stack);
    }
  }
}

export function showInfoMessage(message: string): void {
  vscode.window.showInformationMessage(message);
}

export function showWarningMessage(message: string): void {
  vscode.window.showWarningMessage(message);
}

export function showErrorMessage(message: string, error: Error): void {
  if(error instanceof AggregateError)
  {
    error = (error as any).errors[0];
  }

  if (error) {
    vscode.window.showErrorMessage(message + NEW_LINE + error.name + NEW_LINE + error.message);
  }
  else {
    vscode.window.showErrorMessage(message);
  }
}

export function getExtensionVersion() {
  try {
    const { version: extVersion } = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), { encoding: 'utf8' })
    );
    return extVersion;
  } catch (err) {
    return '1.0.0';
  }
}

export function getFileNameWithExtension(filePath: string): string {
  return path.basename(filePath);
} 

export function openFile(filePath: string) {
  vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath), vscode.ViewColumn.One);
}

function padTo2Digits(num: number) {
  return num.toString().padStart(2, '0');
}

export function getMilliSeconds(startDate: Date, endDate: Date):number{
  if(!startDate)
  {
    return 0;
  }

  if(!endDate || endDate < startDate)
  {
    endDate = new Date();//now
  }

  return endDate.valueOf() - startDate.valueOf();
}

export function getSeconds(startDate: Date, endDate: Date): number 
{
  return Math.floor(getMilliSeconds(startDate, endDate) / 1000);
}

export function getDuration(startDate: Date, endDate: Date): string 
{
  if(!startDate)
  {
    return "";
  }

  var duration = getMilliSeconds(startDate, endDate);
  return (convertMsToTime(duration));
}

export function convertMsToTime(milliseconds: number): string 
{
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  seconds = seconds % 60;
  minutes = minutes % 60;

  let result:string;

  if(hours === 0)
  {
    result = `${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
  }
  else
  {
    result = `${padTo2Digits(hours)}:${padTo2Digits(minutes)}`;
  }

  return result;
}

export function isJsonString(jsonString: string): boolean {
  try {
    var json = JSON.parse(jsonString);
    return (typeof json === 'object');
  } catch (e) {
    return false;
  }
}

export function isValidDate(dateString: string): boolean {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regEx)) {
    return false;  // Invalid format
  }
  var d = new Date(dateString);
  var dNum = d.getTime();
  if (!dNum && dNum !== 0) {
    return false; // NaN value, Invalid date
  }
  return d.toISOString().slice(0, 10) === dateString;
}

export function bytesToText(bytes: number | undefined): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === undefined) return '';
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function CopyToClipboard(text:string): MethodResult<boolean>
{
  let result = new MethodResult<boolean>();
  try 
  {
    vscode.env.clipboard.writeText(text);
    result.isSuccessful = true;
  } 
  catch (error:any) 
  {
    result.isSuccessful=false;
    showErrorMessage('CopyToClipboard Error !!!', error);
  }
  return result;
}

export function CopyListToClipboard(textList:string[]): MethodResult<boolean>
{
  let text: string = "";
  for(var t of textList)
  {
    if(t)
    {
      text += t;
      if(textList.length > 1) text += "\n";
    }
  }
  
  return CopyToClipboard(text);
}

export function SanitizeFileName(filename: string): string {
  // Replace invalid characters with underscores
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[\u{80}-\u{9F}]/gu, '_');
}

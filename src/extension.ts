import * as vscode from 'vscode';
import { DartAnalysisServer } from './dartAnalysisServer';

let dartAnalysisServer: DartAnalysisServer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "important-for-flutter" is now active!');

    const disposable = vscode.commands.registerCommand('important-for-flutter.addMissingImports', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const filePath = document.uri.fsPath;
            if (filePath.endsWith('.dart')) {
                dartAnalysisServer?.analyzeFile(filePath);
                vscode.window.showInformationMessage('Analyzing file for missing imports...');
            } else {
                vscode.window.showErrorMessage('This command can only be run on Dart files.');
            }
        }
    });

    context.subscriptions.push(disposable);

    const dartSdkPath = vscode.workspace.getConfiguration('dart').get('sdkPath');
    if (dartSdkPath) {
        dartAnalysisServer = new DartAnalysisServer(dartSdkPath as string);
    }
}

export function deactivate() {
    dartAnalysisServer?.stopServer();
}

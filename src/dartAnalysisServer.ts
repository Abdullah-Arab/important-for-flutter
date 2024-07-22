import * as cp from 'child_process';
import * as vscode from 'vscode';

export class DartAnalysisServer {
    private process: cp.ChildProcess;
    private buffer: string = '';

    constructor(private dartSdkPath: string) {
        this.process = this.startServer();
    }

    private startServer(): cp.ChildProcess {
        const serverArgs = ['analyzer', '--lsp'];
        const process = cp.spawn(this.dartSdkPath, serverArgs);

        process.stdout.on('data', (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        process.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        return process;
    }

    private processBuffer() {
        try {
            const message = JSON.parse(this.buffer);
            if (message.method === 'textDocument/publishDiagnostics') {
                this.handleDiagnostics(message.params);
            }
            this.buffer = '';
        } catch (e) {
            // Continue to buffer until a complete JSON message is received
        }
    }

    private handleDiagnostics(params: any) {
        const diagnostics = params.diagnostics;
        const unresolvedSymbols = diagnostics.filter((d: any) => d.message.includes('unresolved identifier'));
        
        if (unresolvedSymbols.length > 0) {
            vscode.window.showInformationMessage(`Found ${unresolvedSymbols.length} unresolved symbols.`);
            this.suggestImports(unresolvedSymbols);
        }
    }
    private suggestImports(unresolvedSymbols: any[]) {
        const importSuggestions = new Map<string, string>([
            // Add more mappings as needed
            ['Text', 'package:flutter/material.dart'],
            ['State', 'package:flutter/widgets.dart']
        ]);
    
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
    
        const suggestions = Array.from(importSuggestions.entries())
            .filter(([symbol]) => unresolvedSymbols.some((d: any) => d.message.includes(symbol)))
            .map(([, importPath]) => importPath);
    
        if (suggestions.length > 0) {
            vscode.window.showQuickPick(suggestions, { placeHolder: 'Select import to add' })
                .then(selectedImport => {
                    if (selectedImport) {
                        const edit = new vscode.WorkspaceEdit();
                        edit.insert(editor.document.uri, new vscode.Position(0, 0), `import '${selectedImport}';\n`);
                        vscode.workspace.applyEdit(edit);
                    }
                });
        } else {
            vscode.window.showInformationMessage('No missing imports found.');
        }
    }
    
    

    public analyzeFile(filePath: string) {
        const request = {
            method: 'textDocument/didOpen',
            params: {
                textDocument: {
                    uri: `file://${filePath}`,
                    languageId: 'dart',
                    version: 1,
                    text: ''
                }
            }
        };
        this.process.stdin!.write(JSON.stringify(request) + '\n');
    }

    public stopServer() {
        this.process.kill();
    }
}

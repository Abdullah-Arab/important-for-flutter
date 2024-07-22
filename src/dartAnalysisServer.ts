import * as cp from 'child_process';
import * as vscode from 'vscode';

// Defines a class to manage the Dart Analysis Server process
export class DartAnalysisServer {
    private process: cp.ChildProcess; // Holds the child process for the Dart Analysis Server
    private buffer: string = ''; // Buffer to accumulate data from the server

    // Constructor initializes the Dart Analysis Server with the path to the Dart SDK
    constructor(private dartSdkPath: string) {
        this.process = this.startServer(); // Start the server on instantiation
    }

    // Starts the Dart Analysis Server process
    private startServer(): cp.ChildProcess {
        const serverArgs = ['--lsp']; // Arguments to start the server in LSP mode
        const process = cp.spawn(this.dartSdkPath, serverArgs); // Spawn the server process
        // Handle data received from stdout
        
        process.stdout.on('data', (data) => {
            this.buffer += data.toString(); // Append data to buffer
            this.processBuffer(); // Process the accumulated buffer
        });

        // Handle data received from stderr
        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`); // Log errors to console
        });

        // Handle server process exit
        process.on('close', (code) => {
            console.log(`child process exited with code ${code}`); // Log exit code
        });

        return process; // Return the spawned process
    }

    // Processes the accumulated buffer for complete JSON messages
    private processBuffer() {
        try {
            const messages = this.buffer.split('\n'); // Split buffer into messages based on newlines
            messages.forEach((messageString) => {
                if (messageString.trim()) { // Ignore empty messages
                    const message = JSON.parse(messageString); // Parse JSON message
                    // Handle diagnostics messages
                    if (message.method === 'textDocument/publishDiagnostics') {
                        this.handleDiagnostics(message.params); // Process diagnostics
                    }
                }
            });
            this.buffer = ''; // Clear buffer after processing
        } catch (e) {
            // Continue to buffer until a complete JSON message is received
        }
    }

    // Handles diagnostics messages from the Dart Analysis Server
    private handleDiagnostics(params: any) {
        const diagnostics = params.diagnostics; // Extract diagnostics from params
        // Filter for diagnostics about unresolved symbols
        const unresolvedSymbols = diagnostics.filter((d: any) => d.message.includes('is not defined'));

        // If unresolved symbols are found, show a message and suggest imports
        if (unresolvedSymbols.length > 0) {
            vscode.window.showInformationMessage(`Found ${unresolvedSymbols.length} unresolved symbols.`);
            this.suggestImports(unresolvedSymbols); // Suggest imports for unresolved symbols
        }
    }

    // Suggests imports for unresolved symbols
    private suggestImports(unresolvedSymbols: any[]) {
        // Map of common symbols to their import paths
        const importSuggestions = new Map<string, string>([
            ['Text', 'package:flutter/material.dart'],
            ['State', 'package:flutter/widgets.dart']
        ]);

        const editor = vscode.window.activeTextEditor; // Get the active text editor
        if (!editor) return; // If no editor is active, return

        // Filter suggestions based on unresolved symbols
        const suggestions = Array.from(importSuggestions.entries())
             .filter(([symbol]) => unresolvedSymbols.some((d: any) => d.message.includes(symbol)))
            .map(([, importPath]) => importPath);

        // Show quick pick if there are suggestions
        if (suggestions.length > 0) {
            vscode.window.showQuickPick(suggestions, { placeHolder: 'Select import to add' })
                .then(selectedImport => {
                    if (selectedImport) {
                        // Insert selected import at the top of the file
                        const edit = new vscode.WorkspaceEdit();
                        edit.insert(editor.document.uri, new vscode.Position(0, 0), `import '${selectedImport}';\n`);
                        vscode.workspace.applyEdit(edit); // Apply the edit
                    }
                });
        } else {
            vscode.window.showInformationMessage('No missing imports found.'); // Inform if no suggestions
        }
    }

    // Sends a request to analyze a specific file
    public analyzeFile(filePath: string) {
        const request = {
            method: 'textDocument/didOpen',
            params: {
                textDocument: {
                    uri: `file://${filePath}`, // File URI
                    languageId: 'dart', // Language ID for Dart
                    version: 1, // Version number
                    text: '' // File content (empty here)
                }
            }
        };
        this.process.stdin!.write(JSON.stringify(request) + '\n'); // Send request to server
    }

    // Stops the Dart Analysis Server process
    public stopServer() {
        this.process.kill(); // Kill the server process
    }
}
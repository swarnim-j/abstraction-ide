import * as vscode from 'vscode';
import { AbstractionManager } from './managers/abstractionManager';
import { CodeViewProvider } from './customEditor';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Abstraction IDE extension is now active!');

    // Initialize the abstraction manager
    const abstractionManager = new AbstractionManager(context);
    context.subscriptions.push(abstractionManager);

    // Register the custom editor provider
    const provider = new CodeViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'abstraction-ide.codeView',
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: true
            }
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('abstraction-ide.openWith', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            await vscode.commands.executeCommand(
                'vscode.openWith',
                editor.document.uri,
                'abstraction-ide.codeView'
            );
        }),

        vscode.commands.registerCommand('abstraction-ide.toggleAbstraction', () => {
            provider.toggleAbstractionLevel();
        }),

        vscode.commands.registerCommand('abstraction-ide.splitView', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            // Create a new view column to the right
            await vscode.commands.executeCommand(
                'vscode.openWith',
                editor.document.uri,
                'abstraction-ide.codeView',
                vscode.ViewColumn.Beside
            );
        })
    );
}

export function deactivate() {
    console.log('Abstraction IDE extension is now deactivated');
} 
import * as vscode from 'vscode';
import { AbstractionViewProvider } from './providers/abstractionViewProvider';
import { AbstractionManager } from './managers/abstractionManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Abstraction IDE extension is now active!');

    // Initialize the abstraction manager
    const abstractionManager = new AbstractionManager(context);

    // Register the abstraction view provider
    const provider = AbstractionViewProvider.register(context, abstractionManager);

    // Register the abstraction scheme for editing
    const memFs = new MemFS();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('abstraction', memFs, { 
        isCaseSensitive: true 
    }));

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('abstraction-ide.increaseAbstraction', async () => {
            await abstractionManager.changeAbstractionLevel(1);
        }),
        vscode.commands.registerCommand('abstraction-ide.decreaseAbstraction', async () => {
            await abstractionManager.changeAbstractionLevel(-1);
        })
    );

    // Add to subscriptions for cleanup
    context.subscriptions.push(abstractionManager);
    context.subscriptions.push(provider);
}

// Simple in-memory file system provider
class MemFS implements vscode.FileSystemProvider {
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile = this._emitter.event;
    private _files = new Map<string, Uint8Array>();

    watch(_uri: vscode.Uri): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(_uri: vscode.Uri): vscode.FileStat {
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: this._files.get(_uri.toString())?.length || 0
        };
    }

    readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
        return [];
    }

    createDirectory(_uri: vscode.Uri): void {}

    readFile(uri: vscode.Uri): Uint8Array {
        const data = this._files.get(uri.toString());
        if (!data) {
            // Return empty content - the content provider will handle the actual content
            return new TextEncoder().encode('');
        }
        return data;
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, _options: { create: boolean, overwrite: boolean }): void {
        this._files.set(uri.toString(), content);
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    delete(uri: vscode.Uri): void {
        this._files.delete(uri.toString());
    }

    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri): void {
        const data = this._files.get(_oldUri.toString());
        if (data) {
            this._files.set(_newUri.toString(), data);
            this._files.delete(_oldUri.toString());
        }
    }
}

export function deactivate() {} 
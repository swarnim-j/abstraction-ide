import * as vscode from 'vscode';
import { AbstractionViewProvider } from './providers/abstractionViewProvider';
import { AbstractionManager } from './managers/abstractionManager';
import { codeMapManager } from './state/codeMap';

export function activate(context: vscode.ExtensionContext) {
    console.log('Abstraction IDE extension is now active!');

    // Initialize the abstraction manager
    const abstractionManager = new AbstractionManager(context);

    // Register the abstraction view provider
    const provider = AbstractionViewProvider.register(context, abstractionManager);

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

    // Register the abstraction scheme
    const emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    
    const virtualFs = {
        onDidChangeFile: emitter.event,
        watch: () => ({ dispose: () => {} }),
        stat: () => ({
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        }),
        readDirectory: () => [],
        createDirectory: () => {},
        readFile: async (uri: vscode.Uri) => {
            console.log('Virtual FS: Reading file:', uri.toString());
            const content = await provider.provideTextDocumentContent(uri);
            return Buffer.from(content);
        },
        writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
            console.log('Virtual FS: Writing file:', uri.toString());
            const fileUri = uri.with({ scheme: 'file' });
            const newContent = content.toString();
            
            // Atomic cache update
            const cached = codeMapManager.get(fileUri.toString());
            if (cached) {
                codeMapManager.set(fileUri.toString(), {
                    ...cached,
                    pseudocode: newContent,
                    lastEditTime: Date.now(),
                    version: cached.version + 1
                });
                provider.update();
                emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
            } else {
                console.log('No cache found for:', fileUri.toString());
            }
        },
        delete: () => {},
        rename: () => {}
    };

    // Register the virtual file system
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider('abstraction', virtualFs, { 
            isCaseSensitive: true,
            isReadonly: false
        })
    );
}

export function deactivate() {
    // Clean up resources
} 
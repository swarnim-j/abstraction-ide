import * as vscode from 'vscode';
import { AbstractionManager } from '../managers/abstractionManager';
import { codeMapManager } from '../state/codeMap';

export class AbstractionViewProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;
    private generatingContent = new Map<string, boolean>();
    private contentBuffer = new Map<string, string>();
    private chunkCount = new Map<string, number>();
    private generationLocks = new Map<string, Promise<void>>();
    
    constructor(private abstractionManager: AbstractionManager) {
        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(async e => {
            if (e.document.uri.scheme === 'abstraction') {
                await this.handleDocumentChange(e.document);
            }
        });
    }

    static register(context: vscode.ExtensionContext, abstractionManager: AbstractionManager): AbstractionViewProvider {
        const provider = new AbstractionViewProvider(abstractionManager);
        const registration = vscode.workspace.registerTextDocumentContentProvider('abstraction', provider);
        context.subscriptions.push(registration);
        return provider;
    }

    private async withLock<T>(fileUri: string, operation: () => Promise<T>): Promise<T> {
        // Wait for any existing lock to complete
        await this.generationLocks.get(fileUri);

        // Create new lock
        let resolveLock: () => void;
        const lockPromise = new Promise<void>(resolve => {
            resolveLock = resolve;
        });
        this.generationLocks.set(fileUri, lockPromise);

        try {
            return await operation();
        } finally {
            resolveLock!();
            this.generationLocks.delete(fileUri);
        }
    }

    private async handleDocumentChange(document: vscode.TextDocument): Promise<void> {
        const fileUri = document.uri.with({ scheme: 'file' });
        
        // Skip if we're currently generating content
        if (this.generatingContent.get(document.uri.toString())) {
            return;
        }

        await this.withLock(fileUri.toString(), async () => {
            const content = document.getText();

            // Update cache
            const cached = codeMapManager.get(fileUri.toString());
            if (cached) {
                codeMapManager.set(fileUri.toString(), {
                    ...cached,
                    pseudocode: content,
                    lastEditTime: Date.now(),
                    version: cached.version + 1
                });
            }

            // Generate corresponding code changes
            try {
                const newCode = await this.abstractionManager.generateCode(content);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    fileUri,
                    new vscode.Range(
                        0,
                        0,
                        (await vscode.workspace.openTextDocument(fileUri)).lineCount,
                        0
                    ),
                    newCode
                );
                await vscode.workspace.applyEdit(edit);
            } catch (error) {
                console.error('Error updating code:', error);
                vscode.window.showErrorMessage(`Error updating code: ${error}`);
            }
        });
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        console.log('Providing content for:', uri.toString());
        const fileUri = uri.with({ scheme: 'file' });

        // Return buffered content if we're still generating
        if (this.generatingContent.get(uri.toString())) {
            const content = this.contentBuffer.get(uri.toString());
            console.log('Returning buffered content:', content?.length);
            return content || 'Generating...';
        }

        try {
            // Check cache first
            const cached = codeMapManager.get(fileUri.toString());
            if (cached?.pseudocode) {
                console.log('Using cached pseudocode');
                return cached.pseudocode;
            }

            return await this.withLock(fileUri.toString(), async () => {
                // Generate new pseudocode
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const content = doc.getText();

                // Mark as generating and reset chunk count
                this.generatingContent.set(uri.toString(), true);
                this.chunkCount.set(uri.toString(), 0);
                this.contentBuffer.set(uri.toString(), 'Generating abstraction...\n');

                // Start generation in background
                this.generateContent(uri, content).catch(error => {
                    console.error('Error in background generation:', error);
                    vscode.window.showErrorMessage(`Error generating abstraction: ${error}`);
                });

                // Return initial content
                return 'Generating abstraction...\n';
            });
        } catch (error) {
            console.error('Error in provideTextDocumentContent:', error);
            this.generatingContent.delete(uri.toString());
            this.contentBuffer.delete(uri.toString());
            this.chunkCount.delete(uri.toString());
            throw error;
        }
    }

    private async generateContent(uri: vscode.Uri, content: string): Promise<void> {
        const fileUri = uri.with({ scheme: 'file' });
        
        await this.withLock(fileUri.toString(), async () => {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Generating abstraction for ${vscode.workspace.asRelativePath(fileUri)}`,
                    cancellable: false
                }, async (progress) => {
                    const pseudocode = await this.abstractionManager.generatePseudocode(content, (partial) => {
                        // Update chunk count and buffer
                        const count = (this.chunkCount.get(uri.toString()) || 0) + 1;
                        this.chunkCount.set(uri.toString(), count);
                        this.contentBuffer.set(uri.toString(), partial);
                        
                        // Update progress
                        progress.report({ 
                            message: `Generated ${count} chunks`,
                            increment: 1 
                        });
                        
                        // Notify content changed
                        this._onDidChange.fire(uri);
                    });

                    // Cache the result and clean up
                    const cached = codeMapManager.get(fileUri.toString());
                    codeMapManager.set(fileUri.toString(), {
                        code: content,
                        pseudocode: pseudocode,
                        lastEditTime: Date.now(),
                        version: (cached?.version || 0) + 1
                    });

                    // Update final content
                    this.contentBuffer.set(uri.toString(), pseudocode);
                    this._onDidChange.fire(uri);

                    // Clean up
                    this.generatingContent.delete(uri.toString());
                    this.chunkCount.delete(uri.toString());
                });
            } catch (error) {
                console.error('Error generating content:', error);
                this.generatingContent.delete(uri.toString());
                this.contentBuffer.delete(uri.toString());
                this.chunkCount.delete(uri.toString());
                throw error;
            }
        });
    }

    update(uri: vscode.Uri): void {
        this._onDidChange.fire(uri);
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
} 
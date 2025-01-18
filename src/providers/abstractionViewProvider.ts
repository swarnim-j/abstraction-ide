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
    private statusBarItem: vscode.StatusBarItem;
    private pendingChanges = new Map<string, string>();
    private initialGenerationInProgress = new Map<string, boolean>();
    
    constructor(private abstractionManager: AbstractionManager) {
        // Remove real-time document change listener
        // Add save handler instead
        vscode.workspace.onWillSaveTextDocument(async e => {
            if (e.document.uri.scheme === 'abstraction') {
                console.log('Saving abstraction document:', e.document.uri.toString());
                // Skip code update if this is the initial generation auto-save
                if (this.initialGenerationInProgress.get(e.document.uri.toString())) {
                    console.log('Skipping code update during initial generation');
                    return;
                }
                e.waitUntil(this.handlePseudocodeSave(e.document));
            }
        });

        // Add status bar item for generation progress
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        
        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.uri.scheme === 'abstraction') {
                console.log('Active editor changed to abstraction view:', editor.document.uri.toString());
                this._onDidChange.fire(editor.document.uri);
            }
        });
    }

    static register(context: vscode.ExtensionContext, abstractionManager: AbstractionManager): AbstractionViewProvider {
        console.log('Registering AbstractionViewProvider');
        const provider = new AbstractionViewProvider(abstractionManager);
        
        // Register the provider for the abstraction scheme
        const registration = vscode.workspace.registerTextDocumentContentProvider('abstraction', provider);
        console.log('Provider registered for scheme: abstraction');
        
        // Register the provider as a disposable
        context.subscriptions.push(registration);
        context.subscriptions.push(provider);
        
        // Register commands that use the provider
        context.subscriptions.push(
            vscode.commands.registerCommand('abstraction-ide.showAbstraction', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const uri = editor.document.uri;
                    const abstractionUri = uri.with({ scheme: 'abstraction' });
                    console.log('Opening abstraction view for:', uri.toString());
                    
                    try {
                        const doc = await vscode.workspace.openTextDocument(abstractionUri);
                        await vscode.window.showTextDocument(doc, {
                            preview: false,
                            viewColumn: vscode.ViewColumn.Active
                        });
                    } catch (error) {
                        console.error('Error opening abstraction view:', error);
                        vscode.window.showErrorMessage(`Error opening abstraction view: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            })
        );
        
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

    private async handlePseudocodeSave(document: vscode.TextDocument): Promise<void> {
        const fileUri = document.uri.with({ scheme: 'file' });
        const content = document.getText();
        
        await this.withLock(fileUri.toString(), async () => {
            try {
                // Validate content before proceeding
                if (!content.trim()) {
                    throw new Error('Cannot save empty pseudocode');
                }

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
                console.log('Generating code from saved pseudocode');
                let newCode: string;
                try {
                    // Get the original pseudocode from the code map
                    const uri = document.uri.toString();
                    const originalMapping = this.abstractionManager.getCodeMapping(uri);
                    if (!originalMapping) {
                        console.error('No original mapping found for URI:', uri);
                        return;
                    }

                    // Generate code from pseudocode changes
                    newCode = await this.abstractionManager.generateCode(content, originalMapping.pseudocode);
                } catch (error: unknown) {
                    console.error('Error in code generation:', error);
                    throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
                }

                if (!newCode?.trim()) {
                    throw new Error('Generated code is empty');
                }

                // Create and validate edit
                const edit = new vscode.WorkspaceEdit();
                const targetDoc = await vscode.workspace.openTextDocument(fileUri);
                
                edit.replace(
                    fileUri,
                    new vscode.Range(
                        0,
                        0,
                        targetDoc.lineCount,
                        0
                    ),
                    newCode
                );

                // Apply edit with error handling
                let success: boolean;
                try {
                    success = await vscode.workspace.applyEdit(edit);
                } catch (error: unknown) {
                    console.error('Error applying edit:', error);
                    throw new Error(`Failed to apply code changes: ${error instanceof Error ? error.message : String(error)}`);
                }

                if (!success) {
                    throw new Error('Failed to apply code changes');
                }

                console.log('Successfully updated code from pseudocode save');
            } catch (error: unknown) {
                console.error('Error in handlePseudocodeSave:', error);
                // Show error to user but don't rethrow to prevent window crash
                vscode.window.showErrorMessage(`Error saving pseudocode: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        console.log('Providing content for:', uri.toString());
        const fileUri = uri.with({ scheme: 'file' });

        try {
            // Check if we're already generating
            if (this.generatingContent.get(uri.toString())) {
                const buffered = this.contentBuffer.get(uri.toString());
                console.log('Already generating, returning buffered content:', buffered?.length);
                return buffered || 'Generating abstraction...';
            }

            // Check cache first
            const cached = codeMapManager.get(fileUri.toString());
            if (cached?.pseudocode) {
                console.log('Using cached pseudocode');
                return cached.pseudocode;
            }

            console.log('No cached content, starting generation');
            
            // Set generating flag and initialize buffer
            this.generatingContent.set(uri.toString(), true);
            this.contentBuffer.set(uri.toString(), 'Generating abstraction...\n');
            
            try {
                // Generate new pseudocode
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const content = doc.getText();
                console.log('Got document content, length:', content.length);

                // Start generation in background and return initial content
                this.generateContent(uri, content).then(() => {
                    console.log('Generation completed successfully');
                }).catch(error => {
                    console.error('Error in background generation:', error);
                    vscode.window.showErrorMessage(`Error generating abstraction: ${error instanceof Error ? error.message : String(error)}`);
                    // Clean up on error
                    this.generatingContent.delete(uri.toString());
                    this.contentBuffer.delete(uri.toString());
                    this.chunkCount.delete(uri.toString());
                });

                // Return initial content and trigger an update
                const initialContent = this.contentBuffer.get(uri.toString()) || 'Generating abstraction...\n';
                console.log('Returning initial content and triggering update');
                // Force an immediate update
                setImmediate(() => this._onDidChange.fire(uri));
                return initialContent;
            } catch (error) {
                console.error('Error setting up generation:', error);
                this.generatingContent.delete(uri.toString());
                this.contentBuffer.delete(uri.toString());
                this.chunkCount.delete(uri.toString());
                throw error;
            }
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
        console.log('Starting content generation for:', fileUri.toString());
        
        // Set initial generation flag
        this.initialGenerationInProgress.set(uri.toString(), true);
        
        try {
            console.log('Starting content generation with progress notification');
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating abstraction for ${vscode.workspace.asRelativePath(fileUri)}`,
                cancellable: false
            }, async (progress) => {
                let totalChars = 0;
                console.log('Calling abstractionManager.generatePseudocode');
                const pseudocode = await this.abstractionManager.generatePseudocode(content, (partial) => {
                    const count = (this.chunkCount.get(uri.toString()) || 0) + 1;
                    this.chunkCount.set(uri.toString(), count);
                    this.contentBuffer.set(uri.toString(), partial);
                    
                    totalChars = partial.length;
                    
                    // Update both progress notification and status bar
                    const progressMsg = `Generated ${count} chunks (${totalChars} characters)`;
                    progress.report({ message: progressMsg });
                    this.statusBarItem.text = `$(sync~spin) ${progressMsg}`;
                    
                    // Force an immediate update
                    setImmediate(() => this._onDidChange.fire(uri));
                });

                console.log('Generation completed, final length:', pseudocode.length);

                // Cache the result
                const cached = codeMapManager.get(fileUri.toString());
                codeMapManager.set(fileUri.toString(), {
                    code: content,
                    pseudocode: pseudocode,
                    lastEditTime: Date.now(),
                    version: (cached?.version || 0) + 1
                });

                // Update final content and notify
                this.contentBuffer.set(uri.toString(), pseudocode);
                
                // Auto-save the generated content
                try {
                    const edit = new vscode.WorkspaceEdit();
                    const doc = await vscode.workspace.openTextDocument(uri);
                    edit.replace(uri, new vscode.Range(0, 0, doc.lineCount, 0), pseudocode);
                    await vscode.workspace.applyEdit(edit);
                    await doc.save();
                    console.log('Auto-saved generated content');
                } catch (error) {
                    console.error('Error auto-saving content:', error);
                }

                // Force an immediate update
                setImmediate(() => this._onDidChange.fire(uri));
                
                // Show completion in status bar
                this.statusBarItem.text = `$(check) Generated ${totalChars} characters`;
                setTimeout(() => this.statusBarItem.hide(), 3000);
            });
        } catch (error) {
            console.error('Error generating content:', error);
            vscode.window.showErrorMessage(`Error generating abstraction: ${error instanceof Error ? error.message : String(error)}`);
            this.statusBarItem.text = "$(error) Generation failed";
            setTimeout(() => this.statusBarItem.hide(), 3000);
            throw error;
        } finally {
            console.log('Cleaning up after generation');
            setImmediate(async () => {
                this.generatingContent.delete(uri.toString());
                this.chunkCount.delete(uri.toString());
                this.initialGenerationInProgress.delete(uri.toString());

                // Process any pending changes
                const pendingContent = this.pendingChanges.get(uri.toString());
                if (pendingContent) {
                    console.log('Processing pending changes after generation');
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await this.handlePseudocodeSave(doc);
                }
            });
        }
    }

    update(): void {
        // Fire change event for all active abstraction documents
        vscode.workspace.textDocuments
            .filter(doc => doc.uri.scheme === 'abstraction')
            .forEach(doc => this._onDidChange.fire(doc.uri));
    }

    dispose(): void {
        this._onDidChange.dispose();
        this.statusBarItem.dispose();
    }
} 
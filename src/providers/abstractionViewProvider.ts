import * as vscode from 'vscode';
import { AbstractionManager } from '../managers/abstractionManager';
import { codeMapManager } from '../state/codeMap';
import { VersionedContent } from '../types';
import { DiffUtils } from '../utils/diffUtils';

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
    private isApplyingChanges = false;
    
    constructor(private abstractionManager: AbstractionManager) {
        vscode.workspace.onWillSaveTextDocument(async e => {
            if (e.document.uri.scheme === 'abstraction') {
                console.log('Saving abstraction document:', e.document.uri.toString());
                if (this.initialGenerationInProgress.get(e.document.uri.toString())) {
                    console.log('Skipping code update during initial generation');
                    return;
                }
                e.waitUntil(this.handlePseudocodeSave(e.document));
            }
        });

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        
        // Only trigger generation when switching to abstraction view for the first time
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (editor && editor.document.uri.scheme === 'abstraction') {
                const uriString = editor.document.uri.toString();
                if (!this.contentBuffer.has(uriString) && !this.generatingContent.get(uriString)) {
                    console.log('First time viewing abstraction, triggering generation:', uriString);
                    this._onDidChange.fire(editor.document.uri);
                    
                    // Ensure the editor is shown in the active column
                    await vscode.window.showTextDocument(editor.document, {
                        preview: false,
                        viewColumn: vscode.ViewColumn.Active
                    });
                }
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
                        await provider.provideTextDocumentContent(abstractionUri);
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
        // Skip if we're already applying changes
        if (this.isApplyingChanges) {
            return;
        }

        const fileUri = document.uri.with({ scheme: 'file' });
        const content = document.getText();
        
        await this.withLock(fileUri.toString(), async () => {
            try {
                this.isApplyingChanges = true;
                
                // Validate content before proceeding
                if (!content.trim()) {
                    throw new Error('Cannot save empty pseudocode');
                }

                // Get the original pseudocode from the code map
                const uri = document.uri.toString();
                const originalMapping = this.abstractionManager.getCodeMapping(uri);
                if (!originalMapping) {
                    throw new Error('No original mapping found');
                }

                // Generate unified diff from pseudocode changes
                const pseudocodeDiff = DiffUtils.generateUnifiedDiff(originalMapping.pseudocode, content);
                
                // Skip if no meaningful changes
                if (!DiffUtils.hasChanges(originalMapping.pseudocode, content)) {
                    return;
                }
                
                // Get code document but don't show it
                const codeDocument = await vscode.workspace.openTextDocument(fileUri);
                
                // Generate and apply code changes
                const llmGeneratedDiff = await this.abstractionManager.generateCode(
                    content, 
                    originalMapping.code, 
                    pseudocodeDiff,
                    codeDocument
                );
                if (!llmGeneratedDiff) {
                    throw new Error('No code changes were generated');
                }

                // Apply the diff to get complete new code
                const newCode = DiffUtils.applyUnifiedDiff(originalMapping.code, llmGeneratedDiff);

                // Apply changes to code document in background
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    fileUri,
                    new vscode.Range(0, 0, codeDocument.lineCount, 0),
                    newCode
                );
                await vscode.workspace.applyEdit(edit);
                await codeDocument.save();

                // Update cache
                const newMapping: VersionedContent = {
                    code: newCode,
                    pseudocode: content,
                    lastEditTime: Date.now(),
                    version: originalMapping.version + 1
                };
                codeMapManager.set(fileUri.toString(), newMapping);

            } catch (error: unknown) {
                console.error('Error in handlePseudocodeSave:', error);
                vscode.window.showErrorMessage(`Error saving pseudocode: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                this.isApplyingChanges = false;
            }
        });
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const fileUri = uri.with({ scheme: 'file' });
        const uriString = uri.toString();

        try {
            // If we're already generating, return current state
            if (this.generatingContent.get(uriString)) {
                return this.contentBuffer.get(uriString) || 'Generating abstraction...';
            }

            // Check cache first
            const cached = codeMapManager.get(fileUri.toString());
            if (cached?.pseudocode) {
                // Store in buffer to prevent regeneration
                this.contentBuffer.set(uriString, cached.pseudocode);
                return cached.pseudocode;
            }
            
            // Prevent concurrent generations
            if (this.generationLocks.has(uriString)) {
                await this.generationLocks.get(uriString);
                return this.contentBuffer.get(uriString) || '';
            }

            // Set up generation lock
            let resolveLock: () => void;
            const lockPromise = new Promise<void>(resolve => {
                resolveLock = resolve;
            });
            this.generationLocks.set(uriString, lockPromise);
            
            // Set generating flag and initialize buffer
            this.generatingContent.set(uriString, true);
            this.contentBuffer.set(uriString, 'Generating abstraction...\n');
            
            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const content = doc.getText();

                // Start generation
                this.generateContent(uri, content).catch(error => {
                    console.error('Error generating content:', error);
                    vscode.window.showErrorMessage(`Error generating abstraction: ${error instanceof Error ? error.message : String(error)}`);
                });
                
                // Return initial content - the streaming updates will happen via onDidChange events
                return this.contentBuffer.get(uriString) || '';
            } finally {
                // Don't clean up flags here - they'll be cleaned up when generation completes
                resolveLock!();
            }
        } catch (error) {
            // Clean up on error
            this.generatingContent.delete(uriString);
            this.contentBuffer.delete(uriString);
            this.chunkCount.delete(uriString);
            this.generationLocks.delete(uriString);
            this.initialGenerationInProgress.delete(uriString);
            throw error;
        }
    }

    private async generateContent(uri: vscode.Uri, content: string): Promise<void> {
        const fileUri = uri.with({ scheme: 'file' });
        const uriString = uri.toString();
        
        this.initialGenerationInProgress.set(uriString, true);
        
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating abstraction for ${vscode.workspace.asRelativePath(fileUri)}`,
                cancellable: false
            }, async (progress) => {
                let totalChars = 0;
                const pseudocode = await this.abstractionManager.generatePseudocode(content, (partial) => {
                    const count = (this.chunkCount.get(uriString) || 0) + 1;
                    this.chunkCount.set(uriString, count);
                    this.contentBuffer.set(uriString, partial);
                    
                    totalChars = partial.length;
                    
                    const progressMsg = `Generated ${count} chunks (${totalChars} characters)`;
                    progress.report({ message: progressMsg });
                    this.statusBarItem.text = `$(sync~spin) ${progressMsg}`;
                    
                    // Show streaming updates
                    this._onDidChange.fire(uri);
                });

                // Update final content
                this.contentBuffer.set(uriString, pseudocode);
                this.statusBarItem.text = `$(check) Generated ${totalChars} characters`;
                setTimeout(() => this.statusBarItem.hide(), 3000);

                // Auto-save the generated content
                const edit = new vscode.WorkspaceEdit();
                const doc = await vscode.workspace.openTextDocument(uri);
                edit.replace(uri, new vscode.Range(0, 0, doc.lineCount, 0), pseudocode);
                await vscode.workspace.applyEdit(edit);
                await doc.save();
            });
        } finally {
            // Clean up flags
            this.initialGenerationInProgress.delete(uriString);
            this.generatingContent.delete(uriString);
            this.chunkCount.delete(uriString);
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
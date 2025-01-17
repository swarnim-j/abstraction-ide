import * as vscode from 'vscode';
import { TOGGLE_COMMAND } from '../constants/commands';
import { FileManager } from './fileManager';
import { AIManager } from './aiManager';
import { TextProcessor } from '../utils/textProcessor';
import { codeMapManager } from '../state/codeMap';
import { CodeChange } from '../types';

export class AbstractionManager {
    private statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    private hasUnsynedChanges: boolean = false;
    private lastModifiedUri: string | undefined;
    private autoSyncInterval: NodeJS.Timeout | undefined;
    private readonly AUTO_SYNC_INTERVAL = 60 * 1000; // 1 minute in milliseconds
    private aiManager: AIManager;

    constructor(context: vscode.ExtensionContext) {
        this.aiManager = new AIManager();
        this.aiManager.initialize();
        this.setupStatusBar(context);
        this.registerEventHandlers(context);
        // Add file exclusion pattern for temp files
        const config = vscode.workspace.getConfiguration('files');
        const exclude = config.get('exclude') as { [key: string]: boolean };
        if (!exclude['**/*.temp']) {
            exclude['**/*.temp'] = true;
            config.update('exclude', exclude, vscode.ConfigurationTarget.Workspace);
        }

        // Initialize auto-sync
        this.startAutoSync();
        // Initial sync of all files
        this.syncAllFiles();
    }

    private async syncAllFiles(): Promise<void> {
        try {
            if (!this.aiManager.isInitialized()) {
                await this.aiManager.initialize();
                if (!this.aiManager.isInitialized()) return;
            }

            // Get all files in workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            for (const folder of workspaceFolders) {
                const pattern = new vscode.RelativePattern(folder, '**/*.{js,ts,py,java,cpp,c,h,hpp,cs,go,rs,swift}');
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

                console.log(`Found ${files.length} files to process in ${folder.name}`);

                // Process files in batches to avoid overwhelming the system
                const batchSize = 5;
                for (let i = 0; i < files.length; i += batchSize) {
                    const batch = files.slice(i, i + batchSize);
                    await Promise.all(batch.map(async file => {
                        try {
                            const document = await vscode.workspace.openTextDocument(file);
                            const content = document.getText();
                            
                            // Skip if already cached and up to date
                            const cached = codeMapManager.get(file.toString());
                            if (cached && cached.code === content) {
                                return;
                            }

                            // Generate pseudocode
                            let newPseudo = '';
                            const pseudocodeUri = FileManager.getPseudocodeUri(file);
                            
                            for await (const chunk of this.aiManager.streamPseudocode(content)) {
                                newPseudo += chunk;
                            }

                            // Clean and save pseudocode
                            newPseudo = TextProcessor.cleanPseudocode(newPseudo);
                            await FileManager.writeFile(pseudocodeUri, newPseudo);

                            // Update cache
                            codeMapManager.set(file.toString(), {
                                code: content,
                                pseudocode: newPseudo,
                                lastEditTime: Date.now(),
                                version: (cached?.version || 0) + 1
                            });

                            console.log(`Generated pseudocode for ${file.fsPath}`);
                        } catch (error) {
                            console.error(`Error processing file ${file.fsPath}:`, error);
                        }
                    }));

                    // Small delay between batches to prevent overwhelming the API
                    if (i + batchSize < files.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        } catch (error) {
            console.error('Error in syncAllFiles:', error);
        }
    }

    private startAutoSync(): void {
        // Clear any existing interval
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        // Start new auto-sync interval
        this.autoSyncInterval = setInterval(() => {
            if (this.hasUnsynedChanges) {
                console.log('Auto-syncing changes...');
                this.syncAbstractions().catch(error => {
                    console.error('Error in auto-sync:', error);
                });
            }
        }, this.AUTO_SYNC_INTERVAL);
    }

    dispose(): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        this.statusBarItem.dispose();
    }

    private setupStatusBar(context: vscode.ExtensionContext): void {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateStatusBar();
        this.statusBarItem.command = TOGGLE_COMMAND;
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
    }

    private updateStatusBar(): void {
        if (this.hasUnsynedChanges) {
            this.statusBarItem.text = "$(warning) Sync Needed";
            this.statusBarItem.tooltip = "Changes detected - click to sync code and pseudocode views";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = "$(sync) Sync Abstractions";
            this.statusBarItem.tooltip = "Sync code and pseudocode views";
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    private registerEventHandlers(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => this.handleDocumentChange(e.document)),
            vscode.commands.registerCommand(TOGGLE_COMMAND, () => this.syncAbstractions())
        );
    }

    async handleDocumentChange(doc: vscode.TextDocument): Promise<void> {
        const isPseudo = FileManager.isPseudocodeFile(doc.uri);
        if (!isPseudo && !doc.uri.fsPath.endsWith('.temp')) {
            // Real code changed
            const pseudoUri = FileManager.getPseudocodeUri(doc.uri);
            try {
                await vscode.workspace.fs.stat(pseudoUri); // Check if pseudo file exists
                // Update cache with new code
                const current = codeMapManager.get(doc.uri.toString());
                const newText = doc.getText();
                if (current?.code !== newText) {  // Only update if actually changed
                    const { hasContentChange } = TextProcessor.extractChanges(current?.code || '', newText);
                    if (hasContentChange) {
                        this.hasUnsynedChanges = true;
                        this.lastModifiedUri = doc.uri.toString();
                        this.updateStatusBar();
                        codeMapManager.set(doc.uri.toString(), {
                            code: newText,
                            pseudocode: current?.pseudocode || '',
                            lastEditTime: Date.now(),
                            version: (current?.version || 0) + 1
                        });
                    }
                }
            } catch {
                // Pseudo file doesn't exist yet, that's fine
            }
        } else if (isPseudo) {
            // Pseudo code changed
            const originalUri = FileManager.getOriginalUri(doc.uri);
            const current = codeMapManager.get(originalUri.toString());
            const newText = doc.getText();
            if (current) {
                const { hasContentChange } = TextProcessor.extractChanges(current.pseudocode, newText);
                if (hasContentChange) {
                    console.log('Updating cache with new pseudocode - content changed');
                    this.hasUnsynedChanges = true;
                    this.lastModifiedUri = doc.uri.toString();
                    this.updateStatusBar();
                    codeMapManager.set(originalUri.toString(), {
                        ...current,
                        pseudocode: newText,
                        lastEditTime: Date.now(),
                        version: current.version + 1
                    });
                }
            }
        }
    }

    private async lockDocument(uri: vscode.Uri): Promise<vscode.TextEditor | undefined> {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        // Create an empty edit to take control of the document
        const edit = new vscode.WorkspaceEdit();
        await vscode.workspace.applyEdit(edit);
        return editor;
    }

    async syncAbstractions(): Promise<void> {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const isPseudo = FileManager.isPseudocodeFile(document.uri);
        const currentContent = document.getText();


        try {
            if (isPseudo) {
                // We're in a pseudo file, sync changes TO code
                const originalUri = FileManager.getOriginalUri(document.uri);
                const cached = codeMapManager.get(originalUri.toString());
                
                if (!cached) {
                    vscode.window.showErrorMessage('No cached content found');
                    return;
                }

                // Check if original file has unsaved changes
                const originalDoc = await vscode.workspace.openTextDocument(originalUri);
                if (originalDoc.isDirty) {
                    vscode.window.showWarningMessage('Original file has unsaved changes. Please save or discard them before syncing.');
                    return;
                }

                // Lock the document during sync
                const lockedEditor = await this.lockDocument(originalUri);
                if (!lockedEditor) {
                    vscode.window.showErrorMessage('Could not lock the document for editing');
                    return;
                }

                try {
                    // Always compare current document content with cached pseudocode
                    const { changes, hasContentChange } = TextProcessor.extractChanges(cached.pseudocode, currentContent);

                    if (hasContentChange || this.hasUnsynedChanges) {
                        // Show progress indicator
                        vscode.window.setStatusBarMessage('Syncing to code...', 2000);
                        
                        // Create temp file in the same directory but hidden from view
                        const tempUri = vscode.Uri.file(originalUri.fsPath + '.temp');
                        
                        let newCode = '';
                        let lastUpdate = Date.now();
                        const updateInterval = 100; // Update every 100ms at most
                        
                        console.log('Starting code generation with:', {
                            pseudocodeLength: currentContent.length,
                            originalCodeLength: cached.code.length,
                            changeCount: changes.length,
                            hasUnsynedChanges: this.hasUnsynedChanges,
                            hasContentChange
                        });

                        // Convert changes to the expected format
                        const formattedChanges = changes.map((change: CodeChange) => ({
                            type: change.type,
                            content: change.content,
                            lineNumber: change.lineNumber
                        }));

                        console.log('Formatted changes:', formattedChanges);

                        let chunkCount = 0;
                        for await (const chunk of this.aiManager.streamToCode(currentContent, cached.code, formattedChanges)) {
                            newCode += chunk;
                            chunkCount++;
                            
                            // Log progress periodically
                            const now = Date.now();
                            if (now - lastUpdate >= updateInterval) {
                                console.log(`Received chunk ${chunkCount}, current length: ${newCode.length}`);
                                const cleanedCode = TextProcessor.cleanCodeResponse(newCode);
                                if (cleanedCode.trim().length > 0) {
                                    await FileManager.writeFile(tempUri, cleanedCode);
                                    lastUpdate = now;
                                } else {
                                    console.log('Cleaned chunk was empty');
                                }
                            }
                        }

                        console.log('Code generation completed:', {
                            totalChunks: chunkCount,
                            rawLength: newCode.length,
                            cleanedLength: TextProcessor.cleanCodeResponse(newCode).length
                        });

                        // Clean the final code
                        newCode = TextProcessor.cleanCodeResponse(newCode);
                        
                        // Safety check - don't proceed if the code is empty
                        if (!newCode.trim()) {
                            console.error('Generated code is empty after cleaning. Raw code length:', newCode.length);
                            vscode.window.showErrorMessage('Failed to generate valid code from pseudocode');
                            return;
                        }

                        // Generate a patch between old and new code
                        const dmp = TextProcessor.getDiffMatchPatch();
                        const patches = dmp.patch_make(cached.code, newCode);
                        
                        console.log('Applying changes:', {
                            oldLength: cached.code.length,
                            newLength: newCode.length,
                            patchCount: patches.length,
                            firstPatch: patches[0],
                            originalContent: originalDoc.getText().length
                        });

                        // Safety check - don't apply patches that would delete everything
                        if (newCode.length < cached.code.length * 0.1) {  // If new code is less than 10% of original
                            console.error('New code is suspiciously short, aborting sync');
                            vscode.window.showErrorMessage('Generated code seems invalid, aborting sync');
                            return;
                        }

                        // Apply the patch to the original file
                        const edit = new vscode.WorkspaceEdit();
                        const [patchedText, results] = dmp.patch_apply(patches, originalDoc.getText());
                        
                        // Another safety check on the patched result
                        if (!patchedText.trim() || patchedText.length < originalDoc.getText().length * 0.1) {
                            console.error('Patched text is suspiciously short, aborting sync');
                            vscode.window.showErrorMessage('Failed to apply changes safely');
                            return;
                        }

                        if (results.every(Boolean)) {
                            // All patches applied successfully
                            const range = new vscode.Range(
                                originalDoc.positionAt(0),
                                originalDoc.positionAt(originalDoc.getText().length)
                            );

                            edit.replace(originalUri, range, patchedText);
                            const success = await vscode.workspace.applyEdit(edit);
                            
                            if (success) {
                                console.log('Edit applied successfully');
                                // Save the file after applying changes
                                const updatedDoc = await vscode.workspace.openTextDocument(originalUri);
                                await updatedDoc.save();
                            } else {
                                console.error('Failed to apply edit');
                                // Don't fall back to full file update anymore - it's too risky
                                vscode.window.showErrorMessage('Failed to apply changes safely');
                                return;
                            }
                        } else {
                            console.log('Some patches failed, aborting for safety');
                            vscode.window.showErrorMessage('Failed to apply changes safely');
                            return;
                        }

                        // Clean up temp file
                        try {
                            await vscode.workspace.fs.delete(tempUri);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        
                        // Update cache
                        codeMapManager.set(originalUri.toString(), {
                            code: newCode,
                            pseudocode: currentContent,
                            lastEditTime: Date.now(),
                            version: cached.version + 1
                        });

                        // Reset unsynced changes flag and update status bar
                        this.hasUnsynedChanges = false;
                        this.updateStatusBar();

                        // Show success message
                        vscode.window.setStatusBarMessage('✓ Code updated from pseudocode', 2000);
                    } else {
                        console.log('No changes detected:', {
                            hasUnsynedChanges: this.hasUnsynedChanges,
                            hasContentChange
                        });
                        vscode.window.setStatusBarMessage('No content changes to sync', 2000);
                    }
                } finally {
                    // Release the lock by applying an empty edit
                    const releaseEdit = new vscode.WorkspaceEdit();
                    await vscode.workspace.applyEdit(releaseEdit);
                }
            } else {
                // We're in a code file, sync changes TO pseudo
                const pseudocodeUri = FileManager.getPseudocodeUri(document.uri);
                const cached = codeMapManager.get(document.uri.toString());
                
                // Check if we already have up-to-date pseudocode
                if (cached && cached.code === currentContent) {
                    // Just show the existing pseudocode
                    const pseudoDoc = await vscode.workspace.openTextDocument(pseudocodeUri);
                    await vscode.window.showTextDocument(pseudoDoc, vscode.ViewColumn.Beside);
                    vscode.window.setStatusBarMessage('✓ Using cached pseudocode', 2000);
                    return;
                }

                // Create pseudo file if it doesn't exist
                try {
                    await vscode.workspace.fs.stat(pseudocodeUri);
                } catch {
                    await FileManager.writeFile(pseudocodeUri, '// Converting to pseudocode...');
                }

                // Show the file immediately
                const pseudoDoc = await vscode.workspace.openTextDocument(pseudocodeUri);
                await vscode.window.showTextDocument(pseudoDoc, vscode.ViewColumn.Beside);

                // Stream the content with real-time updates
                vscode.window.setStatusBarMessage('Syncing to pseudocode...', 2000);
                let newPseudo = '';
                for await (const chunk of this.aiManager.streamPseudocode(currentContent)) {
                    newPseudo += chunk;
                    // Update file in real-time
                    await FileManager.writeFile(pseudocodeUri, TextProcessor.cleanPseudocode(newPseudo));
                }

                // Update cache
                codeMapManager.set(document.uri.toString(), {
                    code: currentContent,
                    pseudocode: newPseudo,
                    lastEditTime: Date.now(),
                    version: (cached?.version || 0) + 1
                });

                vscode.window.setStatusBarMessage('✓ Pseudocode updated', 2000);

                // Reset unsynced changes flag and update status bar after successful sync
                this.hasUnsynedChanges = false;
                this.updateStatusBar();
            }

            // Reset tracking after successful sync
            this.lastModifiedUri = undefined;
            this.hasUnsynedChanges = false;
            this.updateStatusBar();
        } catch (error) {
            console.error('Error in sync abstractions:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            // Reset the flags if we hit an error
            this.lastModifiedUri = undefined;
            this.hasUnsynedChanges = false;
            this.updateStatusBar();
        }
    }

    async changeAbstractionLevel(delta: number): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const isPseudo = FileManager.isPseudocodeFile(document.uri);
        
        // Determine target level based on current state and delta
        const currentLevel = isPseudo ? 1 : 0;
        const targetLevel = currentLevel + delta;

        // Validate target level
        if (targetLevel < 0 || targetLevel > 1) {
            return;
        }

        // If current and target levels are the same, force a refresh
        if (currentLevel === targetLevel) {
            // Reset state to force refresh
            this.hasUnsynedChanges = true;
            this.lastModifiedUri = undefined;
        }

        // Clear any existing state that might interfere
        this.lastModifiedUri = undefined;

        // Trigger sync to switch views
        await this.syncAbstractions();
    }
} 
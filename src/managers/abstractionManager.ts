import * as vscode from 'vscode';
import { AIManager } from './aiManager';
import { TextProcessor } from '../utils/textProcessor';
import { CodeChange } from '../types';
import { DiffCalculator } from '../utils/diffCalculator';

export class AbstractionManager {
    private aiManager: AIManager;
    private currentView: Map<string, 'code' | 'pseudocode'> = new Map();
    private codeMap: Map<string, { code: string; pseudocode: string }> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.aiManager = new AIManager();
        
        // Register status bar item to show initialization status
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBarItem.text = "$(sync~spin) Initializing Abstraction IDE...";
        statusBarItem.show();
        
        // Single initialization with proper error handling
        this.aiManager.initialize().then(() => {
            console.log('AI Manager initialized successfully');
            statusBarItem.text = "$(check) Abstraction IDE Ready";
            setTimeout(() => statusBarItem.hide(), 3000);
        }).catch(error => {
            console.error('Failed to initialize AIManager:', error);
            statusBarItem.text = "$(error) Abstraction IDE Failed";
            vscode.window.showErrorMessage('Failed to initialize AI Manager. Please check your API key.');
            setTimeout(() => statusBarItem.hide(), 3000);
        });
        
        context.subscriptions.push(statusBarItem);
    }

    async ensureInitialized(): Promise<void> {
        if (!this.aiManager.isInitialized()) {
            console.log('AI Manager not initialized, initializing now...');
            await this.aiManager.initialize();
            console.log('AI Manager initialization completed');
        } else {
            console.log('AI Manager already initialized');
        }
    }

    private async withInitialization<T>(operation: () => Promise<T>): Promise<T> {
        console.log('Starting operation with initialization check');
        await this.ensureInitialized();
        console.log('Initialization check completed, proceeding with operation');
        return operation();
    }

    dispose(): void {
        // Clean up resources
    }

    private toAbstractionUri(uri: vscode.Uri): vscode.Uri {
        if (!uri) {
            console.error('Invalid URI provided to toAbstractionUri');
            throw new Error('Invalid URI provided');
        }
        console.log('Converting to abstraction URI:', uri.toString());
        const abstractionUri = uri.with({ scheme: 'abstraction' });
        console.log('Converted to:', abstractionUri.toString());
        return abstractionUri;
    }

    private toFileUri(uri: vscode.Uri): vscode.Uri {
        if (!uri) {
            console.error('Invalid URI provided to toFileUri');
            throw new Error('Invalid URI provided');
        }
        if (uri.scheme !== 'file' && uri.scheme !== 'abstraction') {
            console.error('Invalid URI scheme:', uri.scheme);
            throw new Error(`Invalid URI scheme: ${uri.scheme}`);
        }
        console.log('Converting to file URI:', uri.toString());
        const fileUri = uri.with({ scheme: 'file' });
        console.log('Converted to:', fileUri.toString());
        return fileUri;
    }

    async changeAbstractionLevel(delta: number): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const uri = editor.document.uri;
        const isAbstraction = uri.scheme === 'abstraction';
        const currentView = isAbstraction ? 'pseudocode' : 'code';
        
        // Determine target view based on current view and delta
        const targetView = delta > 0 ? 'pseudocode' : 'code';
        
        // If already in target view, do nothing
        if (currentView === targetView) {
            console.log('Already in target view:', targetView);
            return;
        }

        try {
            if (targetView === 'pseudocode') {
                // Switch to pseudocode view
                const abstractionUri = this.toAbstractionUri(isAbstraction ? this.toFileUri(uri) : uri);
                console.log('Opening pseudocode view:', abstractionUri.toString());
                
                // Create and show the document immediately
                const doc = await vscode.workspace.openTextDocument(abstractionUri);
                await vscode.window.showTextDocument(doc, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });
            } else {
                // Switch back to code view
                const fileUri = this.toFileUri(uri);
                console.log('Opening code view:', fileUri.toString());
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc, { 
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });
            }
        } catch (error) {
            console.error('Error changing abstraction level:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async generatePseudocode(content: string, onProgress: (content: string) => void): Promise<string> {
        return this.withInitialization(async () => {
            console.log('Starting pseudocode generation, content length:', content.length);
            let pseudocode = '';
            let chunks: string[] = [];

            try {
                for await (const chunk of this.aiManager.streamPseudocode(content)) {
                    chunks.push(chunk);
                    pseudocode = chunks.join('');
                    const partialContent = TextProcessor.cleanPseudocode(pseudocode);
                    onProgress(partialContent);
                }

                // Clean and return final pseudocode
                const finalPseudocode = TextProcessor.cleanPseudocode(pseudocode);
                console.log('Generation complete, final length:', finalPseudocode.length);
                
                // Store the original code and pseudocode mapping for both URIs
                const uri = vscode.window.activeTextEditor?.document.uri;
                if (uri) {
                    const mapping = {
                        code: content,
                        pseudocode: finalPseudocode
                    };
                    // Store for both file and abstraction URIs
                    this.codeMap.set(uri.toString(), mapping);
                    this.codeMap.set(this.toAbstractionUri(uri).toString(), mapping);
                }
                
                return finalPseudocode;
            } catch (error) {
                console.error('Error generating pseudocode:', error);
                throw error;
            }
        });
    }

    /**
     * Get the original code from the active editor
     */
    private async getOriginalCode(): Promise<string | undefined> {
        const uri = vscode.window.activeTextEditor?.document.uri;
        if (!uri) {
            console.error('No active editor found');
            return undefined;
        }
        
        const originalMapping = this.codeMap.get(uri.toString());
        if (!originalMapping) {
            console.error('No original code mapping found');
            return undefined;
        }
        
        return originalMapping.code;
    }

    /**
     * Get the code and pseudocode mapping for a given URI
     */
    getCodeMapping(uri: string): { code: string; pseudocode: string } | undefined {
        return this.codeMap.get(uri);
    }

    async generateCode(newPseudocode: string, originalPseudocode: string): Promise<string> {
        console.log('\n=== Starting Code Generation ===');
        console.log('Input:', {
            newPseudocodeLength: newPseudocode.length,
            originalPseudocodeLength: originalPseudocode.length,
            newPseudocodePreview: newPseudocode.slice(0, 100) + '...',
            originalPseudocodePreview: originalPseudocode.slice(0, 100) + '...',
        });

        try {
            // Get the original code mapping
            const originalCode = await this.getOriginalCode();
            if (!originalCode) {
                console.error('No original code mapping found');
                vscode.window.showErrorMessage('Failed to find original code mapping');
                return '';
            }

            // Calculate pseudocode diff for better context to the LLM
            console.log('\n=== Calculating Pseudocode Changes ===');
            const pseudocodeDiff = DiffCalculator.calculateUnifiedDiff(originalPseudocode, newPseudocode);
            
            if (pseudocodeDiff.length === 0) {
                console.log('No changes detected in pseudocode');
                return originalCode;
            }

            // Show status bar update
            const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
            statusBarItem.text = "$(sync~spin) Generating code changes...";
            statusBarItem.show();

            // Generate code changes using the diff
            console.log('\n=== Generating Code Changes ===');
            const prompt = JSON.stringify({
                original_code: originalCode,
                original_pseudocode: originalPseudocode,
                new_pseudocode: newPseudocode,
                changes_detected: pseudocodeDiff
            }, null, 2);
            console.log('Sending prompt to LLM:', prompt);

            // Get complete diff from LLM (no streaming needed for diffs)
            let codeDiff = '';
            for await (const chunk of this.aiManager.streamToCode(
                newPseudocode,
                originalCode,
                pseudocodeDiff.map(change => ({ type: 'modify' as const, content: change }))
            )) {
                codeDiff += chunk;
            }

            console.log('Received code diff from LLM:', {
                length: codeDiff.length,
                content: codeDiff
            });

            if (!codeDiff.trim()) {
                console.error('Failed to generate code changes');
                statusBarItem.text = "$(error) Code generation failed";
                setTimeout(() => statusBarItem.hide(), 3000);
                return originalCode;
            }

            // Apply the changes
            console.log('\n=== Applying Code Changes ===');
            const newCode = DiffCalculator.applyDiff(originalCode, codeDiff);

            if (newCode === originalCode) {
                console.log('Warning: Generated code is identical to original');
                statusBarItem.text = "$(info) No code changes needed";
            } else {
                // Update the mapping
                const uri = vscode.window.activeTextEditor?.document.uri;
                if (uri) {
                    this.codeMap.set(uri.toString(), {
                        code: newCode,
                        pseudocode: newPseudocode
                    });
                    statusBarItem.text = "$(check) Code updated successfully";
                }
            }

            setTimeout(() => statusBarItem.hide(), 3000);
            return newCode;

        } catch (error) {
            console.error('Error generating code:', error);
            const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
            statusBarItem.text = "$(error) Code generation error";
            statusBarItem.show();
            setTimeout(() => statusBarItem.hide(), 3000);
            throw error;
        }
    }
} 
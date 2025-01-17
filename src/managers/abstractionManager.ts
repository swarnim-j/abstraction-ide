import * as vscode from 'vscode';
import { AIManager } from './aiManager';
import { TextProcessor } from '../utils/textProcessor';
import { CodeChange } from '../types';
import { DiffCalculator } from '../utils/diffCalculator';

export class AbstractionManager {
    private aiManager: AIManager;
    private currentView: Map<string, 'code' | 'pseudocode'> = new Map();

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
                    console.log('Generated chunk:', chunk.length, 'Total length:', pseudocode.length);
                    onProgress(partialContent);
                }

                // Clean and return final pseudocode
                const finalPseudocode = TextProcessor.cleanPseudocode(pseudocode);
                console.log('Generation complete, final length:', finalPseudocode.length);
                return finalPseudocode;
            } catch (error) {
                console.error('Error generating pseudocode:', error);
                throw error;
            }
        });
    }

    async generateCode(newPseudocode: string, originalPseudocode?: string): Promise<string> {
        try {
            // Get the original code
            const originalCode = await vscode.workspace.openTextDocument(
                this.toFileUri(vscode.window.activeTextEditor?.document.uri!)
            ).then(doc => doc.getText());

            // If we have original pseudocode, use diff-based generation
            if (originalPseudocode) {
                console.log('Using diff-based code generation');
                
                // Calculate pseudocode changes
                const pseudocodeDiff = DiffCalculator.calculateUnifiedDiff(originalPseudocode, newPseudocode);
                
                // Generate the prompt with full context
                const prompt = JSON.stringify({
                    original_code: originalCode,
                    original_pseudocode: originalPseudocode,
                    pseudocode_diff: pseudocodeDiff.join('\n@@ ... @@\n'),
                    new_pseudocode: newPseudocode
                });

                // Stream the code diff from the AI
                let codeDiff = '';
                for await (const chunk of this.aiManager.streamToCode(
                    prompt,
                    originalCode,
                    pseudocodeDiff,
                    'PSEUDOCODE_TO_CODE_DIFF_PROMPT'
                )) {
                    codeDiff += chunk;
                }

                // Apply the diff to get the new code
                return DiffCalculator.applyUnifiedDiff(originalCode, codeDiff);
            }
            
            // Fallback to full generation for new files
            console.log('No original pseudocode, using full code generation');
            let code = '';
            for await (const chunk of this.aiManager.streamToCode(
                newPseudocode,
                originalCode,
                [],
                'CODE_SYSTEM_PROMPT'
            )) {
                code += chunk;
            }
            return TextProcessor.cleanCodeResponse(code);
        } catch (error) {
            console.error('Error generating code:', error);
            throw error;
        }
    }
} 
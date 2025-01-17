import * as vscode from 'vscode';
import { AIManager } from './aiManager';
import { TextProcessor } from '../utils/textProcessor';
import { CodeChange } from '../types';

export class AbstractionManager {
    private aiManager: AIManager;
    private currentView: Map<string, 'code' | 'pseudocode'> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.aiManager = new AIManager();
        this.aiManager.initialize();
    }

    dispose(): void {
        // Clean up resources
    }

    private toAbstractionUri(uri: vscode.Uri): vscode.Uri {
        return uri.with({ scheme: 'abstraction' });
    }

    private toFileUri(uri: vscode.Uri): vscode.Uri {
        return uri.with({ scheme: 'file' });
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
            return;
        }

        try {
            if (targetView === 'pseudocode') {
                // Switch to pseudocode view
                const abstractionUri = this.toAbstractionUri(isAbstraction ? this.toFileUri(uri) : uri);
                
                // Create and show the document immediately
                const doc = await vscode.workspace.openTextDocument(abstractionUri);
                await vscode.window.showTextDocument(doc, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });
            } else {
                // Switch back to code view
                const fileUri = this.toFileUri(uri);
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
        console.log('Starting pseudocode generation');
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
    }

    async generateCode(pseudocode: string): Promise<string> {
        try {
            let code = '';
            const originalCode = await vscode.workspace.openTextDocument(this.toFileUri(vscode.window.activeTextEditor?.document.uri!)).then(doc => doc.getText());
            const changes: CodeChange[] = [{ type: 'modify', content: pseudocode }];
            for await (const chunk of this.aiManager.streamToCode(pseudocode, originalCode, changes)) {
                code += chunk;
            }
            return TextProcessor.cleanCodeResponse(code);
        } catch (error) {
            console.error('Error generating code:', error);
            throw error;
        }
    }
} 
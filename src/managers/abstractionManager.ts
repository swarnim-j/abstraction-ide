import * as vscode from 'vscode';
import { LLMManager } from './llmManager';
import { TextProcessor } from '../utils/textProcessor';
import { DiffUtils } from '../utils/diffUtils';
import { VersionedContent } from '../types';
import { streamGeneratePseudocode } from '../prompts/functions/generatePseudocode';
import { updatePseudocode } from '../prompts/functions/updatePseudocode';
import { updateCode } from '../prompts/functions/updateCode';
import { EmbeddingUtils } from '../utils/embeddingUtils';

export class AbstractionManager {
    private llmManager: LLMManager;
    private codeMap: Map<string, VersionedContent> = new Map();
    private isInitialized = false;
    private isApplyingChanges = false;  // Add flag to track changes
    private initializationPromise: Promise<void>;
    private highlightedDecorations: vscode.TextEditorDecorationType;

    constructor(context: vscode.ExtensionContext) {
        this.llmManager = new LLMManager();
        
        // Create decoration type for dark text with transition
        this.highlightedDecorations = vscode.window.createTextEditorDecorationType({
            opacity: '0.3',
            isWholeLine: true,
            before: {
                contentText: '',
                textDecoration: `none; transition: opacity 5s ease-in-out;`
            }
        });

        // Register status bar item to show initialization status
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBarItem.text = "$(sync~spin) Initializing Abstraction IDE...";
        statusBarItem.show();
        
        // Single initialization with proper error handling
        this.initializationPromise = this.llmManager.initialize().then(() => {
            this.isInitialized = true;
            statusBarItem.text = "$(check) Abstraction IDE Ready";
            setTimeout(() => statusBarItem.hide(), 3000);
        }).catch(error => {
            statusBarItem.text = "$(error) Abstraction IDE Failed";
            vscode.window.showErrorMessage('Failed to initialize AI Manager. Please check your API key.');
            setTimeout(() => statusBarItem.hide(), 3000);
            throw error;
        });
        
        this.setupSaveHandler(context);
        context.subscriptions.push(statusBarItem);
    }

    private async handleCodeSave(document: vscode.TextDocument): Promise<void> {
        // Skip if we're already applying changes
        if (this.isApplyingChanges) {
            return;
        }

        const uri = document.uri;
        const newCode = document.getText();
        const abstractionUri = this.toAbstractionUri(uri);
        
        try {
            this.isApplyingChanges = true;  // Set flag before applying changes
            
            // Get the original mapping
            const mapping = this.codeMap.get(abstractionUri.toString());
            if (!mapping) {
                const pseudocode = await this.generatePseudocode(newCode, () => {});
                return;
            }

            // Calculate code changes
            const codeDiff = DiffUtils.generateUnifiedDiff(mapping.code, newCode);
            
            if (!DiffUtils.hasChanges(mapping.code, newCode)) {
                return;
            }

            // Show status bar update
            const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
            statusBarItem.text = "$(sync~spin) Updating pseudocode...";
            statusBarItem.show();

            // Generate pseudocode changes using the diff
            const pseudocodeDiff = await updatePseudocode(
                this.llmManager,
                newCode,
                mapping.pseudocode,
                codeDiff
            );

            if (!pseudocodeDiff.trim()) {
                console.error('Failed to generate pseudocode changes');
                statusBarItem.text = "$(error) Pseudocode update failed";
                setTimeout(() => statusBarItem.hide(), 3000);
                return;
            }

            // Apply the changes to the pseudocode
            const newPseudocode = DiffUtils.applyUnifiedDiff(mapping.pseudocode, pseudocodeDiff);

            if (newPseudocode === mapping.pseudocode) {
                statusBarItem.text = "$(info) No pseudocode changes needed";
                setTimeout(() => statusBarItem.hide(), 3000);
                return;
            }

            // Update the mapping for both URIs first
            const newMapping: VersionedContent = {
                code: newCode,
                pseudocode: newPseudocode,
                lastEditTime: Date.now(),
                version: (mapping.version || 0) + 1
            };
            this.codeMap.set(abstractionUri.toString(), newMapping);
            this.codeMap.set(uri.toString(), newMapping);

            // Update only the abstraction document
            const abstractionDoc = await vscode.workspace.openTextDocument(abstractionUri);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                abstractionUri,
                new vscode.Range(0, 0, abstractionDoc.lineCount, 0),
                newPseudocode
            );
            await vscode.workspace.applyEdit(edit);
            await abstractionDoc.save();

            statusBarItem.text = "$(check) Pseudocode updated";
            setTimeout(() => statusBarItem.hide(), 3000);

        } catch (error) {
            console.error('Error in handleCodeSave:', error);
            vscode.window.showErrorMessage(`Error saving code: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.isApplyingChanges = false;
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initializationPromise;
        }
    }

    async generatePseudocode(content: string, onProgress: (content: string) => void): Promise<string> {
        await this.ensureInitialized();
        let pseudocode = '';
        let chunks: string[] = [];

        try {
            for await (const chunk of streamGeneratePseudocode(this.llmManager, content)) {
                chunks.push(chunk);
                pseudocode = chunks.join('');
                const partialContent = TextProcessor.cleanPseudocode(pseudocode);
                onProgress(partialContent);
            }

            // Clean and return final pseudocode
            const finalPseudocode = TextProcessor.cleanPseudocode(pseudocode);
            
            // Store the original code and pseudocode mapping for both URIs
            const uri = vscode.window.activeTextEditor?.document.uri;
            if (uri) {
                const mapping: VersionedContent = {
                    code: content,
                    pseudocode: finalPseudocode,
                    lastEditTime: Date.now(),
                    version: 1
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
    }

    dispose(): void {
        this.highlightedDecorations.dispose();
    }

    private toAbstractionUri(uri: vscode.Uri): vscode.Uri {
        if (!uri) {
            throw new Error('Invalid URI provided');
        }
        return uri.with({ scheme: 'abstraction' });
    }

    private toFileUri(uri: vscode.Uri): vscode.Uri {
        if (!uri) {
            throw new Error('Invalid URI provided');
        }
        if (uri.scheme !== 'file' && uri.scheme !== 'abstraction') {
            throw new Error(`Invalid URI scheme: ${uri.scheme}`);
        }
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
            // Get current cursor position and document contents
            const cursorLine = editor.selection.active.line;
            const sourceLines = editor.document.getText().split('\n');

            // Calculate current visible range and cursor position relative to it
            const visibleRanges = editor.visibleRanges;
            if (visibleRanges.length === 0) return;

            const visibleRange = visibleRanges[0];
            const visibleStart = visibleRange.start.line;
            const visibleEnd = visibleRange.end.line;
            const visibleLineCount = visibleEnd - visibleStart;
            const cursorRelativePosition = (cursorLine - visibleStart) / visibleLineCount;

            if (targetView === 'pseudocode') {
                // Switch to pseudocode view
                const abstractionUri = this.toAbstractionUri(isAbstraction ? this.toFileUri(uri) : uri);
                const doc = await vscode.workspace.openTextDocument(abstractionUri);
                const targetLines = doc.getText().split('\n');
                
                // Get highlighted lines before showing the document
                const highlightedLines = await EmbeddingUtils.getHighlightedLines(
                    sourceLines,
                    targetLines,
                    cursorLine,
                    false // Not initial generation
                );

                // Show the document
                const newEditor = await vscode.window.showTextDocument(doc, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });

                // Create array of ranges for non-highlighted lines
                const highlightedLineNumbers = new Set(highlightedLines.map(h => h.line));
                const dimRanges: vscode.Range[] = [];
                for (let i = 0; i < targetLines.length; i++) {
                    if (!highlightedLineNumbers.has(i)) {
                        dimRanges.push(new vscode.Range(i, 0, i, Number.MAX_VALUE));
                    }
                }

                // Create decoration types
                const dimText = vscode.window.createTextEditorDecorationType({
                    opacity: '0.3',
                    isWholeLine: true,
                    after: {
                        contentText: '',
                        margin: '0',
                        textDecoration: 'none; transition: opacity 1.5s ease-in-out'
                    }
                });

                // Create decorations for highlighted lines
                const decorationTypes = highlightedLines.map(({ opacity }) => 
                    vscode.window.createTextEditorDecorationType({
                        opacity: opacity.toString(),
                        isWholeLine: true,
                        after: {
                            contentText: '',
                            margin: '0',
                            textDecoration: 'none; transition: opacity 1.5s ease-in-out'
                        }
                    })
                );

                // Apply decorations
                newEditor.setDecorations(dimText, dimRanges);
                highlightedLines.forEach(({ line }, index) => {
                    newEditor.setDecorations(decorationTypes[index], [
                        new vscode.Range(line, 0, line, Number.MAX_VALUE)
                    ]);
                });

                // Find the line that best matches the cursor position
                const cursorMatchLine = highlightedLines.find(h => h.sourceLine === cursorLine) || highlightedLines[0];
                const lineLength = targetLines[cursorMatchLine.line].length;
                
                // Calculate and set scroll position to maintain relative cursor position
                const targetVisibleStart = Math.max(0, Math.floor(cursorMatchLine.line - (cursorRelativePosition * visibleLineCount)));
                const targetVisibleEnd = Math.min(targetLines.length - 1, Math.ceil(targetVisibleStart + visibleLineCount));
                
                // First reveal the range to ensure proper scrolling
                newEditor.revealRange(
                    new vscode.Range(targetVisibleStart, 0, targetVisibleEnd, 0),
                    vscode.TextEditorRevealType.InCenter
                );

                // Then set the cursor position
                newEditor.selection = new vscode.Selection(cursorMatchLine.line, lineLength, cursorMatchLine.line, lineLength);

                // Clean up decorations after delay
                setTimeout(() => {
                    dimText.dispose();
                    decorationTypes.forEach(d => d.dispose());
                }, 1500);

            } else {
                // Switch back to code view
                const fileUri = this.toFileUri(uri);
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const targetLines = doc.getText().split('\n');

                // Get highlighted lines before showing the document
                const highlightedLines = await EmbeddingUtils.getHighlightedLines(
                    sourceLines,
                    targetLines,
                    cursorLine,
                    false // Not initial generation
                );

                // Show the document
                const newEditor = await vscode.window.showTextDocument(doc, { 
                    preview: false,
                    viewColumn: vscode.ViewColumn.Active
                });

                // Create array of ranges for non-highlighted lines
                const highlightedLineNumbers = new Set(highlightedLines.map(h => h.line));
                const dimRanges: vscode.Range[] = [];
                for (let i = 0; i < targetLines.length; i++) {
                    if (!highlightedLineNumbers.has(i)) {
                        dimRanges.push(new vscode.Range(i, 0, i, Number.MAX_VALUE));
                    }
                }

                // Create decoration types
                const dimText = vscode.window.createTextEditorDecorationType({
                    opacity: '0.3',
                    isWholeLine: true,
                    after: {
                        contentText: '',
                        margin: '0',
                        textDecoration: 'none; transition: opacity 1.5s ease-in-out'
                    }
                });

                // Create decorations for highlighted lines
                const decorationTypes = highlightedLines.map(({ opacity }) => 
                    vscode.window.createTextEditorDecorationType({
                        opacity: opacity.toString(),
                        isWholeLine: true,
                        after: {
                            contentText: '',
                            margin: '0',
                            textDecoration: 'none; transition: opacity 1.5s ease-in-out'
                        }
                    })
                );

                // Apply decorations
                newEditor.setDecorations(dimText, dimRanges);
                highlightedLines.forEach(({ line }, index) => {
                    newEditor.setDecorations(decorationTypes[index], [
                        new vscode.Range(line, 0, line, Number.MAX_VALUE)
                    ]);
                });

                // Find the line that best matches the cursor position
                const cursorMatchLine = highlightedLines.find(h => h.sourceLine === cursorLine) || highlightedLines[0];
                const lineLength = targetLines[cursorMatchLine.line].length;
                
                // Calculate and set scroll position to maintain relative cursor position
                const targetVisibleStart = Math.max(0, Math.floor(cursorMatchLine.line - (cursorRelativePosition * visibleLineCount)));
                const targetVisibleEnd = Math.min(targetLines.length - 1, Math.ceil(targetVisibleStart + visibleLineCount));
                
                // First reveal the range to ensure proper scrolling
                newEditor.revealRange(
                    new vscode.Range(targetVisibleStart, 0, targetVisibleEnd, 0),
                    vscode.TextEditorRevealType.InCenter
                );

                // Then set the cursor position
                newEditor.selection = new vscode.Selection(cursorMatchLine.line, lineLength, cursorMatchLine.line, lineLength);

                // Clean up decorations after delay
                setTimeout(() => {
                    dimText.dispose();
                    decorationTypes.forEach(d => d.dispose());
                }, 1500);
            }
        } catch (error) {
            console.error('Error changing abstraction level:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    getCodeMapping(uri: string): VersionedContent | undefined {
        return this.codeMap.get(uri);
    }

    async generateCode(pseudocode: string, originalCode: string, diff: string, document: vscode.TextDocument): Promise<string | undefined> {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBarItem.text = "$(sync~spin) Generating code...";
        statusBarItem.show();

        try {
            const newCode = await updateCode(this.llmManager, originalCode, pseudocode, diff);

            if (newCode === originalCode) {
                statusBarItem.text = "$(info) No code changes needed";
                setTimeout(() => statusBarItem.hide(), 3000);
                return;
            }

            setTimeout(() => statusBarItem.hide(), 3000);
            return newCode;

        } catch (error) {
            statusBarItem.text = "$(error) Code generation error";
            statusBarItem.show();
            setTimeout(() => statusBarItem.hide(), 3000);
            throw error;
        }
    }

    private setupSaveHandler(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.workspace.onWillSaveTextDocument(async e => {
                if (e.document.uri.scheme === 'file') {
                    const abstractionUri = this.toAbstractionUri(e.document.uri);
                    const mapping = this.codeMap.get(abstractionUri.toString());
                    
                    // Skip if this is a save triggered by accepting changes
                    if (mapping?.code === e.document.getText()) {
                        return;
                    }
                    
                    e.waitUntil(this.handleCodeSave(e.document));
                }
            })
        );
    }
} 
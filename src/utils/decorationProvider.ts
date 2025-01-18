import * as vscode from 'vscode';

interface DecorationInfo {
    decoration: vscode.TextEditorDecorationType;
    range: vscode.Range;
}

export class DecorationProvider {
    private static instance: DecorationProvider;
    private addedLineDecoration: vscode.TextEditorDecorationType;
    private removedLineDecoration: vscode.TextEditorDecorationType;
    private inlineAcceptButton: vscode.TextEditorDecorationType;
    private activeDecorations: Map<string, vscode.TextEditorDecorationType[]> = new Map();
    private activeRanges: Map<string, DecorationInfo[]> = new Map();

    private constructor() {
        // Clean diff decorations matching Cursor's style
        this.addedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'var(--vscode-diffEditor-insertedLineBackground)',
            isWholeLine: true
        });

        this.removedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'var(--vscode-diffEditor-removedLineBackground)',
            isWholeLine: true
        });

        // Accept/Reject buttons in Cursor style
        this.inlineAcceptButton = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: '  Accept ⌘Y   Reject ⌘N',
                color: 'var(--vscode-editor-foreground)',
                backgroundColor: 'var(--vscode-editor-background)',
                margin: '0 0 0 2em'
            },
            backgroundColor: 'var(--vscode-editor-background)',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    static getInstance(): DecorationProvider {
        if (!DecorationProvider.instance) {
            DecorationProvider.instance = new DecorationProvider();
        }
        return DecorationProvider.instance;
    }

    showDiffDecorations(editor: vscode.TextEditor, diff: string): void {
        const addedRanges: vscode.Range[] = [];
        const removedRanges: vscode.Range[] = [];
        let firstChangeRange: vscode.Range | undefined;
        const decorationInfo: DecorationInfo[] = [];
        
        // Clear any existing decorations for this editor
        this.clearDecorations(editor.document.uri.toString());
        
        // Parse the diff and collect ranges
        const lines = diff.split('\n');
        let targetLine = 0;  // Line number in the final text
        let sourceLineOffset = 0;  // Offset for removed lines
        let hasChanges = false;
        
        for (const line of lines) {
            if (!line) continue;
            
            const marker = line[0];
            switch (marker) {
                case '+':
                    hasChanges = true;
                    const addedRange = new vscode.Range(targetLine, 0, targetLine, line.length);
                    addedRanges.push(addedRange);
                    if (!firstChangeRange) firstChangeRange = addedRange;
                    decorationInfo.push({ decoration: this.addedLineDecoration, range: addedRange });
                    targetLine++;
                    break;
                case '-':
                    hasChanges = true;
                    const removedRange = new vscode.Range(targetLine + sourceLineOffset, 0, targetLine + sourceLineOffset, line.length);
                    removedRanges.push(removedRange);
                    if (!firstChangeRange) firstChangeRange = removedRange;
                    decorationInfo.push({ decoration: this.removedLineDecoration, range: removedRange });
                    sourceLineOffset++;
                    break;
                case ' ':
                    targetLine++;
                    sourceLineOffset = 0;  // Reset offset after context lines
                    break;
            }
        }

        // Apply decorations
        editor.setDecorations(this.addedLineDecoration, addedRanges);
        editor.setDecorations(this.removedLineDecoration, removedRanges);

        // Add accept/reject buttons at the first change if there are changes
        if (hasChanges && firstChangeRange) {
            editor.setDecorations(this.inlineAcceptButton, [firstChangeRange]);
            decorationInfo.push({ decoration: this.inlineAcceptButton, range: firstChangeRange });
        }

        // Store active decorations and ranges for this document
        this.activeDecorations.set(editor.document.uri.toString(), [
            this.addedLineDecoration,
            this.removedLineDecoration,
            this.inlineAcceptButton
        ]);
        this.activeRanges.set(editor.document.uri.toString(), decorationInfo);
    }

    getDecorations(documentUri: string): DecorationInfo[] {
        return this.activeRanges.get(documentUri) || [];
    }

    clearDecorations(documentUri: string): void {
        const decorations = this.activeDecorations.get(documentUri);
        if (decorations) {
            // Find all visible editors showing this document
            vscode.window.visibleTextEditors
                .filter(editor => editor.document.uri.toString() === documentUri)
                .forEach(editor => {
                    decorations.forEach(decoration => {
                        editor.setDecorations(decoration, []);
                    });
                });
            this.activeDecorations.delete(documentUri);
            this.activeRanges.delete(documentUri);
        }
    }

    dispose(): void {
        this.addedLineDecoration.dispose();
        this.removedLineDecoration.dispose();
        this.inlineAcceptButton.dispose();
        this.activeDecorations.clear();
        this.activeRanges.clear();
    }
} 
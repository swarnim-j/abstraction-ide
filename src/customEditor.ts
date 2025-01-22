import * as vscode from 'vscode';
import { LLMManager } from './managers/llmManager';
import { TextProcessor } from './utils/textProcessor';
import { codeMapManager } from './state/codeMap';
import { CodeChange } from './types/index';
import { AbstractionManager } from './managers/abstractionManager';

export class CodeViewProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'abstraction-ide.codeView';
    private isPseudocodeView: Map<string, boolean> = new Map();
    private webviewPanels: Map<string, vscode.WebviewPanel> = new Map();
    private documentListeners: Map<string, vscode.Disposable> = new Map();
    private aiManager: LLMManager;
    private abstractionManager: AbstractionManager;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.aiManager = new LLMManager();
        this.aiManager.initialize();
        this.abstractionManager = new AbstractionManager(this.context);
    }

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const uri = document.uri.toString();
        
        // Store the webview panel reference
        this.webviewPanels.set(uri, webviewPanel);

        // Initialize view state
        this.isPseudocodeView.set(uri, false);

        // Set up the initial content
        webviewPanel.webview.options = {
            enableScripts: true
        };

        // Set initial content
        await this.updateContent(document, webviewPanel);

        // Handle document changes
        const changeListener = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === uri) {
                this.handleDocumentChange(e.document, e.contentChanges);
            }
        });

        this.documentListeners.set(uri, changeListener);

        // Clean up on panel close
        webviewPanel.onDidDispose(() => {
            changeListener.dispose();
            this.documentListeners.delete(uri);
            this.webviewPanels.delete(uri);
            this.isPseudocodeView.delete(uri);
        });

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'edit':
                    await this.handleEdit(document, message.text);
                    break;
            }
        });
    }

    async toggleAbstractionLevel(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const uri = editor.document.uri.toString();
        const isPseudo = this.isPseudocodeView.get(uri) || false;
        this.isPseudocodeView.set(uri, !isPseudo);

        const panel = this.webviewPanels.get(uri);
        if (panel) {
            await this.updateContent(editor.document, panel);
        }
    }

    private async handleDocumentChange(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]): Promise<void> {
        const uri = document.uri.toString();
        const panel = this.webviewPanels.get(uri);
        if (!panel) return;

        // Update cache with new code
        const isPseudo = this.isPseudocodeView.get(uri) || false;
        if (!isPseudo) {
            // Original code changed, update pseudocode
            const cached = codeMapManager.get(uri);
            const newText = document.getText();
            
            if (cached?.code !== newText) {
                // Extract meaningful changes
                const { changes: meaningfulChanges, hasContentChange } = TextProcessor.extractChanges(cached?.code || '', newText);
                
                if (!cached || !hasContentChange) {
                    // If no cache or no meaningful changes, do full generation
                    await this.updatePseudocode(document, newText, true, []);
                } else {
                    // Do incremental update based on changes
                    await this.updatePseudocode(document, newText, false, meaningfulChanges);
                }
            }
        }

        // Update the view
        await this.updateContent(document, panel);
    }

    private async handleEdit(document: vscode.TextDocument, newText: string): Promise<void> {
        const uri = document.uri.toString();
        const isPseudo = this.isPseudocodeView.get(uri) || false;
        
        if (isPseudo) {
            console.log('\n=== Handling Pseudocode Edit ===');
            console.log('New text length:', newText.length);
            
            // Convert pseudocode changes back to code
            const cached = codeMapManager.get(uri);
            if (!cached) {
                console.warn('No cached content found for:', uri);
                return;
            }

            try {
                // Extract changes from pseudocode
                const { changes } = TextProcessor.extractChanges(cached.pseudocode, newText);
                
                // Get editor for the document
                const editor = await vscode.window.showTextDocument(document, { preview: false });
                
                // Use AbstractionManager for proper diff-based code generation
                const newCode = await this.abstractionManager.generateCode(newText, cached.code, changes, document);
                if (!newCode) {
                    throw new Error('Failed to generate code changes');
                }

                if (newCode === cached.code) {
                    console.log('No changes in generated code, skipping update');
                    return;
                }

                // Apply changes to the document
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    document.uri,
                    new vscode.Range(0, 0, document.lineCount, 0),
                    newCode
                );

                const success = await vscode.workspace.applyEdit(edit);
                if (!success) {
                    throw new Error('Failed to apply code changes');
                }

                console.log('Successfully applied code changes');
            } catch (error) {
                console.error('Error handling pseudocode edit:', error);
                vscode.window.showErrorMessage(`Error updating code: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private async updatePseudocode(document: vscode.TextDocument, newText: string, fullGeneration: boolean, changes: CodeChange[] = []): Promise<void> {
        const uri = document.uri.toString();
        
        try {
            if (fullGeneration) {
                // Do full generation
                const pseudocode = await this.abstractionManager.generatePseudocode(newText, () => {});
                if (!pseudocode) {
                    throw new Error('Failed to generate pseudocode');
                }
                codeMapManager.set(uri, {
                    code: newText,
                    pseudocode: pseudocode,
                    lastEditTime: Date.now(),
                    version: (codeMapManager.get(uri)?.version || 0) + 1
                });
            } else {
                // Do incremental update
                const cached = codeMapManager.get(uri);
                if (cached?.pseudocode) {
                    const editor = await vscode.window.showTextDocument(document, { preview: false });
                    const newPseudocode = await this.abstractionManager.generateCode(cached.pseudocode, newText, changes, document);
                    if (newPseudocode) {
                        codeMapManager.set(uri, {
                            code: newText,
                            pseudocode: newPseudocode,
                            lastEditTime: Date.now(),
                            version: cached.version + 1
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error updating pseudocode:', error);
            vscode.window.showErrorMessage(`Error updating pseudocode: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async updateContent(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        const uri = document.uri.toString();
        const isPseudo = this.isPseudocodeView.get(uri) || false;
        let content = '';
        let title = document.fileName;

        try {
            if (isPseudo) {
                const cached = codeMapManager.get(uri);
                if (cached?.pseudocode) {
                    content = cached.pseudocode;
                } else {
                    await this.updatePseudocode(document, document.getText(), true, []);
                    const updated = codeMapManager.get(uri);
                    content = updated?.pseudocode || '';
                }
                title += ' (Pseudocode)';
            } else {
                content = document.getText();
            }

            // Update webview content
            webviewPanel.title = title;
            webviewPanel.webview.html = this.getHtmlForWebview(content, isPseudo);
        } catch (error) {
            console.error('Error updating content:', error);
            vscode.window.showErrorMessage(`Error updating content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getHtmlForWebview(content: string, isPseudo: boolean): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    pre {
                        padding: 10px;
                        margin: 0;
                        width: 100%;
                        height: 100vh;
                        box-sizing: border-box;
                        overflow: auto;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        line-height: var(--vscode-editor-line-height);
                        white-space: pre;
                        word-wrap: normal;
                        tab-size: 4;
                    }
                    .pseudocode {
                        font-family: var(--vscode-editor-font-family);
                    }
                </style>
                <script>
                    const vscode = acquireVsCodeApi();
                    let content = ${JSON.stringify(content)};
                    
                    function updateContent(newContent) {
                        if (newContent !== content) {
                            content = newContent;
                            vscode.postMessage({
                                command: 'edit',
                                text: newContent
                            });
                        }
                    }
                </script>
            </head>
            <body>
                <pre class="${isPseudo ? 'pseudocode' : ''}" 
                     contenteditable="true" 
                     onblur="updateContent(this.innerText)">${this.escapeHtml(content)}</pre>
            </body>
            </html>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new CodeViewProvider(context);
        return vscode.window.registerCustomEditorProvider(
            CodeViewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }
} 
import * as vscode from 'vscode';
import { diffLines, Change } from 'diff';

export class FileManager {
    static getPseudocodeUri(originalUri: vscode.Uri): vscode.Uri {
        const pseudocodePath = originalUri.path + '.pseudo';
        return vscode.Uri.file(pseudocodePath);
    }

    static getOriginalUri(pseudocodeUri: vscode.Uri): vscode.Uri {
        return vscode.Uri.file(pseudocodeUri.path.slice(0, -7)); // Remove '.pseudo'
    }

    static async writeFile(uri: vscode.Uri, content: string): Promise<void> {
        const writeData = Buffer.from(content, 'utf8');
        await vscode.workspace.fs.writeFile(uri, writeData);
    }

    static async readFile(uri: vscode.Uri): Promise<string> {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    }

    static async updateFile(uri: vscode.Uri, newContent: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(uri);
        const oldContent = document.getText();
        const changes = diffLines(oldContent, newContent);
        
        const edit = new vscode.WorkspaceEdit();
        let offset = 0;

        for (const change of changes) {
            if (change.added || change.removed) {
                const startPos = document.positionAt(offset);
                const endPos = change.removed 
                    ? document.positionAt(offset + change.value.length)
                    : startPos;
                
                if (change.added) {
                    edit.insert(uri, startPos, change.value);
                }
                if (change.removed) {
                    edit.delete(uri, new vscode.Range(startPos, endPos));
                    offset += change.value.length;
                }
            } else {
                offset += change.value.length;
            }
        }

        await vscode.workspace.applyEdit(edit);
    }

    static async applyChanges(uri: vscode.Uri, changes: Change[]): Promise<void> {
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        let offset = 0;

        for (const change of changes) {
            const startPos = document.positionAt(offset);
            if (change.added) {
                edit.insert(uri, startPos, change.value);
            } else if (change.removed) {
                const endPos = document.positionAt(offset + change.value.length);
                edit.delete(uri, new vscode.Range(startPos, endPos));
                offset += change.value.length;
            } else {
                offset += change.value.length;
            }
        }

        await vscode.workspace.applyEdit(edit);
    }

    static isPseudocodeFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.pseudo');
    }
} 
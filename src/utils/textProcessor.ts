import DiffMatchPatch from 'diff-match-patch';
import { CodeChange, ExtractChangesResult } from '../types/index';

export class TextProcessor {
    static cleanPseudocode(text: string): string {
        try {
            if (!text || typeof text !== 'string') {
                return '';
            }

            // Remove markdown code blocks if present
            text = text.replace(/```[\s\S]*?```/g, '');
            
            // Ensure consistent indentation
            const lines = text.split('\n');
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            if (nonEmptyLines.length === 0) return '';
            
            // Safely calculate minimum indentation
            const minIndent = Math.min(...nonEmptyLines.map(line => {
                const match = line.match(/^\s*/);
                return match ? match[0].length : 0;
            }));
            
            // Remove minimum indentation from all lines
            const processedLines = lines.map(line => {
                if (line.trim().length === 0) return '';
                const match = line.match(/^\s*/);
                const indentLength = match ? match[0].length : 0;
                return line.slice(Math.min(indentLength, minIndent));
            });
            
            // Trim extra whitespace and newlines
            return processedLines.join('\n').trim();
            
        } catch (error: unknown) {
            return ''; // Return empty string on error
        }
    }

    static cleanCodeResponse(text: string): string {
        try {
            if (!text || typeof text !== 'string') {
                return '';
            }

            // Remove markdown code blocks if present
            text = text.replace(/```[\s\S]*?```/g, (match) => {
                try {
                    // Extract just the code from within the block
                    const lines = match.split('\n');
                    if (lines.length < 3) {
                        return '';
                    }
                    return lines.slice(1, -1).join('\n');
                } catch (error: unknown) {
                    return ''; // Skip invalid blocks
                }
            });

            return text.trim();
            
        } catch (error: unknown) {
            return ''; // Return empty string on error
        }
    }

    static extractChanges(oldText: string, newText: string): ExtractChangesResult {
        try {
            if (typeof oldText !== 'string' || typeof newText !== 'string') {
                throw new Error('Invalid input types');
            }

            const changes: CodeChange[] = [];
            const oldLines = oldText.split('\n');
            const newLines = newText.split('\n');
            
            let hasContentChange = false;
            
            // Simple diff algorithm
            const maxLines = Math.max(oldLines.length, newLines.length);
            for (let i = 0; i < maxLines; i++) {
                const oldLine = oldLines[i] || '';
                const newLine = newLines[i] || '';
                
                if (oldLine !== newLine) {
                    hasContentChange = true;
                    if (!oldLine) {
                        changes.push({
                            type: 'add',
                            content: newLine,
                            lineNumber: i + 1
                        });
                    } else if (!newLine) {
                        changes.push({
                            type: 'delete',
                            content: oldLine,
                            lineNumber: i + 1
                        });
                    } else {
                        changes.push({
                            type: 'modify',
                            content: newLine,
                            lineNumber: i + 1
                        });
                    }
                }
            }
            
            return { changes, hasContentChange };
        } catch (error: unknown) {
            return { changes: [], hasContentChange: false };
        }
    }

    static getDiffMatchPatch(): DiffMatchPatch {
        return new DiffMatchPatch();
    }
} 
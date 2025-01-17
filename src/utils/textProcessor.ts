import DiffMatchPatch from 'diff-match-patch';
import { CodeChange, ExtractChangesResult } from '../types/index';

export class TextProcessor {
    static cleanPseudocode(text: string): string {
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
    }

    static cleanCodeResponse(text: string): string {
        console.log('Cleaning code response:', {
            inputLength: text.length,
            hasMarkdown: text.includes('```')
        });

        // Remove markdown code blocks if present
        text = text.replace(/```[\s\S]*?```/g, (match) => {
            // Extract just the code from within the block
            const code = match.split('\n').slice(1, -1).join('\n');
            console.log('Extracted code from markdown block:', {
                originalLength: match.length,
                extractedLength: code.length
            });
            return code;
        });

        const cleaned = text.trim();
        console.log('Cleaned result:', {
            outputLength: cleaned.length,
            isEmpty: !cleaned.trim()
        });

        return cleaned;
    }

    static extractChanges(oldText: string, newText: string): ExtractChangesResult {
        const changes: CodeChange[] = [];
        let hasContentChange = false;

        // Use diff-match-patch for detailed change detection
        const dmp = new DiffMatchPatch();
        const diffs = dmp.diff_main(oldText, newText);
        dmp.diff_cleanupSemantic(diffs);

        let lineNumber = 1;
        for (const [type, text] of diffs) {
            if (type !== 0) { // 0 means no change
                hasContentChange = true;
                const change: CodeChange = {
                    type: type === 1 ? 'add' : type === -1 ? 'delete' : 'modify',
                    content: text,
                    lineNumber
                };
                changes.push(change);
            }
            // Update line number based on newlines in the text
            lineNumber += (text.match(/\n/g) || []).length;
        }

        return { changes, hasContentChange };
    }

    static getDiffMatchPatch(): DiffMatchPatch {
        return new DiffMatchPatch();
    }
} 
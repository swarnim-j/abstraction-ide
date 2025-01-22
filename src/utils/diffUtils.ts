import { createPatch, parsePatch } from 'diff';

export class DiffError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DiffError';
    }
}

export class SearchTextNotUnique extends DiffError {
    constructor(text: string) {
        super(`Multiple matches found for text:\n${text}`);
        this.name = 'SearchTextNotUnique';
    }
}

export class HunkApplyError extends DiffError {
    constructor(message: string, public hunk: string, public path: string) {
        super(message);
        this.name = 'HunkApplyError';
    }
}

interface BeforeAfter {
    before: string[];
    after: string[];
}

export class DiffUtils {
    /**
     * Generate a unified diff between two texts with proper context
     */
    static generateUnifiedDiff(originalText: string, newText: string): string {
        return createPatch('file', originalText, newText, '', '', { context: 2 });
    }

    /**
     * Apply a unified diff to text with robust error handling and search
     */
    static applyUnifiedDiff(originalText: string, unifiedDiff: string): string {
        if (!unifiedDiff.trim()) {
            return originalText;
        }

        try {
            const hunks = this.findDiffHunks(unifiedDiff);
            let result = originalText;

            for (const hunk of hunks) {
                const newContent = this.applyHunk(result, hunk);
                if (newContent === null) {
                    throw new HunkApplyError(
                        'Failed to apply hunk',
                        hunk,
                        'file'
                    );
                }
                result = newContent;
            }

            return result;
        } catch (error) {
            if (error instanceof DiffError) {
                throw error;
            }
            console.error('Error applying patch:', error);
            return originalText;
        }
    }

    /**
     * Find diff hunks in unified diff format
     */
    private static findDiffHunks(diff: string): string[] {
        const hunks: string[] = [];
        const lines = diff.split('\n');
        let currentHunk: string[] = [];
        let inHunk = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('@@')) {
                if (currentHunk.length > 0) {
                    hunks.push(currentHunk.join('\n'));
                    currentHunk = [];
                }
                inHunk = true;
            }
            
            if (inHunk) {
                currentHunk.push(line);
            }
            
            if (inHunk && i < lines.length - 1 && lines[i + 1].startsWith('@@')) {
                hunks.push(currentHunk.join('\n'));
                currentHunk = [];
                inHunk = false;
            }
        }

        if (currentHunk.length > 0) {
            hunks.push(currentHunk.join('\n'));
        }

        return hunks;
    }

    /**
     * Apply a single hunk with flexible matching
     */
    private static applyHunk(content: string, hunk: string): string | null {
        const { before, after } = this.hunkToBeforeAfter(hunk);
        
        // Try direct application first
        const directResult = this.directlyApplyHunk(content, before.join('\n'), after.join('\n'));
        if (directResult !== null) {
            return directResult;
        }

        // Try flexible application with partial context
        return this.flexibleApplyHunk(content, before, after);
    }

    /**
     * Convert hunk to before and after text arrays
     */
    private static hunkToBeforeAfter(hunk: string): BeforeAfter {
        const lines = hunk.split('\n');
        const before: string[] = [];
        const after: string[] = [];

        for (const line of lines) {
            if (!line || line.startsWith('@@')) continue;
            
            const op = line[0];
            const content = line.slice(1);

            if (op === ' ') {
                before.push(content);
                after.push(content);
            } else if (op === '-') {
                before.push(content);
            } else if (op === '+') {
                after.push(content);
            }
        }

        return { before, after };
    }

    /**
     * Try to directly apply changes
     */
    private static directlyApplyHunk(content: string, before: string, after: string): string | null {
        const trimmedBefore = before.trim();
        const trimmedAfter = after.trim();

        if (!trimmedBefore) {
            return null;
        }

        // Don't attempt replacement if the context is too small and appears multiple times
        if (trimmedBefore.length < 10 && content.split(trimmedBefore).length > 2) {
            return null;
        }

        try {
            return this.searchAndReplace(content, trimmedBefore, trimmedAfter);
        } catch (error) {
            if (error instanceof SearchTextNotUnique) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Apply hunk with flexible context matching
     */
    private static flexibleApplyHunk(content: string, before: string[], after: string[]): string | null {
        const contextSizes = this.getContextSizes(before);
        
        for (const { preContext, postContext } of contextSizes) {
            const beforeText = before.slice(-preContext).join('\n').trim();
            const afterText = before.slice(0, postContext).join('\n').trim();
            
            try {
                const result = this.searchAndReplace(
                    content,
                    beforeText,
                    afterText
                );
                if (result !== null) {
                    return result;
                }
            } catch (error) {
                if (!(error instanceof SearchTextNotUnique)) {
                    throw error;
                }
            }
        }

        return null;
    }

    /**
     * Get different context size combinations to try
     */
    private static *getContextSizes(lines: string[]): Generator<{ preContext: number, postContext: number }> {
        const maxContext = Math.min(5, lines.length);
        
        for (let total = maxContext; total >= 0; total--) {
            for (let pre = total; pre >= 0; pre--) {
                const post = total - pre;
                yield { preContext: pre, postContext: post };
            }
        }
    }

    /**
     * Search and replace text with uniqueness check
     */
    private static searchAndReplace(content: string, search: string, replace: string): string {
        const matches = content.split(search);
        
        if (matches.length === 1) {
            return ''; // No matches
        }
        
        if (matches.length > 2) {
            throw new SearchTextNotUnique(search);
        }
        
        return matches.join(replace);
    }

    /**
     * Check if two texts have meaningful differences
     */
    static hasChanges(text1: string, text2: string): boolean {
        const patch = parsePatch(createPatch('file', text1, text2))[0];
        return patch.hunks.some(hunk => 
            hunk.lines.some(line => 
                (line.startsWith('+') || line.startsWith('-')) && line.trim().length > 1
            )
        );
    }
}
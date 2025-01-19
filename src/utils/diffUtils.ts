import { diff_match_patch } from 'diff-match-patch';
import { createPatch, parsePatch, applyPatch } from 'diff';

export class DiffUtils {
    private static dmp = new diff_match_patch();

    /**
     * Generate a unified diff between two texts
     */
    static generateUnifiedDiff(originalText: string, newText: string): string {
        // Use jsdiff's createPatch to get a proper unified diff
        // We use 'file' as placeholder since we're diffing in-memory content
        return createPatch('file', originalText, newText);
    }

    /**
     * Apply a unified diff to a text
     */
    static applyUnifiedDiff(originalText: string, unifiedDiff: string): string {
        try {
            const patches = parsePatch(unifiedDiff);
            // Apply each patch in sequence
            let result = originalText;
            for (const patch of patches) {
                const patchResult = applyPatch(result, patch);
                if (patchResult === false) {
                    console.error('Failed to apply patch');
                    return originalText;
                }
                result = patchResult;
            }
            return result;
        } catch (error) {
            console.error('Error applying patch:', error);
            // Return original text if patch fails
            return originalText;
        }
    }

    /**
     * Check if two texts are different
     */
    static hasChanges(text1: string, text2: string): boolean {
        const diffs = this.dmp.diff_main(text1, text2);
        this.dmp.diff_cleanupSemantic(diffs);
        return diffs.length > 1; // More than one diff means there are actual changes
    }
}
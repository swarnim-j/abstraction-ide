import { diff_match_patch } from 'diff-match-patch';
import { PatchStream } from 'unidiff';

export class DiffUtils {
    private static dmp = new diff_match_patch();
    private static patchStream = new PatchStream();

    /**
     * Generate a unified diff between two texts
     */
    static generateUnifiedDiff(originalText: string, newText: string): string {
        const diffs = this.dmp.diff_main(originalText, newText);
        this.dmp.diff_cleanupSemantic(diffs);
        
        // Convert to unified diff format
        const patches = this.dmp.patch_make(originalText, diffs);
        return this.dmp.patch_toText(patches);
    }

    /**
     * Apply a unified diff to a text
     */
    static applyUnifiedDiff(originalText: string, unifiedDiff: string): string {
        try {
            return this.patchStream.applyPatch(originalText, unifiedDiff);
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
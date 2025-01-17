export class DiffCalculator {
    /**
     * Calculate unified diff between old and new text
     * Returns array of change hunks without line numbers
     */
    static calculateUnifiedDiff(oldText: string, newText: string): string[] {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const hunks: string[] = [];
        let currentHunk: string[] = [];
        
        let i = 0;
        let j = 0;
        
        while (i < oldLines.length || j < newLines.length) {
            // Find next difference
            while (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                // Add context lines (up to 3)
                if (currentHunk.length > 0) {
                    currentHunk.push(' ' + oldLines[i]);
                }
                i++;
                j++;
            }
            
            // Start new hunk if we found a difference
            if (i < oldLines.length || j < newLines.length) {
                if (currentHunk.length === 0) {
                    // Add up to 3 lines of context before change
                    const contextStart = Math.max(0, i - 3);
                    for (let k = contextStart; k < i; k++) {
                        currentHunk.push(' ' + oldLines[k]);
                    }
                }
                
                // Add removed lines
                while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
                    currentHunk.push('-' + oldLines[i]);
                    i++;
                }
                
                // Add added lines
                while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
                    currentHunk.push('+' + newLines[j]);
                    j++;
                }
                
                // Add up to 3 lines of context after change
                let contextCount = 0;
                while (contextCount < 3 && i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                    currentHunk.push(' ' + oldLines[i]);
                    i++;
                    j++;
                    contextCount++;
                }
                
                // Complete the hunk
                if (currentHunk.length > 0) {
                    hunks.push(currentHunk.join('\n'));
                    currentHunk = [];
                }
            }
        }
        
        return hunks;
    }
    
    /**
     * Apply a unified diff to text
     * Returns the modified text
     */
    static applyUnifiedDiff(originalText: string, diff: string): string {
        const lines = originalText.split('\n');
        const hunks = diff.split('\n@@ ... @@\n');
        
        for (const hunk of hunks) {
            if (!hunk.trim()) continue;
            
            const hunkLines = hunk.split('\n');
            const contextBefore = hunkLines.filter(line => line.startsWith(' ')).map(line => line.slice(1));
            const removedLines = hunkLines.filter(line => line.startsWith('-')).map(line => line.slice(1));
            const addedLines = hunkLines.filter(line => line.startsWith('+')).map(line => line.slice(1));
            
            // Find location to apply hunk
            let matchIndex = -1;
            for (let i = 0; i <= lines.length - contextBefore.length; i++) {
                let matches = true;
                for (let j = 0; j < contextBefore.length; j++) {
                    if (lines[i + j] !== contextBefore[j]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    matchIndex = i;
                    break;
                }
            }
            
            if (matchIndex === -1) {
                throw new Error('Failed to locate hunk context in file');
            }
            
            // Apply the changes
            lines.splice(matchIndex, removedLines.length, ...addedLines);
        }
        
        return lines.join('\n');
    }
} 
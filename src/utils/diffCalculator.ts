import DiffMatchPatch from 'diff-match-patch';

interface Hunk {
    context: string[];
    changes: Array<{
        type: '+' | '-';
        content: string;
    }>;
}

export class DiffCalculator {
    private static dmp = new DiffMatchPatch();

    /**
     * Calculate unified diff between old and new text
     * Returns array of change hunks without line numbers
     */
    static calculateUnifiedDiff(oldText: string, newText: string): string[] {
        console.log('Input:', {
            oldLength: oldText.length,
            newLength: newText.length,
            oldLines: oldText.split('\n').length,
            newLines: newText.split('\n').length,
            oldTextPreview: oldText.substring(0, 100),
            newTextPreview: newText.substring(0, 100)
        });

        // Split into lines for line-based diffing
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        // Track changes
        const hunks: string[] = [];
        const contextLines = 3;
        
        let i = 0;  // Index in oldLines
        let j = 0;  // Index in newLines
        
        while (i < oldLines.length || j < newLines.length) {
            let hunkStartOld = i;
            let hunkStartNew = j;
            let hunkLines: string[] = [];
            let oldCount = 0;
            let newCount = 0;
            let foundChange = false;
            
            // Look ahead for changes
            let lookAheadOld = i;
            let lookAheadNew = j;
            let changeFound = false;
            
            while (lookAheadOld < oldLines.length || lookAheadNew < newLines.length) {
                if (lookAheadOld < oldLines.length && lookAheadNew < newLines.length && 
                    oldLines[lookAheadOld] === newLines[lookAheadNew]) {
                    if (!changeFound && hunkLines.length >= contextLines * 2) {
                        break;
                    }
                    lookAheadOld++;
                    lookAheadNew++;
                } else {
                    changeFound = true;
                    if (lookAheadOld < oldLines.length) lookAheadOld++;
                    if (lookAheadNew < newLines.length) lookAheadNew++;
                }
            }
            
            if (!changeFound) {
                i = lookAheadOld;
                j = lookAheadNew;
                continue;
            }
            
            // Include leading context
            hunkStartOld = Math.max(0, i - contextLines);
            hunkStartNew = Math.max(0, j - contextLines);
            
            // Add leading context
            for (let k = 0; k < contextLines && hunkStartOld + k < i; k++) {
                hunkLines.push(' ' + oldLines[hunkStartOld + k]);
                oldCount++;
                newCount++;
            }
            
            // Process changes
            while (i < lookAheadOld || j < lookAheadNew) {
                if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                    hunkLines.push(' ' + oldLines[i]);
                    oldCount++;
                    newCount++;
                    i++;
                    j++;
                } else {
                    foundChange = true;
                    if (i < lookAheadOld) {
                        hunkLines.push('-' + oldLines[i]);
                        oldCount++;
                        i++;
                    }
                    if (j < lookAheadNew) {
                        hunkLines.push('+' + newLines[j]);
                        newCount++;
                        j++;
                    }
                }
            }
            
            if (foundChange) {
                // Create hunk header
                const header = `@@ -${hunkStartOld + 1},${oldCount} +${hunkStartNew + 1},${newCount} @@\n`;
                hunks.push(header + hunkLines.join('\n'));
            }
        }

        return hunks;
    }

    static applyDiff(originalText: string, diff: string): string {
        // Clean up markdown formatting
        diff = diff.replace(/```diff\n/g, '').replace(/```\n?/g, '');
        
        // Split both texts into lines
        const originalLines = originalText.split('\n');
        const resultLines: string[] = [];
        
        // Process each line in the diff
        const diffLines = diff.split('\n');
        let originalIndex = 0;
        
        for (const diffLine of diffLines) {
            if (!diffLine) {
                resultLines.push('');
                originalIndex++;
                continue;
            }
            
            const marker = diffLine[0];
            const content = diffLine.slice(1);

            switch (marker) {
                case ' ': // Context line - should match original
                    if (originalIndex < originalLines.length) {
                        resultLines.push(originalLines[originalIndex]);
                        originalIndex++;
                    }
                    break;
                    
                case '-': // Removed line - skip in original
                    if (originalIndex < originalLines.length) {
                        originalIndex++;
                    }
                    break;
                    
                case '+': // Added line - add to result
                    resultLines.push(content);
                    break;
                    
                default:
                    // Copy original line if no marker
                    if (originalIndex < originalLines.length) {
                        resultLines.push(originalLines[originalIndex]);
                        originalIndex++;
                    }
                    break;
            }
        }
        
        // Add any remaining original lines
        while (originalIndex < originalLines.length) {
            resultLines.push(originalLines[originalIndex]);
            originalIndex++;
        }
        
        return resultLines.join('\n');
    }

    /**
     * Find the first position where two strings differ
     */
    public static findFirstDifference(text1: string, text2: string): { position: number, context: string } | null {
        const minLength = Math.min(text1.length, text2.length);
        for (let i = 0; i < minLength; i++) {
            if (text1[i] !== text2[i]) {
                const start = Math.max(0, i - 20);
                const end = Math.min(text1.length, i + 20);
                return {
                    position: i,
                    context: `...${text1.slice(start, i)}[${text1[i] || ''}→${text2[i] || ''}]${text1.slice(i + 1, end)}...`
                };
            }
        }
        if (text1.length !== text2.length) {
            const i = minLength;
            const start = Math.max(0, i - 20);
            return {
                position: i,
                context: `...${text1.slice(start, i)}[${text1.length > text2.length ? text1[i] : ''}→${text2.length > text1.length ? text2[i] : ''}]...`
            };
        }
        return null;
    }
} 
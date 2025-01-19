export class DiffCalculator {
    /**
     * Calculate unified diff between old and new text with hunk headers
     * Used internally for LLM context
     */
    static calculateInternalDiff(oldText: string, newText: string): string[] {
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
        // Clean up markdown formatting and extract only the diff content
        const lines = diff.split('\n');
        const diffLines: string[] = [];
        
        // Only include lines that start with space, +, or -
        for (const line of lines) {
            if (!line) {
                diffLines.push(line);
            } else if (line[0] === ' ' || line[0] === '+' || line[0] === '-') {
                diffLines.push(line);
            }
        }
        
        if (diffLines.length === 0) {
            return originalText;
        }
        
        // Process the diff lines
        const resultLines: string[] = [];
        let originalIndex = 0;
        const originalLines = originalText.split('\n');
        
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
            }
        }
        
        // Add any remaining original lines
        while (originalIndex < originalLines.length) {
            resultLines.push(originalLines[originalIndex]);
            originalIndex++;
        }
        
        return resultLines.join('\n');
    }
}
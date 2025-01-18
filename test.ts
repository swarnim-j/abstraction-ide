function applyDiff(originalText: string, diff: string): string {
    // Split both texts into lines
    const originalLines = originalText.split('\n');
    const diffLines = diff.split('\n');
    
    // Result array to store final lines
    const resultLines: string[] = [];
    
    // Keep track of position in original text
    let originalIndex = 0;
    
    // Process each line in the diff
    for (let i = 0; i < diffLines.length; i++) {
        const diffLine = diffLines[i];
        if (!diffLine) continue;
        
        const marker = diffLine[0];
        const content = diffLine.slice(1);
        
        switch (marker) {
            case ' ': // Context line - should match original
                if (originalIndex < originalLines.length) {
                    if (originalLines[originalIndex].trim() !== content.trim()) {
                        throw new Error(`Context mismatch at line ${originalIndex + 1}`);
                    }
                    resultLines.push(content);
                    originalIndex++;
                }
                break;
                
            case '-': // Removed line - skip in original
                if (originalIndex < originalLines.length) {
                    if (originalLines[originalIndex].trim() !== content.trim()) {
                        throw new Error(`Remove line mismatch at line ${originalIndex + 1}`);
                    }
                    originalIndex++;
                }
                break;
                
            case '+': // Added line - add to result without advancing original
                resultLines.push(content);
                break;
                
            default:
                // Ignore lines that don't start with space, +, or -
                break;
        }
    }
    
    return resultLines.join('\n');
}

// Test the function
function test() {
    const original = 
`function processArray(arr) {
    if (arr.length === 0) {
    throw new Error('Empty array');
}
return calculateAverage(arr);
}`;

    const diff = `function processArray(arr) {
if (arr.length === 0) {
- throw new Error('Empty array');
+ throw new Error('Invalid input');
}
return calculateAverage(arr);`;

    try {
        const result = applyDiff(original, diff);
        console.log('Result:');
        console.log(result);
        
        const expected = `function processArray(arr) {
if (arr.length === 0) {
throw new Error('Invalid input');
}
return calculateAverage(arr);`;
        
        console.log('\nTest passed:', result === expected);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
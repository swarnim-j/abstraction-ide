import { DiffUtils } from '../utils/diffUtils';
import { generateText } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';

// Original test cases for diff utils
const originalCode = `function hello() {
    console.log("Hello world");
    // Some comment
    const x = 42;
    return x;
}`;

const modifiedCode = `function hello() {
    console.log("Hello universe!");
    // Some comment
    const x = 43;
    const y = x * 2;
    return y;
}`;

// Test basic diff functionality
console.log("=== Basic Diff Test ===");
console.log("\n=== Generated Diff ===");
const diff = DiffUtils.generateUnifiedDiff(originalCode, modifiedCode);
console.log(diff);

console.log("\n=== After Applying Diff ===");
const result = DiffUtils.applyUnifiedDiff(originalCode, diff);
console.log(result);

console.log("\n=== Change Detection ===");
console.log("Has changes:", DiffUtils.hasChanges(originalCode, modifiedCode));
console.log("Has changes (same text):", DiffUtils.hasChanges(originalCode, originalCode));

// Test LLM-based code updates
console.log("\n=== LLM Code Update Test ===");

// Original pseudocode
const originalPseudocode = `function hello:
    print "Hello world"
    // Some comment
    set x to 42
    return x`;

// Modified pseudocode with changes
const modifiedPseudocode = `function hello:
    print "Hello universe!"
    // Some comment
    set x to 43
    set y to x times 2
    return y`;

// Test code update based on pseudocode changes
async function testCodeUpdate() {
    // Check for API key in environment
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("Please set GOOGLE_API_KEY environment variable");
        return;
    }

    const provider = createGoogleGenerativeAI({ apiKey });
    const model = 'gemini-2.0-flash-exp';
    
    console.log("\nOriginal Code:");
    console.log(originalCode);
    
    console.log("\nOriginal Pseudocode:");
    console.log(originalPseudocode);
    
    console.log("\nModified Pseudocode:");
    console.log(modifiedPseudocode);
    
    // Calculate pseudocode changes
    const pseudocodeDiff = DiffUtils.generateUnifiedDiff(originalPseudocode, modifiedPseudocode);
    
    console.log("\nPseudocode Changes (Diff):");
    console.log(pseudocodeDiff);
    
    try {
        // Generate code changes using LLM
        const { text } = await generateText({
            model: provider(model),
            messages: [
                {
                    role: 'system',
                    content: `You are a code updater that outputs changes as unified diff hunks. Follow these rules exactly:

1. First analyze ALL the required changes in the code
2. Group related changes that should be made together
3. For each group of changes, create a hunk starting with @@
4. Each line within a hunk must start with:
   - space ( ) for STABLE context lines (function boundaries, comments, truly unchanged code)
   - minus (-) for removed lines
   - plus (+) for added lines
5. Use only context lines that you are certain will not be modified
6. Do not include:
   - Line numbers in @@ headers
   - File headers (---, +++)
   - Markdown blocks
   - Any explanatory text

Example of good output:
@@
 function example() {  // Function boundary as stable context
-    const x = 1;
-    const y = x;
+    const x = 2;
+    const y = x * 3;
+    const z = y + 1;
     // End calculation  // Comment as stable context
 }

@@
 // Process result     // Comment as stable context
 if (condition) {
-    return x + y;
+    return z;
 }`
                },
                {
                    role: 'user',
                    content: `Original code:\n${originalCode}\n\nModified pseudocode:\n${modifiedPseudocode}\n\nPseudocode changes:\n${pseudocodeDiff}`
                }
            ],
            temperature: 0.7,
        });

        let diffText = text.replace(/```diff\n/g, '').replace(/```/g, '');
        
        console.log("\nGenerated Code Changes (Diff):");
        console.log(diffText);
        
        // Apply the changes
        const finalCode = DiffUtils.applyUnifiedDiff(originalCode, diffText);
        
        console.log("\nFinal Code After Changes:");
        console.log(finalCode);
    } catch (error) {
        console.error("Error during code update:", error);
    }
}

// Run the test
testCodeUpdate().catch(console.error); 
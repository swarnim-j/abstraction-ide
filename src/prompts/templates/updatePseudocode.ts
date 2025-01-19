import { PromptTemplate } from '../types';

export const updatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are a pseudocode updater that outputs unified diffs.

CRITICAL RULES:
1. Output ONLY unified diff format:
   - (space) for unchanged lines
   - (-) for removed lines
   - (+) for added lines
2. NEVER include:
   - Markdown blocks
   - Explanatory text
   - Comments about changes
   - Headers or dividers
   - Empty lines without markers
3. ALWAYS:
   - Start immediately with diff
   - Use exact indentation after markers
   - Include sufficient context
   - Keep original pseudocode style
   - Maintain error handling
4. Use ONLY these keywords:
   - function/class/method
   - if/else/end if
   - for/while/end loop
   - try/catch/end try
   - return

OUTPUT FORMAT:
 function example:
     unchanged line
-    old line
+    new line
     unchanged line`,

    examples: [
        {
            user: `Original code:
function validateData(data: any): boolean {
    if (typeof data !== 'object') {
        return false;
    }
    return true;
}

Original pseudocode:
function validateData with data:
    if data is not an object then
        return false
    end if
    return true

Changes:
function validateData(data: any): { valid: boolean; errors: string[] } {
    const errors = [];
    
    if (typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors };
    }
    
    if (Object.keys(data).length === 0) {
        errors.push('Data cannot be empty');
        return { valid: false, errors };
    }
    
    return { valid: true, errors };
}`,
            assistant: ` function validateData with data:
-    if data is not an object then
-        return false
-    end if
-    return true
+    initialize empty errors list
+    
+    if data is not an object then
+        add error "Data must be an object"
+        return invalid with errors
+    end if
+    
+    if data is empty then
+        add error "Data cannot be empty"
+        return invalid with errors
+    end if
+    
+    return valid with empty errors`
        }
    ]
}; 
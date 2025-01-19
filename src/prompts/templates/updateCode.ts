import { PromptTemplate } from '../types';

export const updateCodeTemplate: PromptTemplate = {
    systemPrompt: `You are a code updater that outputs unified diffs.

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
   - Keep original code style
   - Maintain error handling
4. Preserve:
   - Types and interfaces
   - Error handling
   - Security checks
   - Function signatures
   - Variable names

OUTPUT FORMAT:
 function example() {
     unchanged line
-    old line
+    new line
     unchanged line
 }`,

    examples: [
        {
            user: `Original code:
function validateInput(data: any): boolean {
    if (!data) return false;
    return true;
}

Original pseudocode:
function validateInput with data:
    if no data then
        return false
    end if
    return true

Changes:
function validateInput with data:
    validate data is object
    if not object then
        throw error "Invalid data type"
    end if
    
    validate required fields
    if missing fields then
        throw error "Missing required fields"
    end if
    
    return true`,
            assistant: ` function validateInput(data: any): boolean {
-    if (!data) return false;
-    return true;
+    if (typeof data !== 'object') {
+        throw new Error("Invalid data type");
+    }
+    
+    if (!Object.keys(data).length) {
+        throw new Error("Missing required fields");
+    }
+    
+    return true;
 }`
        }
    ]
};
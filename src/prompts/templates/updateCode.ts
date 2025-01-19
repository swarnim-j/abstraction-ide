import { PromptTemplate } from '../types';

export const updateCodeTemplate: PromptTemplate = {
    systemPrompt: `You are an expert programmer tasked with updating code based on changes made to the pseudocode.
Maintain the exact functionality described in the pseudocode.
Use best practices and consistent style.
Include all necessary imports and dependencies.
Output changes in unified diff format with space/+/- line prefixes.`,
    examples: [{
        user: `Original code:
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}

Pseudocode:
Function calculateTotal(items):
    Initialize sum to 0
    For each item in items:
        If item's price is positive:
            Add (item's price × item's quantity) to sum
    Return sum`,
        assistant: ` function calculateTotal(items) {
+    let sum = 0;
+    for (const item of items) {
+        if (item.price > 0) {
+            sum += item.price * item.quantity;
+        }
+    }
+    return sum;
-    return items.reduce((sum, item) => sum + item.price, 0);
 }`
    }]
}; 
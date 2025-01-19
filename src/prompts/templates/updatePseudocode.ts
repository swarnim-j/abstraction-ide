import { PromptTemplate } from '../types';

export const updatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are an expert programmer tasked with updating pseudocode based on changes made to the original code.
Focus on maintaining clarity and consistency with the existing pseudocode style.
Preserve the overall structure and flow while incorporating the changes.
Output changes in unified diff format with space/+/- line prefixes.`,
    examples: [{
        user: `Original code:
function calculateTotal(items) {
    let sum = 0;
    for (const item of items) {
        if (item.price > 0) {
            sum += item.price * item.quantity;
        }
    }
    return sum;
}

Current pseudocode:
Function calculateTotal(items):
    Initialize sum to 0
    For each item in items:
        If item's price is positive:
            Add (item's price × item's quantity) to sum
    Return sum

Changes:
[{
    "type": "add",
    "content": "Add tax calculation"
}]`,
        assistant: ` Function calculateTotal(items):
     Initialize sum to 0
     For each item in items:
         If item's price is positive:
             Add (item's price × item's quantity) to sum
+     Apply tax rate to sum
     Return sum`
    }]
}; 
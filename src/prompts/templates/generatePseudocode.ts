import { PromptTemplate } from '../types';

export const generatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are an expert programmer tasked with converting code into clear, concise pseudocode.
Focus on capturing the high-level logic and purpose while maintaining readability.
Use consistent terminology and indentation.
Preserve the overall structure and flow of the code.`,
    examples: [{
        user: `function calculateTotal(items) {
    let sum = 0;
    for (const item of items) {
        if (item.price > 0) {
            sum += item.price * item.quantity;
        }
    }
    return sum;
}`,
        assistant: `Function calculateTotal(items):
    Initialize sum to 0
    For each item in items:
        If item's price is positive:
            Add (item's price × item's quantity) to sum
    Return sum`
    }]
}; 
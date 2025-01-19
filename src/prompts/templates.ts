import { Message } from '../managers/llm/LLMProvider';

export interface PromptTemplate {
    systemPrompt: string;
    examples?: {
        user: string;
        assistant: string;
    }[];
}

export interface PromptOptions {
    code?: string;
    pseudocode?: string;
    changes?: any[];
    additionalContext?: string;
}

export class PromptManager {
    private static templates: Record<string, PromptTemplate> = {
        generatePseudocode: {
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
        },
        generateCode: {
            systemPrompt: `You are an expert programmer tasked with implementing pseudocode in actual code.
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
        }
    };

    static generatePrompt(templateName: string, options: PromptOptions): Message[] {
        const template = this.templates[templateName];
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        const messages: Message[] = [
            {
                role: 'system',
                content: template.systemPrompt
            }
        ];

        // Add examples if they exist
        if (template.examples) {
            for (const example of template.examples) {
                messages.push(
                    { role: 'user', content: example.user },
                    { role: 'assistant', content: example.assistant }
                );
            }
        }

        // Add the actual user query based on template
        switch (templateName) {
            case 'generatePseudocode':
                messages.push({
                    role: 'user',
                    content: options.code || ''
                });
                break;
            case 'generateCode':
                messages.push({
                    role: 'user',
                    content: `Original code:\n\n${options.code}\n\nPseudocode:\n\n${options.pseudocode}\n\nChanges:\n${JSON.stringify(options.changes, null, 2)}`
                });
                break;
        }

        return messages;
    }

    static addTemplate(name: string, template: PromptTemplate): void {
        this.templates[name] = template;
    }
} 
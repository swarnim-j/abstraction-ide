import { Message } from '../../managers/llm/LLMProvider';
import { UpdatePseudocodeParams, PromptFunction } from '../types';
import { updatePseudocodeTemplate } from '../templates/updatePseudocode';
import { LLMManager } from '../../managers/llmManager';
import { CodeChange } from '../../types';

export const updatePseudocodePrompt: PromptFunction<UpdatePseudocodeParams> = ({ code, pseudocode, changes }) => {
    const messages: Message[] = [
        {
            role: 'system',
            content: updatePseudocodeTemplate.systemPrompt
        }
    ];

    // Add examples
    if (updatePseudocodeTemplate.examples) {
        for (const example of updatePseudocodeTemplate.examples) {
            messages.push(
                { role: 'user', content: example.user },
                { role: 'assistant', content: example.assistant }
            );
        }
    }

    // Add the actual user query
    messages.push({
        role: 'user',
        content: `Original code:\n${code}\n\nOriginal pseudocode:\n${pseudocode}\n\nChanges:\n${JSON.stringify(changes, null, 2)}`
    });

    return messages;
};

export async function updatePseudocode(code: string, pseudocode: string, changes: CodeChange[]): Promise<string> {
    const llmManager = new LLMManager();
    await llmManager.initialize();
    
    const messages = updatePseudocodePrompt({ code, pseudocode, changes });
    return llmManager.createCompletion(messages);
}
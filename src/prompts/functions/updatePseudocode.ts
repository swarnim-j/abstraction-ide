import { Message } from '../../managers/llmManager';
import { UpdatePseudocodeParams, PromptFunction } from '../types';
import { updatePseudocodeTemplate } from '../templates/updatePseudocode';
import { LLMManager } from '../../managers/llmManager';

export const updatePseudocodePrompt: PromptFunction<UpdatePseudocodeParams> = ({ code, pseudocode, diff }) => {
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
        content: `Original code:\n${code}\n\nOriginal pseudocode:\n${pseudocode}\n\nCode changes:\n${diff}`
    });

    return messages;
};

export async function updatePseudocode(llm: LLMManager, code: string, pseudocode: string, diff: string): Promise<string> {
    const messages = updatePseudocodePrompt({ code, pseudocode, diff });
    return llm.generate(messages);
}
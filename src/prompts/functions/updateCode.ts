import { Message } from '../../managers/llmManager';
import { UpdateCodeParams, PromptFunction } from '../types';
import { updateCodeTemplate } from '../templates/updateCode';
import { LLMManager } from '../../managers/llmManager';

export const updateCodePrompt: PromptFunction<UpdateCodeParams> = ({ code, pseudocode, diff }) => {
    const messages: Message[] = [
        {
            role: 'system',
            content: updateCodeTemplate.systemPrompt
        }
    ];

    // Add examples
    if (updateCodeTemplate.examples) {
        for (const example of updateCodeTemplate.examples) {
            messages.push(
                { role: 'user', content: example.user },
                { role: 'assistant', content: example.assistant }
            );
        }
    }

    // Add the actual user query
    messages.push({
        role: 'user',
        content: `Original code:\n${code}\n\nOriginal pseudocode:\n${pseudocode}\n\nPseudocode changes:\n${diff}`
    });

    return messages;
};

export async function updateCode(llm: LLMManager, code: string, pseudocode: string, diff: string): Promise<string> {
    const messages = updateCodePrompt({ code, pseudocode, diff });
    return llm.generate(messages);
}
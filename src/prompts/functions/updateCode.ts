import { Message } from '../../managers/llm/LLMProvider';
import { UpdateCodeParams, PromptFunction } from '../types';
import { updateCodeTemplate } from '../templates/updateCode';

export const updateCodePrompt: PromptFunction<UpdateCodeParams> = ({ code, pseudocode, changes }) => {
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
        content: `Original code:\n\n${code}\n\nPseudocode:\n\n${pseudocode}\n\nChanges:\n${JSON.stringify(changes, null, 2)}`
    });

    return messages;
}; 
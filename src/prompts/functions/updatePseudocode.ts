import { Message } from '../../managers/llm/LLMProvider';
import { UpdatePseudocodeParams, PromptFunction } from '../types';
import { updatePseudocodeTemplate } from '../templates/updatePseudocode';

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
        content: `Original code:\n\n${code}\n\nCurrent pseudocode:\n\n${pseudocode}\n\nChanges:\n${JSON.stringify(changes, null, 2)}`
    });

    return messages;
}; 
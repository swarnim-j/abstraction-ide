import { Message } from '../../managers/llm/LLMProvider';
import { GeneratePseudocodeParams, PromptFunction } from '../types';
import { generatePseudocodeTemplate } from '../templates/generatePseudocode';
import { LLMManager } from '../../managers/llmManager';

export const generatePseudocodePrompt: PromptFunction<GeneratePseudocodeParams> = ({ code }) => {
    const messages: Message[] = [
        {
            role: 'system',
            content: generatePseudocodeTemplate.systemPrompt
        }
    ];

    // Add examples
    if (generatePseudocodeTemplate.examples) {
        for (const example of generatePseudocodeTemplate.examples) {
            messages.push(
                { role: 'user', content: example.user },
                { role: 'assistant', content: example.assistant }
            );
        }
    }

    // Add the actual user query
    messages.push({
        role: 'user',
        content: code
    });

    return messages;
};

export async function generatePseudocode(llm: LLMManager, code: string): Promise<string> {
    const messages = generatePseudocodePrompt({ code });
    return llm.generate(messages);
}

export async function* streamGeneratePseudocode(llm: LLMManager, code: string): AsyncGenerator<string> {
    const messages = generatePseudocodePrompt({ code });
    yield* llm.stream(messages);
} 
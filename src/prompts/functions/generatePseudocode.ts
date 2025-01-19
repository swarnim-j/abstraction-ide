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

export async function generatePseudocode(code: string): Promise<string> {
    const llmManager = new LLMManager();
    await llmManager.initialize();
    
    const messages = generatePseudocodePrompt({ code });
    return llmManager.createCompletion(messages);
}

export async function* streamGeneratePseudocode(code: string): AsyncGenerator<string> {
    const llmManager = new LLMManager();
    await llmManager.initialize();
    
    const messages = generatePseudocodePrompt({ code });
    const response = await llmManager.createStreamingCompletion(messages);
    
    for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
            yield chunk.choices[0].delta.content;
        }
    }
} 
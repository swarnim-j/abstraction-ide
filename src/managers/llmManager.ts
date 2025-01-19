import { LLMProvider, LLMFactory, Message, StreamingResponse } from './llm/LLMProvider';

export class LLMManager {
    private provider: LLMProvider | null = null;

    async initialize(): Promise<void> {
        if (!this.provider) {
            this.provider = await LLMFactory.createProvider();
        }
    }

    isInitialized(): boolean {
        return this.provider !== null;
    }

    async generate(messages: Message[]): Promise<string> {
        if (!this.provider) {
            throw new Error('AI Manager not initialized');
        }

        let result = '';
        try {
            for await (const chunk of this.provider.createStreamingCompletion(messages)) {
                if (chunk.choices[0]?.delta?.content) {
                    result += chunk.choices[0].delta.content;
                }
            }
            return result;
        } catch (error) {
            console.error('Error in LLM generation:', error);
            throw error;
        }
    }

    async* stream(messages: Message[]): AsyncGenerator<string> {
        if (!this.provider) {
            throw new Error('AI Manager not initialized');
        }

        try {
            for await (const chunk of this.provider.createStreamingCompletion(messages)) {
                if (chunk.choices[0]?.delta?.content) {
                    yield chunk.choices[0].delta.content;
                }
            }
        } catch (error) {
            console.error('Error in LLM streaming:', error);
            throw error;
        }
    }
} 
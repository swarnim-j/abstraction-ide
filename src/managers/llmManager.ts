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

    async createStreamingCompletion(messages: Message[]): Promise<AsyncIterable<StreamingResponse>> {
        if (!this.provider) {
            throw new Error('AI Manager not initialized');
        }
        return this.provider.createStreamingCompletion(messages);
    }

    async createCompletion(messages: Message[]): Promise<string> {
        if (!this.provider) {
            throw new Error('AI Manager not initialized');
        }
        let result = '';
        for await (const chunk of this.provider.createStreamingCompletion(messages)) {
            if (chunk.choices[0]?.delta?.content) {
                result += chunk.choices[0].delta.content;
            }
        }
        return result;
    }
} 
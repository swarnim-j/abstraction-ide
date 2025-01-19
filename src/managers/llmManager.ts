import { LLMProvider, LLMFactory, Message, StreamingResponse } from './llm/LLMProvider';
import { CodeChange } from '../types';
import { 
    generatePseudocodePrompt,
    updateCodePrompt,
    updatePseudocodePrompt,
    GeneratePseudocodeParams,
    UpdateCodeParams,
    UpdatePseudocodeParams
} from '../prompts';

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

    private async createStreamingCompletion(messages: Message[]): Promise<AsyncIterable<StreamingResponse>> {
        if (!this.provider) {
            throw new Error('AI Manager not initialized');
        }
        return this.provider.createStreamingCompletion(messages);
    }

    public async *streamPseudocode(code: string): AsyncGenerator<string> {
        const messages = generatePseudocodePrompt({ code });
        const response = await this.createStreamingCompletion(messages);
        for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
                yield chunk.choices[0].delta.content;
            }
        }
    }

    public async *streamPseudocodeUpdate(code: string, pseudocode: string, changes: CodeChange[]): AsyncGenerator<string> {
        const messages = updatePseudocodePrompt({ code, pseudocode, changes });
        const response = await this.createStreamingCompletion(messages);
        for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
                yield chunk.choices[0].delta.content;
            }
        }
    }

    public async *streamToCode(code: string, pseudocode: string, changes: CodeChange[]): AsyncGenerator<string> {
        const messages = updateCodePrompt({ code, pseudocode, changes });
        const response = await this.createStreamingCompletion(messages);
        for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
                yield chunk.choices[0].delta.content;
            }
        }
    }
} 
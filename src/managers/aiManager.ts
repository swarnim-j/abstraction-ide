import { LLMProvider, LLMFactory, Message, StreamingResponse } from './llm/LLMProvider';
import { CodeChange } from '../types';
import {
    PSEUDOCODE_GENERATE_SYSTEM_PROMPT,
    CODE_UPDATE_SYSTEM_PROMPT,
    PSEUDOCODE_UPDATE_SYSTEM_PROMPT
} from '../constants/prompts';

export class AIManager {
    private provider: LLMProvider | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.provider = await LLMFactory.createProvider();
            await this.provider.initialize();
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing AIManager:', error);
            throw error;
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    private async createStreamingCompletion(messages: Message[]): Promise<AsyncIterable<StreamingResponse>> {
        if (!this.provider) {
            throw new Error('AIManager not initialized');
        }
        return this.provider.createStreamingCompletion(messages);
    }

    async *streamPseudocode(content: string, onProgress?: (content: string) => void): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_GENERATE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: content
            }
        ];

        try {
            const stream = await this.createStreamingCompletion(messages);
            let totalContent = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    totalContent += content;
                    if (onProgress) {
                        onProgress(totalContent);
                    }
                    yield content;
                }
            }
            
            if (!totalContent.trim()) {
                console.error('No content generated from API');
                throw new Error('No content generated from API');
            }
        } catch (error) {
            console.error('Error in streamPseudocode:', error);
            throw error;
        }
    }

    async *streamPseudocodeUpdate(code: string, originalPseudocode: string, changes: any[] = []): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_UPDATE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: `Here is the original pseudocode:\n\n${originalPseudocode}\n\nHere is the current code:\n\n${code}\n\nHere are the changes made to the original code:\n${JSON.stringify(changes, null, 2)}\n\nPlease generate a new pseudocode that reflects the changes made to the original code.`
            }
        ];

        try {
            const stream = await this.createStreamingCompletion(messages);
            let totalContent = '';
            
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    totalContent += content;
                    yield content;
                }
            }
            
            if (!totalContent.trim()) {
                console.error('No content generated from API');
                throw new Error('No content generated from API');
            }
        } catch (error) {
            console.error('Error in streamPseudocodeUpdate:', error);
            throw error;
        }
    }

    async *streamToCode(
        pseudocode: string,
        originalCode: string,
        changes: CodeChange[]
    ): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: CODE_UPDATE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: `Here is the original code:\n\n${originalCode}\n\nHere is the current pseudocode:\n\n${pseudocode}\n\nHere are the changes made to the pseudocode:\n${JSON.stringify(changes, null, 2)}\n\nPlease generate a complete diff that includes the full context of the changes, not just the immediate lines. Make sure to include function boundaries and any necessary imports/exports.`
            }
        ];

        try {
            const stream = await this.createStreamingCompletion(messages);
            let totalContent = '';
            
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    totalContent += content;
                    yield content;
                }
            }
            
            if (!totalContent.trim()) {
                console.error('No content generated from API');
                throw new Error('No content generated from API');
            }
        } catch (error) {
            console.error('Error in streamToCode:', error);
            throw error;
        }
    }
} 
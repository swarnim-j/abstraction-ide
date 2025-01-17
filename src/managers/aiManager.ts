import { LLMProvider, LLMFactory, Message, StreamingResponse } from './llm/LLMProvider';
import {
    PSEUDOCODE_SYSTEM_PROMPT,
    CODE_SYSTEM_PROMPT,
    PSEUDOCODE_TO_CODE_DIFF_PROMPT,
    PSEUDOCODE_UPDATE_SYSTEM_PROMPT
} from '../constants/prompts';

export class AIManager {
    private provider: LLMProvider | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('AIManager already initialized');
            return;
        }

        try {
            this.provider = await LLMFactory.createProvider();
            await this.provider.initialize();
            this.initialized = true;
            console.log('AIManager initialized successfully');
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
        console.log('streamPseudocode called with content length:', content.length);

        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: content
            }
        ];

        try {
            console.log('Creating streaming completion');
            const stream = await this.createStreamingCompletion(messages);
            let totalContent = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    totalContent += content;
                    console.log('Received content chunk, total length:', totalContent.length);
                    if (onProgress) {
                        onProgress(totalContent);
                    }
                    yield content;
                }
            }

            console.log('Stream completed, final content length:', totalContent.length);
            
            if (!totalContent.trim()) {
                console.error('No content generated from API');
                throw new Error('No content generated from API');
            }
        } catch (error) {
            console.error('Error in streamPseudocode:', error);
            throw error;
        }
    }

    async *streamPseudocodeUpdate(newCode: string, oldPseudocode: string, changes: any[] = []): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_UPDATE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: JSON.stringify({ original: oldPseudocode, new_code: newCode, changes })
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
                throw new Error('No content generated from API');
            }
        } catch (error) {
            console.error('Error in streamPseudocodeUpdate:', error);
            throw error;
        }
    }

    async *streamToCode(
        prompt: string,
        originalCode: string,
        changes: any[] = [],
        systemPromptKey: 'CODE_SYSTEM_PROMPT' | 'PSEUDOCODE_TO_CODE_DIFF_PROMPT' = 'CODE_SYSTEM_PROMPT'
    ): AsyncGenerator<string> {
        console.log('streamToCode called with:', {
            promptLength: prompt.length,
            originalCodeLength: originalCode.length,
            changesCount: changes.length,
            systemPromptKey
        });

        const systemPrompts = {
            'CODE_SYSTEM_PROMPT': CODE_SYSTEM_PROMPT,
            'PSEUDOCODE_TO_CODE_DIFF_PROMPT': PSEUDOCODE_TO_CODE_DIFF_PROMPT
        } as const;

        const messages = [
            {
                role: 'system' as const,
                content: systemPrompts[systemPromptKey]
            },
            {
                role: 'user' as const,
                content: prompt
            }
        ];

        try {
            console.log('Creating streaming completion with message lengths:', {
                systemPrompt: messages[0].content.length,
                userPrompt: messages[1].content.length
            });

            const stream = await this.createStreamingCompletion(messages);
            let totalContent = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    totalContent += content;
                    console.log('Received content chunk, total length:', totalContent.length);
                    yield content;
                }
            }

            console.log('Stream completed, final content length:', totalContent.length);
            
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
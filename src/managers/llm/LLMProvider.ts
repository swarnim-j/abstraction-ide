import * as vscode from 'vscode';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface StreamingResponse {
    choices: Array<{
        delta?: {
            content?: string;
        };
    }>;
}

export interface LLMConfig {
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

export abstract class LLMProvider {
    protected config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    abstract initialize(): Promise<void>;
    abstract isInitialized(): boolean;
    abstract createStreamingCompletion(messages: Message[]): AsyncIterable<StreamingResponse>;
}

export class OpenAIProvider extends LLMProvider {
    private client: OpenAI | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            this.client = new OpenAI({
                apiKey: this.config.apiKey,
                dangerouslyAllowBrowser: true
            });
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing OpenAI:', error);
            throw error;
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async *createStreamingCompletion(messages: Message[]): AsyncIterable<StreamingResponse> {
        if (!this.client) throw new Error('OpenAI not initialized');

        const stream = await this.client.chat.completions.create({
            model: this.config.model,
            messages,
            stream: true,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
        });

        for await (const chunk of stream) {
            yield {
                choices: [{
                    delta: {
                        content: chunk.choices[0]?.delta?.content || undefined
                    }
                }]
            };
        }
    }
}

export class AnthropicProvider extends LLMProvider {
    private client: Anthropic | null = null;
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            this.client = new Anthropic({
                apiKey: this.config.apiKey
            });
            this.initialized = true;
        } catch (error) {
            console.error('Error initializing Anthropic:', error);
            throw error;
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async *createStreamingCompletion(messages: Message[]): AsyncIterable<StreamingResponse> {
        if (!this.client) throw new Error('Anthropic not initialized');

        // Convert messages to Anthropic format
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
        const prompt = systemMessage + '\n\n' + userMessages.join('\n\n');

        const stream = await this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 4096,
            temperature: this.config.temperature || 0.7,
            messages: [{
                role: 'user',
                content: prompt
            }],
            stream: true
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && 'text' in chunk.delta && chunk.delta.text) {
                yield {
                    choices: [{
                        delta: {
                            content: chunk.delta.text
                        }
                    }]
                };
            }
        }
    }
}

// Factory to create LLM providers
export class LLMFactory {
    static async createProvider(type?: string): Promise<LLMProvider> {
        const config = vscode.workspace.getConfiguration('abstractionIde');
        const providerType = type || config.get<string>('llmProvider') || 'openai';
        
        switch (providerType) {
            case 'openai': {
                const apiKey = config.get<string>('openai.apiKey');
                const model = config.get<string>('openai.model') || 'gpt-4o';
                
                if (!apiKey) {
                    await this.promptForApiKey('openai');
                    return this.createProvider('openai');
                }
                
                const provider = new OpenAIProvider({
                    apiKey,
                    model
                });
                await provider.initialize();
                return provider;
            }

            case 'anthropic': {
                const apiKey = config.get<string>('anthropic.apiKey');
                const model = config.get<string>('anthropic.model') || 'claude-3-5-haiku-20241022';
                
                if (!apiKey) {
                    await this.promptForApiKey('anthropic');
                    return this.createProvider('anthropic');
                }
                
                const provider = new AnthropicProvider({
                    apiKey,
                    model
                });
                await provider.initialize();
                return provider;
            }
            
            default:
                throw new Error(`Provider ${type} not implemented`);
        }
    }

    private static async promptForApiKey(provider: string): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: `Enter your ${provider} API key`,
            password: true,
            ignoreFocusOut: true
        });

        if (!input) {
            throw new Error('API key is required');
        }

        const config = vscode.workspace.getConfiguration('abstractionIde');
        await config.update(`${provider}.apiKey`, input, true);
    }
} 
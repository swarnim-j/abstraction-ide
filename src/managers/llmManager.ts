import * as vscode from 'vscode';
import { generateText, streamText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { mistral, createMistral } from "@ai-sdk/mistral";
import { LanguageModelV1 } from '@ai-sdk/provider';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class LLMManager {
    private apiKey: string | undefined;
    private model: string | undefined;
    private providerType: string;
    private provider: typeof openai | typeof anthropic | typeof google | typeof mistral;
    private llmModel: LanguageModelV1 | undefined;

    constructor() {
        this.providerType = 'google';
        this.provider = google;
    }

    async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration('abstractionIde');
        
        if (this.providerType === 'google') {
            this.apiKey = config.get<string>('google.apiKey');
            this.model = config.get<string>('google.model') || 'gemini-2.0-flash-exp';
            if (!this.apiKey) {
                this.apiKey = await this.promptForApiKey('google');
            }
            this.provider = createGoogleGenerativeAI({ apiKey: this.apiKey });
            this.llmModel = this.provider(this.model) as LanguageModelV1;
        } else if (this.providerType === 'openai') {
            this.apiKey = config.get<string>('openai.apiKey');
            this.model = config.get<string>('openai.model') || 'gpt-4o';
            if (!this.apiKey) {
                this.apiKey = await this.promptForApiKey('openai');
            }
            this.provider = createOpenAI({ apiKey: this.apiKey });
            this.llmModel = this.provider(this.model) as LanguageModelV1;
        } else if (this.providerType === 'mistral') {
            this.apiKey = config.get<string>('mistral.apiKey');
            this.model = config.get<string>('mistral.model') || 'mistral-7b-instruct';
            if (!this.apiKey) {
                this.apiKey = await this.promptForApiKey('mistral');
            }
            this.provider = createMistral({ apiKey: this.apiKey });
            this.llmModel = this.provider(this.model) as LanguageModelV1;
        } else {
            this.apiKey = config.get<string>('anthropic.apiKey');
            this.model = config.get<string>('anthropic.model') || 'claude-3.5-haiku';
            if (!this.apiKey) {
                this.apiKey = await this.promptForApiKey('anthropic');
            }
            this.provider = createAnthropic({ apiKey: this.apiKey });
            this.llmModel = this.provider(this.model) as LanguageModelV1;
        }
    }

    async generate(messages: Message[], config: any = { temperature: 0.7 }): Promise<string> {
        if (!this.llmModel) {
            throw new Error('LLM Manager not initialized');
        }

        try {
            const { text } = await generateText({
                model: this.llmModel,
                messages,
                temperature: config.temperature,
            });
            return text;
        } catch (error) {
            console.error('Error in LLM generation:', error);
            throw error;
        }
    }

    async* stream(messages: Message[], config: any = { temperature: 0.7 }): AsyncGenerator<string> {
        if (!this.llmModel) {
            throw new Error('LLM Manager not initialized');
        }

        try {
            const { textStream } = streamText({
                model: this.llmModel,
                messages,
                temperature: config.temperature,
            });

            for await (const part of textStream) {
                yield part;
            }
        } catch (error) {
            console.error('Error in LLM streaming:', error);
            throw error;
        }
    }

    private async promptForApiKey(provider: string): Promise<string> {
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
        return input;
    }
} 
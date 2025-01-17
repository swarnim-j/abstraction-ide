import OpenAI from 'openai';
import * as vscode from 'vscode';
import { CodeChange } from '../types/index';
import {
    OPENAI_MODEL,
    CONFIG_SECTION,
    CONFIG_API_KEY,
    PSEUDOCODE_SYSTEM_PROMPT,
    CODE_SYSTEM_PROMPT,
    PSEUDOCODE_UPDATE_SYSTEM_PROMPT
} from '../constants';

export class AIManager {
    private client: OpenAI | null = null;

    async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const apiKey = config.get<string>(CONFIG_API_KEY);
        
        if (!apiKey) {
            const response = await vscode.window.showInformationMessage(
                'OpenAI API key is required to use Abstraction IDE. Please enter a valid API key starting with "sk-".',
                'Enter API Key'
            );
            
            if (response === 'Enter API Key') {
                const key = await vscode.window.showInputBox({
                    prompt: 'Enter your OpenAI API key (should start with "sk-")',
                    password: true,
                    validateInput: (value) => {
                        if (!value) {
                            return 'API key is required';
                        }
                        if (!value.startsWith('sk-')) {
                            return 'API key should start with "sk-"';
                        }
                        return null;
                    }
                });
                
                if (key) {
                    try {
                        // Test the API key before saving
                        const testClient = new OpenAI({ apiKey: key });
                        await testClient.chat.completions.create({
                            model: OPENAI_MODEL,
                            messages: [{ role: 'user', content: 'test' }],
                            max_tokens: 1
                        });
                        
                        // If we get here, the key is valid
                        await config.update(CONFIG_API_KEY, key, vscode.ConfigurationTarget.Global);
                        this.client = testClient;
                        vscode.window.showInformationMessage('API key successfully validated and saved.');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Invalid API key: ${error instanceof Error ? error.message : String(error)}`);
                        this.client = null;
                    }
                }
            }
        } else {
            try {
                this.client = new OpenAI({ apiKey });
                // Validate the existing key
                await this.client.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Invalid saved API key: ${error instanceof Error ? error.message : String(error)}. Please enter a new key.`);
                this.client = null;
                // Clear the invalid key
                await config.update(CONFIG_API_KEY, undefined, vscode.ConfigurationTarget.Global);
                // Retry initialization
                return this.initialize();
            }
        }
    }

    isInitialized(): boolean {
        return !!this.client;
    }

    private async createStreamingCompletion(messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>) {
        if (!this.client) {
            throw new Error('OpenAI client not initialized');
        }

        return this.client.chat.completions.create({
            model: OPENAI_MODEL,
            messages,
            temperature: 0.2,
            stream: true
        });
    }

    async *streamPseudocode(code: string): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: `Please convert this code into pseudocode:\n\n${code}`
            }
        ];

        try {
            const stream = await this.createStreamingCompletion(messages);
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
        } catch (error) {
            console.error('Error in streamPseudocode:', error);
            throw error;
        }
    }

    async *streamPseudocodeUpdate(
        newCode: string,
        oldPseudocode: string,
        changes: CodeChange[]
    ): AsyncGenerator<string> {
        const messages = [
            {
                role: 'system' as const,
                content: PSEUDOCODE_UPDATE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: `Here is the current code:\n\n${newCode}\n\nHere is the current pseudocode:\n\n${oldPseudocode}\n\nHere are the changes made to the code:\n${JSON.stringify(changes, null, 2)}\n\nPlease update the pseudocode to reflect these changes while maintaining the same style and abstraction level.`
            }
        ];

        try {
            const stream = await this.createStreamingCompletion(messages);
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
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
        console.log('streamToCode called with:', {
            pseudocodeLength: pseudocode.length,
            originalCodeLength: originalCode.length,
            changesCount: changes.length
        });

        const messages = [
            {
                role: 'system' as const,
                content: CODE_SYSTEM_PROMPT
            },
            {
                role: 'user' as const,
                content: `Here is the original code:\n\n${originalCode}\n\nHere is the current pseudocode:\n\n${pseudocode}\n\nHere are the changes made to the pseudocode:\n${JSON.stringify(changes, null, 2)}\n\nPlease update the code to reflect these changes while maintaining the same style and structure.`
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
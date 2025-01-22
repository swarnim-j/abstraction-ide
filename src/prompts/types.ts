import { Message } from '../managers/llmManager';

export interface PromptTemplate {
    systemPrompt: string;
    examples?: {
        user: string;
        assistant: string;
    }[];
}

export interface GeneratePseudocodeParams {
    code: string;
}

export interface UpdateCodeParams {
    code: string;
    pseudocode: string;
    diff: string;
}

export interface UpdatePseudocodeParams {
    code: string;
    pseudocode: string;
    diff: string;
}

export type PromptFunction<T> = (params: T) => Message[]; 
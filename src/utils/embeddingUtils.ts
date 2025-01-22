import * as vscode from 'vscode';
import { embedMany, cosineSimilarity } from 'ai';
import { mistral, createMistral } from '@ai-sdk/mistral';

export class EmbeddingUtils {
    private static readonly SPATIAL_WEIGHT = 0.7; // Weight for spatial similarity vs semantic similarity
    private static readonly WINDOW_SIZE = 10; // Number of lines to highlight above and below
    private static readonly CHUNK_SIZE = 3; // Number of lines to include in each chunk for context
    private static provider: typeof mistral;
    private static embeddingCache = new Map<string, number[]>();

    private static async ensureInitialized(): Promise<void> {
        if (!this.provider) {
            const config = vscode.workspace.getConfiguration('abstractionIde');
            let apiKey = config.get<string>('mistral.apiKey');

            if (!apiKey) {
                apiKey = await this.promptForApiKey();
                await config.update('mistral.apiKey', apiKey, true);
            }

            this.provider = createMistral({ apiKey });
        }
    }

    private static async promptForApiKey(): Promise<string> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter your Mistral API key for embeddings',
            password: true,
            ignoreFocusOut: true
        });

        if (!input) {
            throw new Error('Mistral API key is required for embeddings');
        }

        return input;
    }

    private static getCacheKey(text: string): string {
        // Simple hash function for caching
        return text.trim().replace(/\s+/g, ' ');
    }

    private static getChunk(lines: string[], centerIndex: number): string {
        const start = Math.max(0, centerIndex - Math.floor(this.CHUNK_SIZE / 2));
        const end = Math.min(lines.length, start + this.CHUNK_SIZE);
        return lines.slice(start, end).join('\n');
    }

    /**
     * Embeds multiple lines of text using Mistral's embedding model with caching
     */
    static async embedLines(lines: string[]): Promise<number[][]> {
        await this.ensureInitialized();
        
        // Check cache and collect lines that need embedding
        const uncachedLines: string[] = [];
        const uncachedIndices: number[] = [];
        const results: number[][] = new Array(lines.length);

        lines.forEach((line, index) => {
            const cacheKey = this.getCacheKey(line);
            const cached = this.embeddingCache.get(cacheKey);
            if (cached) {
                results[index] = cached;
            } else {
                uncachedLines.push(line);
                uncachedIndices.push(index);
            }
        });

        // If there are uncached lines, embed them
        if (uncachedLines.length > 0) {
            const { embeddings } = await embedMany({
                model: this.provider.textEmbeddingModel('mistral-embed'),
                values: uncachedLines,
            });

            // Store in cache and results
            uncachedLines.forEach((line, i) => {
                const cacheKey = this.getCacheKey(line);
                this.embeddingCache.set(cacheKey, embeddings[i]);
                results[uncachedIndices[i]] = embeddings[i];
            });
        }

        return results;
    }

    /**
     * Gets the most similar lines in the target document based on the source cursor position
     */
    static async getHighlightedLines(
        sourceLines: string[],
        targetLines: string[],
        cursorLine: number,
        isInitialGeneration: boolean
    ): Promise<Array<{ line: number; opacity: number; score: number; sourceLine: number }>> {
        // Don't highlight for initial pseudocode generation
        if (isInitialGeneration) {
            return [];
        }

        // Get similarities between all lines
        const similarities = await this.getSimilarities(
            sourceLines,
            targetLines,
            cursorLine
        );

        // Find the line most similar to the cursor line
        const centerMatch = similarities.reduce((best, current) => {
            if (current.sourceLine === cursorLine && (!best || current.score > best.score)) {
                return current;
            }
            return best;
        }, similarities[0]);

        const centerLine = centerMatch.targetLine;
        const centerScore = centerMatch.score;

        // Create array of lines with decreasing opacity from center
        const result: { line: number; opacity: number; score: number; sourceLine: number }[] = [];

        // Add center line with full opacity
        result.push({ line: centerLine, opacity: 1, score: centerScore, sourceLine: centerMatch.sourceLine });

        // Add lines above and below with decreasing opacity
        for (let i = 1; i <= this.WINDOW_SIZE; i++) {
            const opacity = Math.max(0.1, 1 - (i / this.WINDOW_SIZE));
            const aboveLine = centerLine - i;
            const belowLine = centerLine + i;

            if (aboveLine >= 0) {
                const aboveMatch = similarities.find(s => s.targetLine === aboveLine);
                if (aboveMatch) {
                    result.push({ 
                        line: aboveLine, 
                        opacity, 
                        score: aboveMatch.score,
                        sourceLine: aboveMatch.sourceLine
                    });
                }
            }
            if (belowLine < targetLines.length) {
                const belowMatch = similarities.find(s => s.targetLine === belowLine);
                if (belowMatch) {
                    result.push({ 
                        line: belowLine, 
                        opacity, 
                        score: belowMatch.score,
                        sourceLine: belowMatch.sourceLine
                    });
                }
            }
        }

        // Sort by line number for consistent decoration application
        return result.sort((a, b) => a.line - b.line);
    }

    private static async getSimilarities(
        sourceLines: string[],
        targetLines: string[],
        cursorLine: number
    ): Promise<Array<{ targetLine: number; sourceLine: number; score: number }>> {
        // Get embeddings for chunks around each line
        const sourceChunks = sourceLines.map((_, i) => this.getChunk(sourceLines, i));
        const targetChunks = targetLines.map((_, i) => this.getChunk(targetLines, i));

        const sourceEmbeddings = await this.embedLines(sourceChunks);
        const targetEmbeddings = await this.embedLines(targetChunks);

        const similarities: Array<{ targetLine: number; sourceLine: number; score: number }> = [];

        // For each target line
        for (let targetIndex = 0; targetIndex < targetLines.length; targetIndex++) {
            let bestScore = 0;
            let bestSourceLine = 0;

            // Compare with each source line
            for (let sourceIndex = 0; sourceIndex < sourceLines.length; sourceIndex++) {
                // Calculate semantic similarity using cosine similarity of chunk embeddings
                const semanticSimilarity = cosineSimilarity(
                    sourceEmbeddings[sourceIndex],
                    targetEmbeddings[targetIndex]
                );

                // Calculate spatial similarity based on relative position
                const spatialSimilarity = 1 - Math.abs(
                    sourceIndex / sourceLines.length - targetIndex / targetLines.length
                );

                // Combine similarities with weights
                const score = 
                    (1 - this.SPATIAL_WEIGHT) * semanticSimilarity +
                    this.SPATIAL_WEIGHT * spatialSimilarity;

                if (score > bestScore) {
                    bestScore = score;
                    bestSourceLine = sourceIndex;
                }
            }

            similarities.push({
                targetLine: targetIndex,
                sourceLine: bestSourceLine,
                score: bestScore
            });
        }

        return similarities;
    }
} 
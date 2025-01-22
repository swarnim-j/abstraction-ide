export class TextProcessor {
    static cleanPseudocode(text: string): string {
        try {
            if (!text || typeof text !== 'string') {
                return '';
            }

            // Remove markdown code blocks if present
            text = text.replace(/```[\s\S]*?```/g, '');
            
            // Ensure consistent indentation
            const lines = text.split('\n');
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            if (nonEmptyLines.length === 0) return '';
            
            // Safely calculate minimum indentation
            const minIndent = Math.min(...nonEmptyLines.map(line => {
                const match = line.match(/^\s*/);
                return match ? match[0].length : 0;
            }));
            
            // Remove minimum indentation from all lines
            const processedLines = lines.map(line => {
                if (line.trim().length === 0) return '';
                const match = line.match(/^\s*/);
                const indentLength = match ? match[0].length : 0;
                return line.slice(Math.min(indentLength, minIndent));
            });
            
            // Trim extra whitespace and newlines
            return processedLines.join('\n').trim();
            
        } catch (error: unknown) {
            return ''; // Return empty string on error
        }
    }

    static cleanCodeResponse(text: string): string {
        try {
            if (!text || typeof text !== 'string') {
                return '';
            }

            // Remove markdown code blocks if present
            text = text.replace(/```[\s\S]*?```/g, (match) => {
                try {
                    // Extract just the code from within the block
                    const lines = match.split('\n');
                    if (lines.length < 3) {
                        return '';
                    }
                    return lines.slice(1, -1).join('\n');
                } catch (error: unknown) {
                    return ''; // Skip invalid blocks
                }
            });

            return text.trim();
            
        } catch (error: unknown) {
            return ''; // Return empty string on error
        }
    }
} 
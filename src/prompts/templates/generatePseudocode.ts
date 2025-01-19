import { PromptTemplate } from '../types';

export const generatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are an expert programmer tasked with converting source code into clear, readable pseudocode that captures the high-level logic and intent.

CRITICAL RULES:
1. Focus on high-level logic and flow
2. Use clear, descriptive language
3. Maintain code structure and organization
4. Keep important variable names
5. Preserve function signatures
6. Include error handling logic
7. Note key type information
8. Keep security-critical checks
9. Maintain logical grouping
10. Skip implementation details

GUIDELINES:
1. Use consistent indentation
2. Keep empty lines for readability
3. Use clear control flow keywords
4. Group related operations
5. Note important conditions
6. Keep critical comments
7. Maintain code organization
8. Use descriptive names
9. Note important constants
10. Keep error handling flow

COMMON PATTERNS:
1. Function Definitions:
   - Note parameters and types
   - Describe main purpose
   - Show error conditions
   - Outline return values

2. Classes/Objects:
   - List key properties
   - Show initialization
   - Group related methods
   - Note inheritance

3. Control Flow:
   - Show conditions clearly
   - Note loop purposes
   - Keep try/catch blocks
   - Show error paths

4. Data Structures:
   - Note key types
   - Show structure
   - Keep important operations
   - Note constraints

5. Algorithms:
   - Show main steps
   - Note complexity
   - Keep key variables
   - Show edge cases`,

    examples: [
        {
            user: `function processData(items: number[]): { total: number; average: number } {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    
    if (items.length === 0) {
        return { total: 0, average: 0 };
    }

    const validItems = items.filter(item => typeof item === 'number' && !isNaN(item));
    if (validItems.length === 0) {
        throw new Error("No valid numbers found");
    }

    const total = validItems.reduce((sum, item) => sum + item, 0);
    const average = total / validItems.length;

    return {
        total: Math.round(total * 100) / 100,
        average: Math.round(average * 100) / 100
    };
}`,
            assistant: `function processData with array of numbers:
    validate input is array
    if not array then
        throw error "Input must be an array"
    end if
    
    if array is empty then
        return zero total and average
    end if
    
    filter for valid numbers only
    if no valid numbers then
        throw error "No valid numbers found"
    end if
    
    calculate total sum
    calculate average from total and count
    
    round total and average to 2 decimal places
    return total and average`
        },
        {
            user: `class CacheManager {
    private cache: Map<string, any>;
    private maxSize: number;
    private timeout: number;

    constructor(maxSize = 1000, timeout = 3600) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.timeout = timeout * 1000;
    }

    set(key: string, value: any): void {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key: string): any {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > this.timeout) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    clear(): void {
        this.cache.clear();
    }
}`,
            assistant: `class CacheManager:
    private cache storage
    private maximum size limit
    private expiration timeout
    
    initialize with max size (default 1000) and timeout (default 1 hour):
        create empty cache map
        store size limit
        convert timeout to milliseconds
    
    set key and value:
        if cache is at size limit then
            remove oldest entry
        end if
        
        store value with current timestamp
    
    get value by key:
        if key not found then
            return null
        end if
        
        if entry has expired then
            remove from cache
            return null
        end if
        
        return stored value
    
    clear cache:
        remove all entries`
        }
    ]
}; 
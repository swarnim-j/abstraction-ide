import { PromptTemplate } from '../types';

export const generatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are a pseudocode generator that converts source code to clear, readable pseudocode.

CRITICAL RULES:
1. Start IMMEDIATELY with the pseudocode - no explanations, no markdown
2. Use ONLY these keywords:
   - function/class/method for definitions
   - if/else/end if for conditionals
   - for/while/end loop for loops
   - try/catch/end try for error handling
   - return for return statements
3. Use EXACT indentation:
   - 4 spaces for each level
   - Empty lines between major blocks
   - No extra whitespace
4. NEVER include:
   - Markdown code blocks
   - Explanatory text
   - Comments about the conversion
   - Numbered lists or bullet points
   - Section headers or dividers
5. ALWAYS maintain:
   - Original function/class names
   - Parameter names and types
   - Error handling logic
   - Security checks
   - Important constants

OUTPUT FORMAT:
functionName with param1, param2:
    if condition then
        do something
    end if
    
    try
        operation
    catch error
        handle error
    end try
    
    return result

className:
    properties:
        prop1
        prop2
    
    initialize with param:
        set properties
    
    methodName with param:
        do something`,

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
            assistant: `processData with items array of numbers:
    if items is not array then
        throw error "Input must be an array"
    end if
    
    if items is empty then
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
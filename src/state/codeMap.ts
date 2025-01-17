import { VersionedContent } from '../types';

class CodeMapManager {
    private static instance: CodeMapManager;
    private codeMap = new Map<string, VersionedContent>();

    private constructor() {}

    static getInstance(): CodeMapManager {
        if (!CodeMapManager.instance) {
            CodeMapManager.instance = new CodeMapManager();
        }
        return CodeMapManager.instance;
    }

    get(key: string): VersionedContent | undefined {
        return this.codeMap.get(key);
    }

    set(key: string, value: VersionedContent): void {
        this.codeMap.set(key, value);
    }

    has(key: string): boolean {
        return this.codeMap.has(key);
    }

    clear(): void {
        this.codeMap.clear();
    }
}

export const codeMapManager = CodeMapManager.getInstance(); 
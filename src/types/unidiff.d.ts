declare module 'unidiff' {
    export class PatchStream {
        applyPatch(source: string, patch: string): string;
    }
} 
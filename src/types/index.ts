export interface CodeChange {
    type: 'add' | 'delete' | 'modify';
    content: string;
    lineNumber?: number;
}

export interface VersionedContent {
    code: string;
    pseudocode: string;
    lastEditTime: number;
    version: number;
}

export interface ExtractChangesResult {
    changes: CodeChange[];
    hasContentChange: boolean;
} 
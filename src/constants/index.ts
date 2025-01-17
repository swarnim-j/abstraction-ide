// Re-export from other constant files
export { TOGGLE_COMMAND, MODEL_NAME as OPENAI_MODEL, OPEN_WITH_COMMAND, SPLIT_VIEW_COMMAND } from './commands';
export { PSEUDOCODE_SYSTEM_PROMPT, CODE_SYSTEM_PROMPT, PSEUDOCODE_UPDATE_SYSTEM_PROMPT } from './prompts';

// Configuration
export const CONFIG_SECTION = 'abstractionIde';
export const CONFIG_API_KEY = 'openaiApiKey';

// View Types
export const CUSTOM_EDITOR_VIEW_TYPE = 'abstraction-ide.codeView'; 
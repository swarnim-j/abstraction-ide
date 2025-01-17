# Abstraction IDE

A VSCode extension that enables developers to view and edit their code at different levels of abstraction, powered by LLM-based translation between actual code and pseudocode.

## Features

- Toggle between actual code and pseudocode views
- Maintain semantic equivalence between different abstraction levels
- Simple caching to minimize LLM API calls
- Automatic synchronization between views

## Requirements

- Visual Studio Code 1.85.0 or higher
- Mistral API key (get one at https://console.mistral.ai/)

## Setup

1. Install the extension
2. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Enter your Mistral API key when prompted (only needed once)

## Usage

1. Open any code file in VSCode
2. Click the "Code Abstraction" icon in the activity bar or use the command palette to run "Toggle Abstraction View"
3. The file will be converted to pseudocode view
4. Click again to switch back to the original code view

## Extension Settings

* `abstractionIde.mistralApiKey`: Your Mistral API key (stored securely)

## Known Issues

- Currently supports only two levels of abstraction (code and pseudocode)
- Changes in pseudocode view are not yet propagated back to code view
- Limited caching implementation

## Future Improvements

- Support for multiple levels of abstraction
- Bidirectional synchronization between views
- Advanced caching and optimization
- Syntax highlighting for pseudocode
- Custom pseudocode formatting options 
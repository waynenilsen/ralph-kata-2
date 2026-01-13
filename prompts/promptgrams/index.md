# Promptgrams

Promptgrams are structured prompts written as pseudocode with detailed branching instructions. They provide a programmatic way to guide AI assistants through complex workflows.

## Available Promptgrams

| Promptgram | Description |
|------------|-------------|
| [ralph](./ralph.md) | Development workflow loop: fetch, ticket work, PRD creation, cleanup |
| [what-is-a-promptgram](./what-is-a-promptgram.md) | Explanation of the promptgram concept and syntax |

## Syntax

Promptgrams use a simple pseudocode syntax:

- `ref <file>` - Reference another promptgram or document
- `begin` / `end` - Mark the main execution block
- `defer <file>` - Schedule cleanup to run at end regardless of path taken
- `if <condition>` / `if not <condition>` - Conditional branching
- Indentation indicates scope

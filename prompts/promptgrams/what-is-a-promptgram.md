# What is a Promptgram?

A **promptgram** is a prompt written as pseudocode with detailed branching instructions. It provides structured guidance for AI assistants to follow complex workflows programmatically.

## Core Concepts

### Structure
Promptgrams follow a code-like structure with:
- **References** (`ref`) - Link to other promptgrams or documents for context
- **Deferred execution** (`defer`) - Actions that must run at the end regardless of path
- **Conditional logic** (`if`/`if not`) - Branch based on state or conditions
- **Indentation** - Indicates scope and nesting

### Why Promptgrams?

1. **Deterministic workflows** - Clear branching eliminates ambiguity
2. **Composability** - Reference other promptgrams to build complex flows
3. **Stateful reasoning** - Check conditions and adapt behavior
4. **Guaranteed cleanup** - Defer ensures critical steps always run

## Syntax Reference

```
ref <document>           # Load context from another file
begin                    # Start main execution block
defer <document>         # Schedule cleanup (runs at end)
if <condition>           # Conditional branch
    <indented actions>   # Actions within the condition
if not <condition>       # Negative conditional
end                      # End of execution block
```

## Example Pattern

```
ref context.md

begin

defer cleanup.md

check some_state

if state_is_good
    do_the_thing (ref how-to-do-thing.md)

if not state_is_good
    fix_the_state (ref fixing-state.md)

at end ALWAYS cleanup.md
```

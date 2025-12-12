# Ouroboros Input Standards

> **Version**: 1.0
> **Last Updated**: 2025-12-12
> **Purpose**: Define standard input command formats for the CCL system

---

## Quick Reference

| Type | Variable | Standard Format |
|------|----------|-----------------|
| **A** | `task` | `python -c "task = input('[Ouroboros] > ')"` |
| **B** | `choice` | `python -c "print('\\n[1] X\\n[2] Y'); choice = input('Choice (1-N): ')"` |
| **C** | `feature` | `python -c "feature = input('Feature name: ')"` |
| **D** | `confirm` | `python -c "confirm = input('[y/n]: ')"` |
| **E** | `question` | `python -c "question = input('Question: ')"` |

---

## Type A: Standard CCL Input

**Purpose**: Main task entry point for the Ouroboros CCL loop.

```python
python -c "task = input('[Ouroboros] > ')"
```

**Rules**:
- Variable MUST be `task`
- Prompt MUST be `[Ouroboros] > ` (with space after `>`)
- Used as fallback in all agent files

---

## Type B: Menu Selection

**Purpose**: Present numbered options for user selection.

### Standard Format

```python
# Two options
python -c "print('\\n[1] Option A\\n[2] Option B'); choice = input('Choice (1-2): ')"

# Three options
python -c "print('\\n[1] Option A\\n[2] Option B\\n[3] Option C'); choice = input('Choice (1-3): ')"

# N options
python -c "print('\\n[1] Option A\\n[2] Option B\\n...\\n[N] Option N'); choice = input('Choice (1-N): ')"
```

**Rules**:
- Variable MUST be `choice`
- Options MUST use `[1]`, `[2]`, `[3]` format (numbers only, no letters)
- Each option on its own line with `\\n`
- Prompt MUST end with `Choice (1-N):` showing valid range
- NO text options like `[all]` or `[clean]` - use numbers

### ❌ Forbidden Formats

```python
# WRONG: Letters instead of numbers
python -c "print('[a] X [b] Y'); choice = input('Choice: ')"

# WRONG: Text options
python -c "print('[all] Archive all [clean] Cleanup'); choice = input('Choice: ')"

# WRONG: Missing range in prompt
python -c "print('[1] X [2] Y'); choice = input('Choice: ')"

# WRONG: Using parentheses
python -c "print('1) X\\n2) Y'); choice = input('Choice: ')"
```

---

## Type C: Free-form Input

**Purpose**: Collect free-form text input (names, descriptions, etc.)

### Standard Format

```python
python -c "feature = input('Feature name: ')"
```

**Rules**:
- Variable: `feature`, `name`, or context-appropriate
- Prompt should be descriptive but concise
- End with `: ` (colon space)

### Examples

```python
# Feature naming
python -c "feature = input('Feature name: ')"

# Project naming
python -c "name = input('Project name: ')"

# Description
python -c "desc = input('Description: ')"
```

---

## Type D: Confirmation

**Purpose**: Yes/No confirmation before actions.

### Standard Format

```python
# Simple confirmation
python -c "confirm = input('[y/n]: ')"

# With context message
python -c "print('Ready to proceed?'); confirm = input('[y/n]: ')"
```

**Rules**:
- Variable MUST be `confirm` (not `choice`)
- Prompt MUST be `[y/n]: `
- Context can be added with `print()` before
- Accepted values: `y`, `Y`, `yes`, `n`, `N`, `no`

### ❌ Forbidden Formats

```python
# WRONG: Using 'choice' variable
python -c "choice = input('[y/n]: ')"

# WRONG: Different prompt format
python -c "confirm = input('Yes/No: ')"
```

---

## Type E: Question Input

**Purpose**: Collect questions from user.

### Standard Format

```python
python -c "question = input('Question: ')"

# Alternative for help context
python -c "question = input('How can I help you? ')"
```

**Rules**:
- Variable MUST be `question`
- Prompt should be friendly/inviting

---

## Enhanced Mode Mappings

When enhanced mode is enabled, these commands map to:

| Type | Enhanced Command |
|------|------------------|
| A | `python .ouroboros/scripts/ouroboros_input.py` |
| B | `python .ouroboros/scripts/ouroboros_input.py --header "MENU" --prompt "Choice (1-N):" --var choice` |
| C | `python .ouroboros/scripts/ouroboros_input.py --prompt "Feature name:" --var feature` |
| D | `python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui` |
| E | `python .ouroboros/scripts/ouroboros_input.py --prompt "Question:" --var question` |

---

## Regex Patterns for Toggle Script

```python
PATTERNS = {
    # Type A: Standard CCL
    'A': r'python -c "task = input\(\'\\[Ouroboros\\] > \'\)"',
    
    # Type B: Menu selection (captures menu text)
    'B': r'python -c "print\(\'([^\']+)\'\); choice = input\(\'([^\']+)\'\)"',
    
    # Type C: Free-form (captures prompt text)
    'C': r'python -c "(\w+) = input\(\'([^\']+)\'\)"',
    
    # Type D: Confirmation
    'D': r'python -c "confirm = input\(\'\\[y/n\\]: \'\)"',
    
    # Type E: Question
    'E': r'python -c "question = input\(\'([^\']+)\'\)"',
}
```

---

## Compliance Checklist

When adding new input commands:

- [ ] Use correct variable name for type
- [ ] Use standard prompt format
- [ ] For menus: use numbers `[1]`, `[2]`, include range in prompt
- [ ] For confirmations: use `confirm` variable, `[y/n]:` prompt
- [ ] Test that enhanced mode toggle can parse the command

---

*Document created 2025-12-12. Update when adding new input patterns.*

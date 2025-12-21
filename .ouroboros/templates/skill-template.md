---
name: {{skill-name}}
description: {{A specific description of WHAT this skill does and WHEN to use it. Include keywords that help agents match tasks. Max 1024 chars.}}
# --- OPTIONAL FIELDS (uncomment as needed) ---
# license: MIT
# compatibility: Requires Python 3.9+, network access
# metadata:
#   author: your-name
#   version: "1.0"
# allowed-tools: Bash(git:*) Read
---

<!--
  AGENT SKILLS TEMPLATE - Based on agentskills.io Specification
  
  ═══════════════════════════════════════════════════════════════
  NAMING RULES (name field):
  ═══════════════════════════════════════════════════════════════
  - Lowercase letters, numbers, and hyphens ONLY (a-z, 0-9, -)
  - Maximum 64 characters
  - Must NOT start or end with hyphen
  - Must NOT contain consecutive hyphens (--)
  - MUST match the parent directory name
  
  ═══════════════════════════════════════════════════════════════
  DIRECTORY STRUCTURE:
  ═══════════════════════════════════════════════════════════════
  .github/skills/{{skill-name}}/
  ├── SKILL.md          # Required: this file
  ├── scripts/          # Optional: executable code (Python, Bash, JS)
  ├── references/       # Optional: additional docs (REFERENCE.md, etc.)
  └── assets/           # Optional: templates, images, data files
  
  ═══════════════════════════════════════════════════════════════
  PROGRESSIVE LOADING (how agents consume skills):
  ═══════════════════════════════════════════════════════════════
  - Level 1: Agent reads ONLY name + description (~100 tokens)
  - Level 2: When matched, agent loads full SKILL.md (< 5000 tokens)
  - Level 3: Resources loaded only when explicitly referenced
  
  ═══════════════════════════════════════════════════════════════
  BEST PRACTICES:
  ═══════════════════════════════════════════════════════════════
  - Keep SKILL.md under 500 lines
  - Move detailed docs to references/ folder
  - File references should be ONE level deep (avoid nesting)
  - Description should include specific keywords for matching
-->

# {{Skill Name}}

> **STATUS**: Active

## When to Use This Skill

Use this skill when:
- {{Scenario 1 where this skill applies}}
- {{Scenario 2 where this skill applies}}

Do NOT use this skill when:
- {{Scenario where this skill should NOT be applied}}

## Instructions

### Step 1: {{First Step}}

{{Detailed instructions for step 1}}

### Step 2: {{Second Step}}

{{Detailed instructions for step 2}}

## Examples

### Input

```{{language}}
{{Example input}}
```

### Expected Output

```{{language}}
{{Example output}}
```

## Common Edge Cases

- **{{Edge case 1}}**: {{How to handle it}}
- **{{Edge case 2}}**: {{How to handle it}}

## Resources

<!-- Reference files in this skill's directory using relative paths -->
<!-- Keep references ONE level deep -->

- [Reference Guide](references/REFERENCE.md) - {{Description}}
- [Helper Script](scripts/helper.py) - {{Description}}

## Checklist

- [ ] {{Verification step 1}}
- [ ] {{Verification step 2}}

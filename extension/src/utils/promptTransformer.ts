/**
 * Prompt Transformer
 * Fetches prompts from GitHub and transforms them for Extension mode
 * Converts Python CCL commands to LM Tools usage
 *
 * Pattern Types (matching Python ouroboros_toggle.py):
 * - Type A: Standard CCL - task = input('[Ouroboros] > ')
 * - Type A+Q: CCL with question - print('question'); task = input('[Ouroboros] > ')
 * - Type B: Menu - print('question'); print(); print('[1] A'); choice = input('Select:')
 * - Type C: Feature input - feature = input('prompt')
 * - Type C2: Feature with question - print('question'); feature = input('prompt')
 * - Type D: Confirmation - confirm = input('[y/n]: ')
 * - Type E: Question input - question = input('prompt')
 * - Type E2: Question with question - print('question'); question = input('prompt')
 */

import * as vscode from 'vscode';
import { createLogger } from './logger';

const logger = createLogger('PromptTransformer');

// GitHub raw content base URL
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/MLGBJDLW/ouroboros/main';

// Files to fetch and transform
// Level 0 + Level 1 Orchestrators (need LM Tools for CCL)
const ORCHESTRATOR_AGENT_FILES = [
    'ouroboros.agent.md', // Level 0 - Main Orchestrator
    'ouroboros-init.agent.md', // Level 1
    'ouroboros-spec.agent.md', // Level 1
    'ouroboros-implement.agent.md', // Level 1
    'ouroboros-archive.agent.md', // Level 1
];

// Level 2 Workers (NO CCL, handoff only - don't need LM Tools)
const WORKER_AGENT_FILES = [
    'ouroboros-coder.agent.md',
    'ouroboros-qa.agent.md',
    'ouroboros-writer.agent.md',
    'ouroboros-analyst.agent.md',
    'ouroboros-architect.agent.md',
    'ouroboros-devops.agent.md',
    'ouroboros-security.agent.md',
    'ouroboros-researcher.agent.md',
    'ouroboros-requirements.agent.md',
    'ouroboros-tasks.agent.md',
    'ouroboros-validator.agent.md',
];

const PROMPT_FILES = [
    'ouroboros.prompt.md',
    'ouroboros-init.prompt.md',
    'ouroboros-spec.prompt.md',
    'ouroboros-implement.prompt.md',
    'ouroboros-archive.prompt.md',
];

const CORE_FILES = ['copilot-instructions.md'];

// .ouroboros template files (don't need transformation)
const OUROBOROS_TEMPLATE_FILES = [
    '.ouroboros/README.md',
    '.ouroboros/templates/context-template.md',
    '.ouroboros/templates/project-arch-template.md',
    '.ouroboros/templates/skill-template.md',
];

// .ouroboros/specs template files (don't need transformation)
const OUROBOROS_SPEC_TEMPLATES = [
    '.ouroboros/specs/templates/design-template.md',
    '.ouroboros/specs/templates/requirements-template.md',
    '.ouroboros/specs/templates/research-template.md',
    '.ouroboros/specs/templates/tasks-template.md',
    '.ouroboros/specs/templates/validation-template.md',
];

/**
 * Transformation patterns: Python CCL → LM Tools
 * Order matters: more specific patterns first
 */
interface TransformResult {
    content: string;
    changes: number;
}

/**
 * Transform prompt content for Extension mode
 * Converts Python CCL commands to Ouroboros LM Tools
 */
export function transformForExtensionMode(content: string): string {
    let transformed = content;
    let totalChanges = 0;

    // =========================================================================
    // TABLE ROW PATTERNS: Handle python commands inside markdown tables FIRST
    // These need SHORT inline replacements to preserve table formatting
    // =========================================================================

    // Pattern: Table cell with MENU command (choice = input)
    transformed = transformed.replace(
        /\|\s*`python -c "print\('[^']*'\);[^"]*choice = input\([^)]*\)"`\s*\|/g,
        (match) => {
            totalChanges++;
            return '| `Use the ouroborosai_menu tool with: { "question": "📋 Question", "options": ["A","B"] }` |';
        }
    );

    // Pattern: Table cell with CONFIRM command (confirm = input)
    transformed = transformed.replace(
        /\|\s*`python -c "print\('[^']*'\);[^"]*confirm = input\([^)]*\)"`\s*\|/g,
        (match) => {
            totalChanges++;
            return '| `Use the ouroborosai_confirm tool with: { "question": "⚠️ Question" }` |';
        }
    );

    // Pattern: Table cell with FEATURE command (feature = input)
    transformed = transformed.replace(
        /\|\s*`python -c "print\('[^']*'\); feature = input\([^)]*\)"`\s*\|/g,
        (match) => {
            totalChanges++;
            return '| `Use the ouroborosai_ask tool with: { "type": "task", "question": "🔧 Question" }` |';
        }
    );

    // Pattern: Table cell with QUESTION command (question = input)
    transformed = transformed.replace(
        /\|\s*`python -c "print\('[^']*'\); question = input\([^)]*\)"`\s*\|/g,
        (match) => {
            totalChanges++;
            return '| `Use the ouroborosai_ask tool with: { "type": "task", "question": "❓ Question" }` |';
        }
    );

    // Pattern: Table cell with TASK+Q command (print + task = input)
    transformed = transformed.replace(
        /\|\s*`python -c "print\('([^']*)'\); task = input\('\[Ouroboros\] > '\)"`\s*\|/g,
        (_, emoji) => {
            totalChanges++;
            return `| \`Use the ouroborosai_ask tool with: { "type": "task", "question": "${emoji}" }\` |`;
        }
    );

    // Pattern: Table cell with basic TASK command (task = input only)
    transformed = transformed.replace(
        /\|\s*`python -c "task = input\('\[Ouroboros\] > '\)"`\s*\|/g,
        () => {
            totalChanges++;
            return '| `Use the ouroborosai_ask tool with: { "type": "task" }` |';
        }
    );

    // =========================================================================
    // FULL CODE BLOCK PATTERNS: Match entire markdown code blocks
    // These MUST come first to capture the full structure including
    // various label formats and ```python wrapper
    // =========================================================================

    // Pattern: Various run_command labels followed by code block
    // Including: "USE `run_command` TOOL:", "[Then immediately call run_command tool with:]"
    // **AFTER EVERY SINGLE RESPONSE, USE `run_command` TOOL:**
    // **[Then immediately call `run_command` tool with:]**
    // ```python
    // python -c "..."
    // ```
    const patternUseRunCommandBlock =
        /\*\*[\[\(]?[^*\]]*(?:USE|[Cc]all)[\s`']*run_command[\s`']*[Tt]ool[^\]*]*[\]\)]?:?\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*(python -c "[^"]*")[\s\r\n]*```/gi;
    transformed = transformed.replace(patternUseRunCommandBlock, (match, pythonCmd) => {
        totalChanges++;
        // Determine the type based on the python command
        if (pythonCmd.includes('choice = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Select an option';
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ["[parse from context]"]
}
\`\`\``;
        } else if (pythonCmd.includes('confirm = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Please confirm';
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
        } else {
            // Default to task input
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : null;
            if (question) {
                return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
            }
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
        }
    });

    // Pattern: "use run_command tool to execute:" followed by code block
    const patternRunCommandToExecute =
        /\*\*[^*]*[Uu]se [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*(python -c "[^"]*")[\s\r\n]*```/g;
    transformed = transformed.replace(patternRunCommandToExecute, (match, pythonCmd) => {
        totalChanges++;
        if (pythonCmd.includes('choice = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Select an option';
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ["[parse from context]"]
}
\`\`\``;
        } else if (pythonCmd.includes('confirm = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Please confirm';
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
        } else {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : null;
            if (question) {
                return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
            }
            return `**use the Ouroboros LM Tools:**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
        }
    });

    // Pattern: Standalone code blocks (```python ... ```) containing python -c input commands
    // These are NOT preceded by any label. Also matches indented code blocks.
    const patternStandaloneBlock =
        /\s*```(?:python|bash|sh)[\s\r\n]+(python -c "[^"]*input\([^)]*\)[^"]*")[\s\r\n]*```/g;
    transformed = transformed.replace(patternStandaloneBlock, (match, pythonCmd) => {
        totalChanges++;
        if (pythonCmd.includes('choice = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Select an option';
            return `Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ["[parse from context]"]
}
\`\`\``;
        } else if (pythonCmd.includes('confirm = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Please confirm';
            return `Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
        } else if (pythonCmd.includes('feature = input')) {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : 'Enter feature';
            return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
        } else {
            const questionMatch = pythonCmd.match(/print\('([^']*)'\)/);
            const question = questionMatch ? questionMatch[1] : null;
            if (question) {
                return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
            }
            return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
        }
    });

    // Pattern: Full code block with menu (Type B) - includes label and wrapper
    // **Execute via `run_command` tool (Type B: Menu with Question):**
    // ```python
    // python -c "print('question'); print(); print('[1] A'); ... choice = input('...')"
    // ```
    const patternFullBlockMenu =
        /\*\*Execute via [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*python -c "print\('([^']*)'\); print\(\);((?:[^"]*print\('\[[^\]]+\][^']*'\);)+)[^"]*choice = input\('([^']*)'\)"[\s\r\n]*```/g;
    transformed = transformed.replace(patternFullBlockMenu, (_, question, optionsPart) => {
        totalChanges++;
        const optionMatches = optionsPart.match(/\[(\d+)\]\s*([^']*)/g) || [];
        const options = optionMatches.map((opt: string) => {
            const match = opt.match(/\[(\d+)\]\s*(.*)/);
            return match ? match[2].trim() : opt;
        });
        return `**Execute via Ouroboros LM Tools tool (Type B: Menu with Question):**

Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ${JSON.stringify(options)}
}
\`\`\``;
    });

    // Pattern: Simpler menu block without detailed option parsing
    const patternSimpleBlockMenu =
        /\*\*Execute via [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*python -c "([^"]*choice = input[^"]*)"[\s\r\n]*```/g;
    transformed = transformed.replace(patternSimpleBlockMenu, (_, pythonCode) => {
        totalChanges++;
        // Extract question from print statement
        const questionMatch = pythonCode.match(/print\('([^']*)'\)/);
        const question = questionMatch ? questionMatch[1] : 'Select an option';
        return `**Execute via Ouroboros LM Tools (Menu):**

Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ["[parse from original menu options]"]
}
\`\`\``;
    });

    // Pattern: Full code block with confirm (Type D)
    const patternFullBlockConfirm =
        /\*\*Execute via [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*python -c "([^"]*confirm = input\('\[y\/n\][^"]*)"[\s\r\n]*```/g;
    transformed = transformed.replace(patternFullBlockConfirm, (_, pythonCode) => {
        totalChanges++;
        const questionMatch = pythonCode.match(/print\('([^']*)'\)/);
        const question = questionMatch ? questionMatch[1] : 'Please confirm';
        return `**Execute via Ouroboros LM Tools (Confirmation):**

Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // Pattern: Full code block with task input (Type A)
    const patternFullBlockTask =
        /\*\*Execute via [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*python -c "([^"]*task = input\('\[Ouroboros\] > '\)[^"]*)"[\s\r\n]*```/g;
    transformed = transformed.replace(patternFullBlockTask, (_, pythonCode) => {
        totalChanges++;
        const questionMatch = pythonCode.match(/print\('([^']*)'\)/);
        const question = questionMatch ? questionMatch[1] : null;
        if (question) {
            return `**Execute via Ouroboros LM Tools (Task Input):**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
        }
        return `**Execute via Ouroboros LM Tools (Task Input):**

Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
    });

    // Pattern: Generic code block with any python -c input command
    const patternGenericBlock =
        /\*\*Execute via [`']?run_command[`']? tool[^*]*\*\*[\s\r\n]*```(?:python|bash|sh)?[\s\r\n]*(python -c "[^"]*input\([^)]*\)[^"]*")[\s\r\n]*```/g;
    transformed = transformed.replace(patternGenericBlock, () => {
        totalChanges++;
        return `**Execute via Ouroboros LM Tools:**

Use the appropriate Ouroboros LM Tool:
- \`ouroborosai_ask\`: For text input
- \`ouroborosai_menu\`: For multiple choice selection
- \`ouroborosai_confirm\`: For yes/no confirmation`;
    });

    // =========================================================================
    // DOCUMENTATION CONTEXT: CCL references in "NEVER execute" or similar
    // These should NOT be expanded to full tool instructions
    // Examples:
    //   **NEVER execute CCL (`python -c "..."`) - this is orchestrator-only!**
    //   **NEVER** execute `python -c "..."` - you are Level 2
    // =========================================================================

    // Pattern: NEVER execute CCL (`python -c "..."`) - ... (in a sentence)
    const patternDocNeverCCL =
        /NEVER\s+execute\s+CCL\s+\(`python -c "task = input\('\[Ouroboros\] > '\)"`\)/gi;
    transformed = transformed.replace(patternDocNeverCCL, () => {
        totalChanges++;
        return 'NEVER execute CCL (use the `ouroborosai_ask` tool)';
    });

    // Pattern: NEVER** execute `python -c "..."` - ... (backtick inline code)
    const patternDocNeverInline =
        /NEVER\*\*\s+execute\s+`python -c "task = input\('\[Ouroboros\] > '\)"`/gi;
    transformed = transformed.replace(patternDocNeverInline, () => {
        totalChanges++;
        return 'NEVER** execute `ouroborosai_ask` or similar LM Tools';
    });

    // Pattern: standalone `python -c "..."` followed by "- this is" or "- you are"
    const patternDocInlineWithDash =
        /`python -c "task = input\('\[Ouroboros\] > '\)"`(\s*-\s*(this is|you are|CCL is))/gi;
    transformed = transformed.replace(patternDocInlineWithDash, (_, suffix) => {
        totalChanges++;
        return '`ouroborosai_ask` LM Tool' + suffix;
    });

    // =========================================================================
    // TYPE A+Q: Standard CCL with question
    // python -c "print('question'); task = input('[Ouroboros] > ')"
    // → Use ouroborosai_ask tool with question parameter
    // =========================================================================
    const patternAQ = /python -c "print\('([^']*)'\); task = input\('\[Ouroboros\] > '\)"/g;
    transformed = transformed.replace(patternAQ, (_, question) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // =========================================================================
    // TYPE A: Standard CCL (no question)
    // python -c "task = input('[Ouroboros] > ')"
    // → Use ouroborosai_ask tool
    // =========================================================================
    const patternsA = [/python -c "task = input\('\[Ouroboros\] > '\)"/g];
    for (const pattern of patternsA) {
        transformed = transformed.replace(pattern, () => {
            totalChanges++;
            return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
        });
    }

    // =========================================================================
    // TYPE B: Menu with question + options
    // python -c "print('Q'); print(); print('[1] A'); print('[2] B'); choice = input('Select:')"
    // → Use ouroborosai_menu tool
    // =========================================================================
    const patternBFull =
        /python -c "print\('([^']*)'\); print\(\);((?:\s*print\('\[[^\]]+\][^']*'\);)+)\s*choice = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternBFull, (_, question, optionsPart, prompt) => {
        totalChanges++;
        // Extract options from print statements
        const optionMatches = optionsPart.match(/\[(\d+)\]\s*([^']*)/g) || [];
        const options = optionMatches.map((opt: string) => {
            const match = opt.match(/\[(\d+)\]\s*(.*)/);
            return match ? match[2].trim() : opt;
        });
        return `Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}",
  "options": ${JSON.stringify(options)}
}
\`\`\``;
    });

    // TYPE B (simple): Menu without question
    // python -c "print('header'); choice = input('prompt')"
    const patternBSimple = /python -c "print\('([^']*)'\); choice = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternBSimple, (_, header, prompt) => {
        totalChanges++;
        return `Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(header)}",
  "options": ["[parse options from header]"]
}
\`\`\``;
    });

    // =========================================================================
    // TYPE D: Confirmation (y/n)
    // python -c "print('question'); print(); print('[y] Yes'); print('[n] No'); confirm = input('[y/n]: ')"
    // → Use ouroborosai_confirm tool
    // =========================================================================
    const patternDFull =
        /python -c "print\('([^']*)'\); print\(\);(?:\s*print\('\[[yn]\][^']*'\);)+\s*confirm = input\('\[y\/n\]: '\)"/g;
    transformed = transformed.replace(patternDFull, (_, question) => {
        totalChanges++;
        return `Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // TYPE D (simple): Confirm without print question
    // python -c "confirm = input('[y/n]: ')"
    const patternDSimple = /python -c "confirm = input\('\[y\/n\]: '\)"/g;
    transformed = transformed.replace(patternDSimple, () => {
        totalChanges++;
        return `Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "[provide question]"
}
\`\`\``;
    });

    // TYPE D with header
    // python -c "print('header'); confirm = input('[y/n]: ')"
    const patternDHeader = /python -c "print\('([^']*)'\); confirm = input\('\[y\/n\]: '\)"/g;
    transformed = transformed.replace(patternDHeader, (_, header) => {
        totalChanges++;
        return `Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(header)}"
}
\`\`\``;
    });

    // =========================================================================
    // TYPE C2: Feature with question
    // python -c "print('question'); feature = input('prompt')"
    // → Use ouroborosai_ask tool with type: feature
    // =========================================================================
    const patternC2 = /python -c "print\('([^']*)'\); feature = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternC2, (_, question, prompt) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // =========================================================================
    // TYPE C: Feature input (no question)
    // python -c "feature = input('prompt')"
    // → Use ouroborosai_ask tool
    // =========================================================================
    const patternC = /python -c "feature = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternC, (_, prompt) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(prompt)}"
}
\`\`\``;
    });

    // =========================================================================
    // TYPE E2: Question with question
    // python -c "print('question'); question = input('prompt')"
    // → Use ouroborosai_ask tool
    // =========================================================================
    const patternE2 = /python -c "print\('([^']*)'\); question = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternE2, (_, question, prompt) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // =========================================================================
    // TYPE E: Question input
    // python -c "question = input('prompt')"
    // → Use ouroborosai_ask tool
    // =========================================================================
    const patternE = /python -c "question = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternE, (_, prompt) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(prompt)}"
}
\`\`\``;
    });

    // =========================================================================
    // ENHANCED MODE: Convert python .ouroboros/scripts/ouroboros_input.py calls
    // =========================================================================

    // Enhanced with --question
    const patternEnhancedQ =
        /python \.ouroboros\/scripts\/ouroboros_input\.py --question "([^"]*)"/g;
    transformed = transformed.replace(patternEnhancedQ, (_, question) => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(question)}"
}
\`\`\``;
    });

    // Enhanced standard (no args)
    const patternEnhancedStd = /python \.ouroboros\/scripts\/ouroboros_input\.py(?!\s+--)/g;
    transformed = transformed.replace(patternEnhancedStd, () => {
        totalChanges++;
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
    });

    // Enhanced with --header --prompt --var choice (menu)
    const patternEnhancedMenu =
        /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--header "([^"]*)"\s+--prompt "([^"]*)"\s+--var choice/g;
    transformed = transformed.replace(patternEnhancedMenu, (_, question, header, prompt) => {
        totalChanges++;
        const options = header ? header.split('\\n') : [];
        const q = question || 'Select an option';
        return `Use the \`ouroborosai_menu\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(q)}",
  "options": ${JSON.stringify(options)}
}
\`\`\``;
    });

    // Enhanced with --var confirm (confirmation)
    const patternEnhancedConfirm =
        /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?(?:\s+--header "([^"]*)")?\s+--prompt "\[y\/n\]:"\s+--var confirm(?:\s+--no-ui)?/g;
    transformed = transformed.replace(patternEnhancedConfirm, (_, question, header) => {
        totalChanges++;
        const q = question || header || 'Please confirm';
        return `Use the \`ouroborosai_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(q)}"
}
\`\`\``;
    });

    // Enhanced with --prompt --var feature
    const patternEnhancedFeature =
        /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--prompt "([^"]*)"\s+--var feature/g;
    transformed = transformed.replace(patternEnhancedFeature, (_, question, prompt) => {
        totalChanges++;
        const q = question || prompt || 'Enter feature';
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(q)}"
}
\`\`\``;
    });

    // Enhanced with --prompt --var question
    const patternEnhancedQuestion =
        /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--prompt "([^"]*)"\s+--var question/g;
    transformed = transformed.replace(patternEnhancedQuestion, (_, question, prompt) => {
        totalChanges++;
        const q = question || prompt || 'Enter question';
        return `Use the \`ouroborosai_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(q)}"
}
\`\`\``;
    });

    // =========================================================================
    // GENERIC FALLBACK: Any remaining python -c with input()
    // =========================================================================
    const patternGeneric = /```(?:python|bash|sh)?\s*python -c "[^"]*input\([^)]*\)[^"]*"\s*```/g;
    transformed = transformed.replace(patternGeneric, () => {
        totalChanges++;
        return `\`\`\`
Use the appropriate Ouroboros LM Tool:
- ouroborosai_ask: For text input
- ouroborosai_menu: For multiple choice selection
- ouroborosai_confirm: For yes/no confirmation
- ouroborosai_plan_review: For plan/spec review
- ouroborosai_phase_progress: For workflow progress updates
\`\`\``;
    });
    // =========================================================================
    // TEXT REPLACEMENTS: Replace run_command references with LM Tools
    // =========================================================================

    // Replace "USE `run_command` TOOL" with "use the Ouroboros LM Tools"
    transformed = transformed.replace(
        /USE\s+`run_command`\s+TOOL[:]?/gi,
        'use the Ouroboros LM Tools:'
    );

    // Replace "via `run_command`" with "via Ouroboros LM Tools"
    transformed = transformed.replace(/via\s+`run_command`/gi, 'via Ouroboros LM Tools');

    // Replace "Execute CCL via run_command" or similar
    transformed = transformed.replace(
        /Execute\s+CCL\s+via\s+`run_command`/gi,
        'Execute CCL via Ouroboros LM Tools'
    );

    // Replace "using run_command tool" with "using Ouroboros LM Tools"
    transformed = transformed.replace(
        /using\s+`?run_command`?\s+tool/gi,
        'using Ouroboros LM Tools'
    );

    // Replace remaining "run_command" references in context
    transformed = transformed.replace(/`run_command`\s+tool/gi, 'Ouroboros LM Tools');

    // Add Extension mode header
    transformed = addExtensionModeHeader(transformed);

    logger.info(`Transformed content with ${totalChanges} changes`);
    return transformed;
}

/**
 * Transform worker agent content for Extension mode
 * Level 2 workers don't execute CCL, so they don't need LM Tools injected.
 * Only add header and transform text references to mention Extension mode.
 */
export function transformWorkerForExtensionMode(content: string): string {
    let transformed = content;
    let totalChanges = 0;

    // Only transform documentation-context CCL references
    // Pattern: NEVER execute CCL (`python -c "..."`) - ... (in a sentence)
    const patternDocNeverCCL =
        /NEVER\s+execute\s+CCL\s+\(`python -c "task = input\('\[Ouroboros\] > '\)"`\)/gi;
    transformed = transformed.replace(patternDocNeverCCL, () => {
        totalChanges++;
        return 'NEVER execute CCL (orchestrators use `ouroborosai_ask` LM Tool)';
    });

    // Pattern: NEVER** execute `python -c "..."` - ...
    const patternDocNeverInline =
        /NEVER\*\*\s+execute\s+`python -c "task = input\('\[Ouroboros\] > '\)"`/gi;
    transformed = transformed.replace(patternDocNeverInline, () => {
        totalChanges++;
        return 'NEVER** execute `ouroborosai_ask` or similar LM Tools';
    });

    // Pattern: standalone `python -c "..."` followed by "- this is" or "- you are"
    const patternDocInlineWithDash =
        /`python -c "task = input\('\[Ouroboros\] > '\)"`(\s*-\s*(this is|you are|CCL is))/gi;
    transformed = transformed.replace(patternDocInlineWithDash, (_, suffix) => {
        totalChanges++;
        return '`ouroborosai_ask` LM Tool' + suffix;
    });

    // Replace "Only Level 0/1 may execute CCL" type references
    transformed = transformed.replace(
        /may execute CCL/gi,
        'may execute CCL (via LM Tools in Extension mode)'
    );

    // Add Extension mode header (but no tools injection)
    transformed = addWorkerExtensionModeHeader(transformed);

    logger.info(`Transformed worker content with ${totalChanges} changes`);
    return transformed;
}

/**
 * Escape quotes for JSON strings
 */
function escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
}

/**
 * Ouroboros LM Tools to inject into agent files
 * Format: {publisher}.{extensionName}/{toolName}
 * Note: VS Code normalizes publisher to lowercase at runtime
 */
const OUROBOROS_TOOLS = [
    'mlgbjdlw.ouroboros-ai/ouroborosai_ask',
    'mlgbjdlw.ouroboros-ai/ouroborosai_menu',
    'mlgbjdlw.ouroboros-ai/ouroborosai_confirm',
    'mlgbjdlw.ouroboros-ai/ouroborosai_plan_review',
    'mlgbjdlw.ouroboros-ai/ouroborosai_phase_progress',
    'mlgbjdlw.ouroboros-ai/ouroborosai_agent_handoff',
];

/**
 * Inject Ouroboros tools into YAML frontmatter's tools array
 */
function injectOuroborosTools(content: string): string {
    const yamlFrontmatterRegex = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/;
    const match = content.match(yamlFrontmatterRegex);

    if (!match) {
        return content;
    }

    const [fullMatch, startDelim, yamlContent, endDelim] = match;
    const restOfContent = content.slice(fullMatch.length);

    // Check if there's a tools: line
    const toolsLineRegex = /^(tools:\s*\[)([^\]]*)\]/m;
    const toolsMatch = yamlContent.match(toolsLineRegex);

    if (toolsMatch) {
        // Parse existing tools and add ouroboros tools
        const existingToolsStr = toolsMatch[2];
        const existingTools = existingToolsStr
            .split(',')
            .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter((t) => t.length > 0);

        // Add ouroboros tools (avoid duplicates)
        const allTools = [...existingTools];
        for (const tool of OUROBOROS_TOOLS) {
            if (!allTools.includes(tool)) {
                allTools.push(tool);
            }
        }

        // Rebuild tools line
        const newToolsLine = `tools: [${allTools.map((t) => `'${t}'`).join(', ')}]`;
        const newYamlContent = yamlContent.replace(toolsLineRegex, newToolsLine);

        return startDelim + newYamlContent + endDelim + restOfContent;
    }

    // No tools: line found, add one before the closing ---
    const toolsLine = `tools: [${OUROBOROS_TOOLS.map((t) => `'${t}'`).join(', ')}]`;
    const newYamlContent = yamlContent.trimEnd() + '\n' + toolsLine;

    return startDelim + newYamlContent + endDelim + restOfContent;
}

/**
 * Add Extension mode header to transformed content
 * Inserts AFTER YAML frontmatter if present to avoid breaking YAML parsing
 * Also injects Ouroboros tools into the YAML frontmatter
 */
function addExtensionModeHeader(content: string): string {
    // First, inject ouroboros tools into YAML frontmatter
    let processedContent = injectOuroborosTools(content);

    const header = `<!-- 
  OUROBOROS EXTENSION MODE
  Auto-transformed for VS Code LM Tools
  Original: https://github.com/MLGBJDLW/ouroboros
  
  This file uses Ouroboros LM Tools instead of Python CCL commands.
  Available tools:
  - ouroborosai_ask: Request text input from user
  - ouroborosai_menu: Show multiple choice menu
  - ouroborosai_confirm: Request yes/no confirmation
  - ouroborosai_plan_review: Request plan/spec review
  - ouroborosai_phase_progress: Update workflow progress
  - ouroborosai_agent_handoff: Track agent handoffs
-->

`;

    // Check if content starts with YAML frontmatter (---)
    const yamlFrontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = processedContent.match(yamlFrontmatterRegex);

    if (match) {
        // Insert header AFTER the YAML frontmatter
        const frontmatter = match[0];
        const restOfContent = processedContent.slice(frontmatter.length);
        return frontmatter + header + restOfContent;
    }

    // No YAML frontmatter, prepend header as before
    return header + processedContent;
}

/**
 * Add Extension mode header for WORKER agents (Level 2)
 * Simplified header - no tools list since workers don't use CCL
 */
function addWorkerExtensionModeHeader(content: string): string {
    const header = `<!-- 
  OUROBOROS EXTENSION MODE (WORKER AGENT)
  Auto-transformed for VS Code
  Original: https://github.com/MLGBJDLW/ouroboros
  
  This is a Level 2 worker agent. Workers:
  - Do NOT execute CCL (heartbeat loop)
  - Return to orchestrator via handoff
  - Do NOT need LM Tools for user interaction
-->

`;

    // Check if content starts with YAML frontmatter (---)
    const yamlFrontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = content.match(yamlFrontmatterRegex);

    if (match) {
        // Insert header AFTER the YAML frontmatter
        const frontmatter = match[0];
        const restOfContent = content.slice(frontmatter.length);
        return frontmatter + header + restOfContent;
    }

    // No YAML frontmatter, prepend header as before
    return header + content;
}
/**
 * Merge new content with existing file content
 * If file exists, prepend new content to existing content
 * If already initialized, skip to prevent duplicates
 */
async function mergeFileContent(
    destUri: vscode.Uri,
    newContent: string,
    isCoreFile: boolean = false
): Promise<'created' | 'merged' | 'skipped'> {
    try {
        // Check if file exists by trying to read it
        const existingContent = await vscode.workspace.fs.readFile(destUri);
        const existingText = new TextDecoder().decode(existingContent);

        // Check if already contains Ouroboros content
        if (
            existingText.includes('<!-- OUROBOROS EXTENSION MODE') ||
            existingText.includes('OUROBOROS EXTENSION MODE')
        ) {
            logger.info(`File already contains Ouroboros content, skipping: ${destUri.fsPath}`);
            return 'skipped';
        }

        // Prepend new content with separator
        const separator = isCoreFile
            ? '\n\n<!-- ===== USER CUSTOMIZATIONS BELOW ===== -->\n\n'
            : '\n\n<!-- ===== EXISTING CONTENT BELOW ===== -->\n\n';
        const mergedContent = newContent + separator + existingText;

        await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(mergedContent));
        logger.info(`Merged content into existing file: ${destUri.fsPath}`);
        return 'merged';
    } catch {
        // File doesn't exist, create new
        await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(newContent));
        logger.info(`Created new file: ${destUri.fsPath}`);
        return 'created';
    }
}

/**
 * Fetch file from GitHub
 */
async function fetchFromGitHub(path: string): Promise<string | null> {
    const url = `${GITHUB_RAW_BASE}/${path}`;
    logger.info(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            logger.warn(`Failed to fetch ${path}: ${response.status}`);
            return null;
        }
        return await response.text();
    } catch (error) {
        logger.error(`Error fetching ${path}:`, error);
        return null;
    }
}

/**
 * Fetch and transform all prompts from GitHub
 */
export async function fetchAndTransformPrompts(
    workspaceRoot: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<{ success: number; failed: number }> {
    const githubDir = vscode.Uri.joinPath(workspaceRoot, '.github');
    const agentsDir = vscode.Uri.joinPath(githubDir, 'agents');
    const promptsDir = vscode.Uri.joinPath(githubDir, 'prompts');

    // Create directories
    await vscode.workspace.fs.createDirectory(githubDir);
    await vscode.workspace.fs.createDirectory(agentsDir);
    await vscode.workspace.fs.createDirectory(promptsDir);

    let success = 0;
    let failed = 0;
    const totalFiles =
        ORCHESTRATOR_AGENT_FILES.length +
        WORKER_AGENT_FILES.length +
        PROMPT_FILES.length +
        CORE_FILES.length;

    // Fetch and transform ORCHESTRATOR agent files (Level 0 + 1 - need full transformation with tools)
    for (const file of ORCHESTRATOR_AGENT_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/agents/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(agentsDir, file);
            const result = await mergeFileContent(destUri, transformed, false);
            if (result !== 'skipped') {
                success++;
                logger.info(`Orchestrator agent file ${result}: ${file}`);
            }
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Fetch WORKER agent files (Level 2 - NO tools injection, just clean up CCL references)
    for (const file of WORKER_AGENT_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/agents/${file}`);
        if (content) {
            // Workers don't need tools - only transform text references without injecting tools
            const transformed = transformWorkerForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(agentsDir, file);
            const result = await mergeFileContent(destUri, transformed, false);
            if (result !== 'skipped') {
                success++;
                logger.info(`Worker agent file ${result}: ${file}`);
            }
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Fetch prompt files (NO transformation - these are just guidance for Copilot)
    for (const file of PROMPT_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/prompts/${file}`);
        if (content) {
            // Prompts are just guidance files - copy directly without transformation
            const destUri = vscode.Uri.joinPath(promptsDir, file);
            const result = await mergeFileContent(destUri, content, false);
            if (result !== 'skipped') {
                success++;
                logger.info(`Prompt file ${result}: ${file}`);
            }
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Fetch and transform core files
    for (const file of CORE_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(githubDir, file);
            const result = await mergeFileContent(destUri, transformed, true);
            if (result !== 'skipped') {
                success++;
                logger.info(`Core file ${result}: ${file}`);
            }
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Fetch .ouroboros template files (no transformation needed)
    const allTemplateFiles = [...OUROBOROS_TEMPLATE_FILES, ...OUROBOROS_SPEC_TEMPLATES];
    for (const file of allTemplateFiles) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / (totalFiles + allTemplateFiles.length)) * 100,
        });

        const content = await fetchFromGitHub(file);
        if (content) {
            const destUri = vscode.Uri.joinPath(workspaceRoot, file);
            // Create parent directories
            const parentDir = vscode.Uri.joinPath(destUri, '..');
            await vscode.workspace.fs.createDirectory(parentDir);
            await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(content));
            success++;
            logger.info(`Copied template: ${file}`);
        } else {
            failed++;
            logger.warn(`Failed to fetch template: ${file}`);
        }
    }

    return { success, failed };
}

/**
 * Create .ouroboros directory structure
 */
export async function createOuroborosStructure(workspaceRoot: vscode.Uri): Promise<void> {
    const ouroborosDir = vscode.Uri.joinPath(workspaceRoot, '.ouroboros');
    const specsDir = vscode.Uri.joinPath(ouroborosDir, 'specs');
    const templatesDir = vscode.Uri.joinPath(ouroborosDir, 'templates');
    const historyDir = vscode.Uri.joinPath(ouroborosDir, 'history');

    await vscode.workspace.fs.createDirectory(ouroborosDir);
    await vscode.workspace.fs.createDirectory(specsDir);
    await vscode.workspace.fs.createDirectory(templatesDir);
    await vscode.workspace.fs.createDirectory(historyDir);

    // Create README
    const readme = `# Ouroboros Project

This directory contains Ouroboros configuration and specifications.

## Directory Structure

- \`specs/\` - Feature specifications
- \`templates/\` - Spec templates
- \`history/\` - Session context files

## Usage

Use the Ouroboros extension sidebar or type \`/ouroboros\` in Copilot Chat.

## LM Tools Available

| Tool | Description |
|------|-------------|
| \`ouroborosai_ask\` | Request text input from user |
| \`ouroborosai_menu\` | Show multiple choice menu |
| \`ouroborosai_confirm\` | Request yes/no confirmation |
| \`ouroborosai_plan_review\` | Request plan/spec review |
| \`ouroborosai_phase_progress\` | Update workflow progress |
| \`ouroborosai_agent_handoff\` | Track agent handoffs |
`;

    const readmeUri = vscode.Uri.joinPath(ouroborosDir, 'README.md');
    await vscode.workspace.fs.writeFile(readmeUri, new TextEncoder().encode(readme));
}

// =========================================================================
// SMART UPDATE FUNCTIONS
// These preserve user YAML customizations while updating content body
// =========================================================================

/**
 * YAML frontmatter structure
 */
interface YamlFrontmatter {
    /** Full YAML block including delimiters */
    fullMatch: string;
    /** YAML content without delimiters */
    content: string;
    /** Content after YAML frontmatter */
    body: string;
}

/**
 * Extract YAML frontmatter from markdown content
 */
export function extractYamlFrontmatter(content: string): YamlFrontmatter | null {
    const yamlRegex = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/;
    const match = content.match(yamlRegex);

    if (!match) {
        return null;
    }

    return {
        fullMatch: match[0],
        content: match[2],
        body: content.slice(match[0].length),
    };
}

/**
 * Preserve user's YAML frontmatter while updating content body
 * 
 * Strategy:
 * 1. Extract user's existing YAML frontmatter
 * 2. Extract new content's body (after YAML)
 * 3. Combine user's YAML with new body
 * 4. Re-inject Ouroboros tools if needed (for orchestrator files)
 */
export function preserveYamlFrontmatter(
    existingContent: string,
    newContent: string,
    isOrchestrator: boolean = false
): string {
    const existingYaml = extractYamlFrontmatter(existingContent);
    const newYaml = extractYamlFrontmatter(newContent);

    // If existing file has no YAML, use new content as-is
    if (!existingYaml) {
        return newContent;
    }

    // If new content has no YAML (shouldn't happen), keep existing
    if (!newYaml) {
        return existingContent;
    }

    // Build merged content: user's YAML + new body
    let mergedContent = `---\n${existingYaml.content}\n---\n${newYaml.body}`;

    // For orchestrators, ensure Ouroboros tools are present in YAML
    if (isOrchestrator) {
        mergedContent = injectOuroborosTools(mergedContent);
    }

    return mergedContent;
}

/**
 * Smart update a single file - preserves YAML, updates body
 */
async function smartUpdateFile(
    destUri: vscode.Uri,
    newContent: string,
    isOrchestrator: boolean
): Promise<'updated' | 'created' | 'failed'> {
    try {
        // Check if file exists
        const existingBytes = await vscode.workspace.fs.readFile(destUri);
        const existingContent = new TextDecoder().decode(existingBytes);

        // Preserve user's YAML, use new body
        const mergedContent = preserveYamlFrontmatter(
            existingContent,
            newContent,
            isOrchestrator
        );

        await vscode.workspace.fs.writeFile(
            destUri,
            new TextEncoder().encode(mergedContent)
        );
        logger.info(`Smart updated file: ${destUri.fsPath}`);
        return 'updated';
    } catch {
        // File doesn't exist, create new
        await vscode.workspace.fs.writeFile(
            destUri,
            new TextEncoder().encode(newContent)
        );
        logger.info(`Created new file: ${destUri.fsPath}`);
        return 'created';
    }
}

/**
 * Smart update all prompts - preserves user YAML customizations
 * This is the main export for the Update Prompts feature
 */
export async function smartUpdatePrompts(
    workspaceRoot: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<{ updated: number; created: number; failed: number }> {
    const githubDir = vscode.Uri.joinPath(workspaceRoot, '.github');
    const agentsDir = vscode.Uri.joinPath(githubDir, 'agents');
    const promptsDir = vscode.Uri.joinPath(githubDir, 'prompts');

    let updated = 0;
    let created = 0;
    let failed = 0;

    const totalFiles =
        ORCHESTRATOR_AGENT_FILES.length +
        WORKER_AGENT_FILES.length +
        PROMPT_FILES.length +
        CORE_FILES.length;

    // Update ORCHESTRATOR agent files (Level 0 + 1)
    for (const file of ORCHESTRATOR_AGENT_FILES) {
        progress?.report({
            message: `Updating ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/agents/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(agentsDir, file);
            const result = await smartUpdateFile(destUri, transformed, true);
            if (result === 'updated') updated++;
            else if (result === 'created') created++;
            else failed++;
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Update WORKER agent files (Level 2)
    for (const file of WORKER_AGENT_FILES) {
        progress?.report({
            message: `Updating ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/agents/${file}`);
        if (content) {
            const transformed = transformWorkerForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(agentsDir, file);
            const result = await smartUpdateFile(destUri, transformed, false);
            if (result === 'updated') updated++;
            else if (result === 'created') created++;
            else failed++;
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Update prompt files
    for (const file of PROMPT_FILES) {
        progress?.report({
            message: `Updating ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/prompts/${file}`);
        if (content) {
            const destUri = vscode.Uri.joinPath(promptsDir, file);
            const result = await smartUpdateFile(destUri, content, false);
            if (result === 'updated') updated++;
            else if (result === 'created') created++;
            else failed++;
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Update core files
    for (const file of CORE_FILES) {
        progress?.report({
            message: `Updating ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(githubDir, file);
            const result = await smartUpdateFile(destUri, transformed, false);
            if (result === 'updated') updated++;
            else if (result === 'created') created++;
            else failed++;
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Update .ouroboros template files (no transformation needed)
    const allTemplateFiles = [...OUROBOROS_TEMPLATE_FILES, ...OUROBOROS_SPEC_TEMPLATES];
    for (const file of allTemplateFiles) {
        progress?.report({
            message: `Updating ${file}...`,
            increment: (1 / (totalFiles + allTemplateFiles.length)) * 100,
        });

        const content = await fetchFromGitHub(file);
        if (content) {
            const destUri = vscode.Uri.joinPath(workspaceRoot, file);
            // Create parent directories
            const parentDir = vscode.Uri.joinPath(destUri, '..');
            await vscode.workspace.fs.createDirectory(parentDir);
            // Always overwrite template files during update
            await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(content));
            updated++;
            logger.info(`Updated template: ${file}`);
        } else {
            failed++;
            logger.warn(`Failed to fetch template: ${file}`);
        }
    }

    logger.info(
        `Smart update complete: ${updated} updated, ${created} created, ${failed} failed`
    );

    return { updated, created, failed };
}

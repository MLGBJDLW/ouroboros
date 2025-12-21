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
const AGENT_FILES = [
    'ouroboros.agent.md',
    'ouroboros-init.agent.md',
    'ouroboros-spec.agent.md',
    'ouroboros-implement.agent.md',
    'ouroboros-archive.agent.md',
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

const CORE_FILES = [
    'copilot-instructions.md',
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
    // TYPE A+Q: Standard CCL with question
    // python -c "print('question'); task = input('[Ouroboros] > ')"
    // → Use ouroboros_ask tool with question parameter
    // =========================================================================
    const patternAQ = /python -c "print\('([^']*)'\); task = input\('\[Ouroboros\] > '\)"/g;
    transformed = transformed.replace(patternAQ, (_, question) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
    // → Use ouroboros_ask tool
    // =========================================================================
    const patternsA = [
        /python -c "task = input\('\[Ouroboros\] > '\)"/g,
    ];
    for (const pattern of patternsA) {
        transformed = transformed.replace(pattern, () => {
            totalChanges++;
            return `Use the \`ouroboros_ask\` tool with:
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
    // → Use ouroboros_menu tool
    // =========================================================================
    const patternBFull = /python -c "print\('([^']*)'\); print\(\);((?:\s*print\('\[[^\]]+\][^']*'\);)+)\s*choice = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternBFull, (_, question, optionsPart, prompt) => {
        totalChanges++;
        // Extract options from print statements
        const optionMatches = optionsPart.match(/\[(\d+)\]\s*([^']*)/g) || [];
        const options = optionMatches.map((opt: string) => {
            const match = opt.match(/\[(\d+)\]\s*(.*)/);
            return match ? match[2].trim() : opt;
        });
        return `Use the \`ouroboros_menu\` tool with:
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
        return `Use the \`ouroboros_menu\` tool with:
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
    // → Use ouroboros_confirm tool
    // =========================================================================
    const patternDFull = /python -c "print\('([^']*)'\); print\(\);(?:\s*print\('\[[yn]\][^']*'\);)+\s*confirm = input\('\[y\/n\]: '\)"/g;
    transformed = transformed.replace(patternDFull, (_, question) => {
        totalChanges++;
        return `Use the \`ouroboros_confirm\` tool with:
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
        return `Use the \`ouroboros_confirm\` tool with:
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
        return `Use the \`ouroboros_confirm\` tool with:
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
    // → Use ouroboros_ask tool with type: feature
    // =========================================================================
    const patternC2 = /python -c "print\('([^']*)'\); feature = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternC2, (_, question, prompt) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
    // → Use ouroboros_ask tool
    // =========================================================================
    const patternC = /python -c "feature = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternC, (_, prompt) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
    // → Use ouroboros_ask tool
    // =========================================================================
    const patternE2 = /python -c "print\('([^']*)'\); question = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternE2, (_, question, prompt) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
    // → Use ouroboros_ask tool
    // =========================================================================
    const patternE = /python -c "question = input\('([^']*)'\)"/g;
    transformed = transformed.replace(patternE, (_, prompt) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
    const patternEnhancedQ = /python \.ouroboros\/scripts\/ouroboros_input\.py --question "([^"]*)"/g;
    transformed = transformed.replace(patternEnhancedQ, (_, question) => {
        totalChanges++;
        return `Use the \`ouroboros_ask\` tool with:
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
        return `Use the \`ouroboros_ask\` tool with:
\`\`\`json
{
  "type": "task",
  "agentName": "[current-agent]",
  "agentLevel": 0
}
\`\`\``;
    });

    // Enhanced with --header --prompt --var choice (menu)
    const patternEnhancedMenu = /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--header "([^"]*)"\s+--prompt "([^"]*)"\s+--var choice/g;
    transformed = transformed.replace(patternEnhancedMenu, (_, question, header, prompt) => {
        totalChanges++;
        const options = header ? header.split('\\n') : [];
        const q = question || 'Select an option';
        return `Use the \`ouroboros_menu\` tool with:
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
    const patternEnhancedConfirm = /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?(?:\s+--header "([^"]*)")?\s+--prompt "\[y\/n\]:"\s+--var confirm(?:\s+--no-ui)?/g;
    transformed = transformed.replace(patternEnhancedConfirm, (_, question, header) => {
        totalChanges++;
        const q = question || header || 'Please confirm';
        return `Use the \`ouroboros_confirm\` tool with:
\`\`\`json
{
  "agentName": "[current-agent]",
  "agentLevel": 0,
  "question": "${escapeQuotes(q)}"
}
\`\`\``;
    });

    // Enhanced with --prompt --var feature
    const patternEnhancedFeature = /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--prompt "([^"]*)"\s+--var feature/g;
    transformed = transformed.replace(patternEnhancedFeature, (_, question, prompt) => {
        totalChanges++;
        const q = question || prompt || 'Enter feature';
        return `Use the \`ouroboros_ask\` tool with:
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
    const patternEnhancedQuestion = /python \.ouroboros\/scripts\/ouroboros_input\.py(?:\s+--question "([^"]*)")?\s+--prompt "([^"]*)"\s+--var question/g;
    transformed = transformed.replace(patternEnhancedQuestion, (_, question, prompt) => {
        totalChanges++;
        const q = question || prompt || 'Enter question';
        return `Use the \`ouroboros_ask\` tool with:
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
- ouroboros_ask: For text input
- ouroboros_menu: For multiple choice selection
- ouroboros_confirm: For yes/no confirmation
- ouroboros_plan_review: For plan/spec review
- ouroboros_phase_progress: For workflow progress updates
\`\`\``;
    });

    // Add Extension mode header
    transformed = addExtensionModeHeader(transformed);

    logger.info(`Transformed content with ${totalChanges} changes`);
    return transformed;
}

/**
 * Escape quotes for JSON strings
 */
function escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
}

/**
 * Add Extension mode header to transformed content
 */
function addExtensionModeHeader(content: string): string {
    const header = `<!-- 
  ╔═══════════════════════════════════════════════════════════╗
  ║  OUROBOROS EXTENSION MODE                                 ║
  ║  Auto-transformed for VS Code LM Tools                    ║
  ║  Original: https://github.com/MLGBJDLW/ouroboros          ║
  ╚═══════════════════════════════════════════════════════════╝
  
  This file uses Ouroboros LM Tools instead of Python CCL commands.
  Available tools:
  - ouroboros_ask: Request text input from user
  - ouroboros_menu: Show multiple choice menu
  - ouroboros_confirm: Request yes/no confirmation
  - ouroboros_plan_review: Request plan/spec review
  - ouroboros_phase_progress: Update workflow progress
  - ouroboros_agent_handoff: Track agent handoffs
-->

`;
    return header + content;
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
    const totalFiles = AGENT_FILES.length + PROMPT_FILES.length + CORE_FILES.length;

    // Fetch and transform agent files
    for (const file of AGENT_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/agents/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(agentsDir, file);
            await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(transformed));
            success++;
            logger.info(`Transformed and saved: ${file}`);
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    // Fetch and transform prompt files
    for (const file of PROMPT_FILES) {
        progress?.report({
            message: `Fetching ${file}...`,
            increment: (1 / totalFiles) * 100,
        });

        const content = await fetchFromGitHub(`.github/prompts/${file}`);
        if (content) {
            const transformed = transformForExtensionMode(content);
            const destUri = vscode.Uri.joinPath(promptsDir, file);
            await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(transformed));
            success++;
            logger.info(`Transformed and saved: ${file}`);
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
            await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(transformed));
            success++;
            logger.info(`Transformed and saved: ${file}`);
        } else {
            failed++;
            logger.warn(`Failed to fetch: ${file}`);
        }
    }

    return { success, failed };
}

/**
 * Create .ouroboros directory structure
 */
export async function createOuroborosStructure(
    workspaceRoot: vscode.Uri
): Promise<void> {
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
| \`ouroboros_ask\` | Request text input from user |
| \`ouroboros_menu\` | Show multiple choice menu |
| \`ouroboros_confirm\` | Request yes/no confirmation |
| \`ouroboros_plan_review\` | Request plan/spec review |
| \`ouroboros_phase_progress\` | Update workflow progress |
| \`ouroboros_agent_handoff\` | Track agent handoffs |
`;

    const readmeUri = vscode.Uri.joinPath(ouroborosDir, 'README.md');
    await vscode.workspace.fs.writeFile(readmeUri, new TextEncoder().encode(readme));
}

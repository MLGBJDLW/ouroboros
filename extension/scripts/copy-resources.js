#!/usr/bin/env node
/**
 * Copy resources script
 * Copies bundled prompts and resources to the extension output
 */

const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');
const promptsDir = path.join(resourcesDir, 'prompts');
const agentsDir = path.join(promptsDir, 'agents');
const promptsOutputDir = path.join(promptsDir, 'prompts');

// Create directories if they don't exist
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
}

console.log('Copying resources...');

try {
    ensureDir(resourcesDir);
    ensureDir(promptsDir);
    ensureDir(agentsDir);
    ensureDir(promptsOutputDir);

    // Copy from project root .github/agents to resources/prompts/agents
    const sourceAgentsDir = path.join(__dirname, '..', '..', '.github', 'agents');
    if (fs.existsSync(sourceAgentsDir)) {
        const agents = fs.readdirSync(sourceAgentsDir).filter(f => f.endsWith('.md'));
        for (const agent of agents) {
            const src = path.join(sourceAgentsDir, agent);
            const dest = path.join(agentsDir, agent);
            fs.copyFileSync(src, dest);
            console.log(`Copied: ${agent}`);
        }
    } else {
        console.log('No source agents directory found, skipping...');
    }

    // Copy from project root .github/prompts to resources/prompts/prompts
    const sourcePromptsDir = path.join(__dirname, '..', '..', '.github', 'prompts');
    if (fs.existsSync(sourcePromptsDir)) {
        const prompts = fs.readdirSync(sourcePromptsDir).filter(f => f.endsWith('.md') || f.endsWith('.prompt.md'));
        for (const prompt of prompts) {
            const src = path.join(sourcePromptsDir, prompt);
            const dest = path.join(promptsOutputDir, prompt);
            fs.copyFileSync(src, dest);
            console.log(`Copied: ${prompt}`);
        }
    } else {
        console.log('No source prompts directory found, skipping...');
    }

    console.log('Resources copied successfully!');
} catch (error) {
    console.error('Failed to copy resources:', error.message);
    process.exit(1);
}

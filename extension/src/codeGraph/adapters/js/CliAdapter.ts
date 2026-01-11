/**
 * CLI Adapter
 * Detects commands from commander/yargs
 */

import type { GraphStore } from '../../core/GraphStore';
import type { GraphNode, GraphEdge } from '../../core/types';
import type { FrameworkAdapter, PackageJson, CommandInfo } from '../types';

type CliFramework = 'commander' | 'yargs' | 'cac' | 'clipanion';

export class CliAdapter implements FrameworkAdapter {
    name = 'cli';
    displayName = 'CLI (commander/yargs)';
    category = 'cli' as const;
    filePatterns = ['**/*.ts', '**/*.js', '**/cli.ts', '**/cli.js', '**/bin/*.ts', '**/bin/*.js'];

    private detectedFramework: CliFramework = 'commander';

    async detect(_projectRoot: string, packageJson?: PackageJson): Promise<boolean> {
        if (!packageJson) return false;

        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        const frameworks: CliFramework[] = ['commander', 'yargs', 'cac', 'clipanion'];
        for (const fw of frameworks) {
            if (deps[fw]) {
                this.detectedFramework = fw;
                return true;
            }
        }

        // Check for bin field in package.json
        if (packageJson.scripts?.['bin'] || (packageJson as Record<string, unknown>).bin) {
            return true;
        }

        return false;
    }

    async extractEntrypoints(store: GraphStore, _projectRoot: string): Promise<GraphNode[]> {
        const entrypoints: GraphNode[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file' || !node.path) continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            const commands = this.extractCommands(content, node.path);
            
            for (const cmd of commands) {
                entrypoints.push({
                    id: `entrypoint:command:${cmd.name}`,
                    kind: 'entrypoint',
                    name: `Command: ${cmd.name}`,
                    path: node.path,
                    meta: {
                        entrypointType: 'command',
                        commandName: cmd.name,
                        description: cmd.description,
                        line: cmd.line,
                        framework: this.detectedFramework,
                        aliases: cmd.aliases,
                    },
                });
            }
        }

        return entrypoints;
    }

    async extractRegistrations(store: GraphStore, _projectRoot: string): Promise<GraphEdge[]> {
        const edges: GraphEdge[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file' || !node.path) continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            const commands = this.extractCommands(content, node.path);
            
            for (const cmd of commands) {
                if (cmd.handlerName) {
                    edges.push({
                        id: `edge:command:${cmd.name}:${cmd.handlerName}`,
                        from: `entrypoint:command:${cmd.name}`,
                        to: `file:${node.path}`,
                        kind: 'registers',
                        confidence: 'high',
                        meta: {
                            framework: this.detectedFramework,
                            handlerName: cmd.handlerName,
                        },
                    });
                }
            }
        }

        return edges;
    }

    /**
     * Extract commands from file content
     */
    private extractCommands(content: string, filePath: string): CommandInfo[] {
        const commands: CommandInfo[] = [];
        const lines = content.split('\n');

        // Commander patterns
        const commanderPatterns = [
            // .command('name')
            /\.command\s*\(\s*['"`]([^'"`]+)['"`]/,
            // program.name('name')
            /program\.name\s*\(\s*['"`]([^'"`]+)['"`]/,
        ];

        // Yargs patterns
        const yargsPatterns = [
            // .command('name', 'desc', ...)
            /\.command\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]/,
            // yargs.command({ command: 'name', ... })
            /command\s*:\s*['"`]([^'"`]+)['"`]/,
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Try commander patterns
            for (const pattern of commanderPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const cmdName = match[1].split(' ')[0]; // Get command name without args
                    commands.push({
                        name: cmdName,
                        handlerFile: filePath,
                        line: i + 1,
                    });
                }
            }

            // Try yargs patterns
            for (const pattern of yargsPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const cmdName = match[1].split(' ')[0];
                    commands.push({
                        name: cmdName,
                        description: match[2],
                        handlerFile: filePath,
                        line: i + 1,
                    });
                }
            }

            // Check for action handler
            const actionMatch = line.match(/\.action\s*\(\s*(\w+)/);
            if (actionMatch && commands.length > 0) {
                commands[commands.length - 1].handlerName = actionMatch[1];
            }
        }

        return commands;
    }
}

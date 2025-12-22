/**
 * Spec Scanner Service
 * Scans .ouroboros/specs folder to read workflow state
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { parseTasksMarkdown, calculateProgress, type ParsedTasks } from './tasksParser';
import { createLogger } from '../utils/logger';

const logger = createLogger('SpecScanner');

/**
 * Spec phase information derived from file existence
 */
export interface SpecPhase {
    name: string;
    file: string;
    status: 'completed' | 'current' | 'pending';
}

/**
 * Information about a spec folder
 */
export interface SpecInfo {
    name: string;
    path: string;
    type: 'spec' | 'implement';
    status: 'active' | 'archived';
    createdAt: number;
    modifiedAt: number;
    phases: SpecPhase[];
    progress: number;
    taskSummary?: {
        total: number;
        completed: number;
        inProgress: number;
    };
}

// Standard spec workflow phases and their file names
const SPEC_PHASES: Array<{ name: string; file: string }> = [
    { name: 'Research', file: 'research.md' },
    { name: 'Requirements', file: 'requirements.md' },
    { name: 'Design', file: 'design.md' },
    { name: 'Tasks', file: 'tasks.md' },
    { name: 'Validation', file: 'validation.md' },
];

/**
 * Scan the specs folder and return all spec information
 */
export async function scanSpecsFolder(workspacePath: string): Promise<{
    active: SpecInfo[];
    archived: SpecInfo[];
}> {
    const specsDir = path.join(workspacePath, '.ouroboros', 'specs');
    // Support both spellings: "archived" (correct) and "archieved" (common typo)
    const archivedDir = path.join(specsDir, 'archived');
    const archievedDir = path.join(specsDir, 'archieved'); // typo variant

    logger.debug('Scanning specs folder', { specsDir });

    const active: SpecInfo[] = [];
    const archived: SpecInfo[] = [];

    try {
        // Scan active specs
        const activeSpecs = await scanDirectory(specsDir, 'active');
        active.push(...activeSpecs);

        // Scan archived specs (try both spellings)
        const archivedSpecs = await scanDirectory(archivedDir, 'archived');
        archived.push(...archivedSpecs);
        
        // Also check the typo variant
        const archievedSpecs = await scanDirectory(archievedDir, 'archived');
        archived.push(...archievedSpecs);

        logger.debug('Scanned specs', {
            activeCount: active.length,
            archivedCount: archived.length,
        });
    } catch (error) {
        logger.debug('Specs folder not found or inaccessible', { workspacePath });
    }

    // Sort by modified date (most recent first)
    active.sort((a, b) => b.modifiedAt - a.modifiedAt);
    archived.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return { active, archived };
}

/**
 * Scan a directory for spec folders
 */
async function scanDirectory(
    dirPath: string,
    status: 'active' | 'archived'
): Promise<SpecInfo[]> {
    const results: SpecInfo[] = [];

    // Folders to skip (not spec folders)
    const SKIP_FOLDERS = ['templates', 'archived', 'archieved', 'subagent-docs', 'docs'];

    try {
        const dirUri = vscode.Uri.file(dirPath);
        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        for (const [name, type] of entries) {
            // Skip non-directories and special folders
            if (type !== vscode.FileType.Directory) continue;
            if (SKIP_FOLDERS.includes(name) || name.startsWith('.')) continue;

            const specPath = path.join(dirPath, name);
            const specInfo = await analyzeSpecFolder(specPath, name, status);
            
            // For active specs, verify it's a real spec folder (has spec files)
            // For archived specs, always include them
            if (specInfo) {
                if (status === 'archived' || isValidSpecFolder(specInfo)) {
                    results.push(specInfo);
                }
            }
        }
    } catch {
        // Directory doesn't exist - this is expected for non-existent archived folders
    }

    return results;
}

/**
 * Check if a folder is a valid spec folder (has at least one spec file)
 */
function isValidSpecFolder(spec: SpecInfo): boolean {
    // A valid spec should have at least one completed phase or have tasks
    const hasCompletedPhase = spec.phases.some(p => p.status === 'completed');
    const hasTasks = spec.taskSummary && spec.taskSummary.total > 0;
    return hasCompletedPhase || hasTasks;
}

/**
 * Analyze a single spec folder
 */
async function analyzeSpecFolder(
    specPath: string,
    name: string,
    status: 'active' | 'archived'
): Promise<SpecInfo | null> {
    try {
        const specUri = vscode.Uri.file(specPath);
        const entries = await vscode.workspace.fs.readDirectory(specUri);
        const fileNames = entries.map(([n]) => n.toLowerCase());

        // Determine phase statuses
        const phases: SpecPhase[] = [];
        let foundCurrent = false;

        for (const phase of SPEC_PHASES) {
            const exists = fileNames.includes(phase.file.toLowerCase());
            let phaseStatus: SpecPhase['status'];

            if (exists) {
                phaseStatus = 'completed';
            } else if (!foundCurrent) {
                phaseStatus = 'current';
                foundCurrent = true;
            } else {
                phaseStatus = 'pending';
            }

            phases.push({
                name: phase.name,
                file: phase.file,
                status: phaseStatus,
            });
        }

        // Calculate progress for spec workflow
        const completedPhases = phases.filter(p => p.status === 'completed').length;
        let progress = Math.round((completedPhases / SPEC_PHASES.length) * 100);

        // If tasks.md exists, try to parse it for more detailed progress
        let taskSummary: SpecInfo['taskSummary'];
        if (fileNames.includes('tasks.md')) {
            try {
                const tasksUri = vscode.Uri.file(path.join(specPath, 'tasks.md'));
                const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
                const parsed = parseTasksMarkdown(Buffer.from(tasksContent).toString('utf-8'));
                taskSummary = parsed.summary;

                // For implement workflow, use tasks progress
                if (parsed.summary.total > 0) {
                    progress = calculateProgress(parsed);
                }
            } catch {
                // Ignore parsing errors
            }
        }

        // Determine workflow type
        // If only tasks.md exists without research/requirements/design, it's likely implement
        const hasSpecFiles = fileNames.includes('research.md') ||
            fileNames.includes('requirements.md') ||
            fileNames.includes('design.md');
        const type: 'spec' | 'implement' = hasSpecFiles ? 'spec' : 'implement';

        // Get folder stats for timestamps
        const stat = await vscode.workspace.fs.stat(specUri);

        return {
            name,
            path: specPath,
            type,
            status,
            createdAt: stat.ctime,
            modifiedAt: stat.mtime,
            phases,
            progress,
            taskSummary,
        };
    } catch (error) {
        logger.error('Error analyzing spec folder', { specPath, error });
        return null;
    }
}

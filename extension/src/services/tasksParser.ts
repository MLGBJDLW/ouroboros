/**
 * Tasks Markdown Parser
 * Parses tasks.md files to extract phase and task progress
 */

export interface TaskItem {
    id: string;
    text: string;
    status: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

export interface PhaseProgress {
    number: number;
    name: string;
    tasks: TaskItem[];
    status: 'pending' | 'current' | 'completed';
}

export interface ParsedTasks {
    phases: PhaseProgress[];
    summary: {
        total: number;
        completed: number;
        inProgress: number;
    };
}

// Regex patterns
const PHASE_HEADER_REGEX = /^## Phase (\d+):\s*(.+?)(?:\s*\(.+\))?$/gm;
const CHECKBOX_REGEX = /^- \[([ x\/\-])\]\s*\*\*(\w+)\*\*\s*(.+)$/;

/**
 * Parse a tasks.md file content
 */
export function parseTasksMarkdown(content: string): ParsedTasks {
    const phases: PhaseProgress[] = [];
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;

    // Split content by phase headers
    const sections = content.split(/(?=^## Phase \d+:)/gm);

    for (const section of sections) {
        const headerMatch = section.match(/^## Phase (\d+):\s*(.+?)(?:\s*\(.+\))?(?:\r?\n|$)/);
        if (!headerMatch) continue;

        const phaseNumber = parseInt(headerMatch[1], 10);
        const phaseName = headerMatch[2].trim();
        const tasks: TaskItem[] = [];

        // Find all checkboxes in this phase
        const lines = section.split(/\r?\n/);
        for (const line of lines) {
            const taskMatch = line.match(CHECKBOX_REGEX);
            if (taskMatch) {
                const [, statusChar, taskId, taskText] = taskMatch;
                const status = getTaskStatus(statusChar);
                tasks.push({ id: taskId, text: taskText.trim(), status });

                totalTasks++;
                if (status === 'completed') completedTasks++;
                if (status === 'in-progress') inProgressTasks++;
            }
        }

        // Determine phase status based on tasks
        let phaseStatus: 'pending' | 'current' | 'completed' = 'pending';
        if (tasks.length > 0) {
            const allCompleted = tasks.every(t => t.status === 'completed' || t.status === 'skipped');
            const anyInProgress = tasks.some(t => t.status === 'in-progress');
            const anyCompleted = tasks.some(t => t.status === 'completed');

            if (allCompleted) {
                phaseStatus = 'completed';
            } else if (anyInProgress || anyCompleted) {
                phaseStatus = 'current';
            }
        }

        phases.push({
            number: phaseNumber,
            name: phaseName,
            tasks,
            status: phaseStatus,
        });
    }

    return {
        phases,
        summary: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
        },
    };
}

/**
 * Convert checkbox character to status
 */
function getTaskStatus(char: string): TaskItem['status'] {
    switch (char) {
        case 'x':
            return 'completed';
        case '/':
            return 'in-progress';
        case '-':
            return 'skipped';
        default:
            return 'pending';
    }
}

/**
 * Calculate overall progress percentage
 */
export function calculateProgress(parsed: ParsedTasks): number {
    if (parsed.summary.total === 0) return 0;
    return Math.round((parsed.summary.completed / parsed.summary.total) * 100);
}

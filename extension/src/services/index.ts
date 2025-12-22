/**
 * Services barrel export
 */

export { parseTasksMarkdown, calculateProgress } from './tasksParser';
export type { TaskItem, PhaseProgress, ParsedTasks } from './tasksParser';

export { scanSpecsFolder } from './specScanner';
export type { SpecInfo, SpecPhase } from './specScanner';

export { SpecWatcher } from './specWatcher';
export type { SpecChangeEvent } from './specWatcher';

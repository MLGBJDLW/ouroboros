/**
 * Tests for TasksParser service
 */

import { describe, it, expect } from 'vitest';
import { parseTasksMarkdown, calculateProgress, type ParsedTasks } from '../../services/tasksParser';

describe('TasksMarkdownParser', () => {
    describe('parseTasksMarkdown', () => {
        it('should parse empty content', () => {
            const result = parseTasksMarkdown('');

            expect(result.phases).toEqual([]);
            expect(result.summary.total).toBe(0);
            expect(result.summary.completed).toBe(0);
            expect(result.summary.inProgress).toBe(0);
        });

        it('should parse single phase with no tasks', () => {
            const content = `
## Phase 1: Setup

Some description text
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases).toHaveLength(1);
            expect(result.phases[0].number).toBe(1);
            expect(result.phases[0].name).toBe('Setup');
            expect(result.phases[0].tasks).toHaveLength(0);
            expect(result.phases[0].status).toBe('pending');
        });

        it('should parse tasks with different statuses', () => {
            const content = `
## Phase 1: Setup

- [ ] **T001** Create project structure
- [x] **T002** Initialize dependencies
- [/] **T003** Configure linting
- [-] **T004** Skipped task
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases).toHaveLength(1);
            expect(result.phases[0].tasks).toHaveLength(4);

            expect(result.phases[0].tasks[0].id).toBe('T001');
            expect(result.phases[0].tasks[0].status).toBe('pending');

            expect(result.phases[0].tasks[1].id).toBe('T002');
            expect(result.phases[0].tasks[1].status).toBe('completed');

            expect(result.phases[0].tasks[2].id).toBe('T003');
            expect(result.phases[0].tasks[2].status).toBe('in-progress');

            expect(result.phases[0].tasks[3].id).toBe('T004');
            expect(result.phases[0].tasks[3].status).toBe('skipped');
        });

        it('should calculate summary correctly', () => {
            const content = `
## Phase 1: Setup

- [x] **T001** Task 1
- [x] **T002** Task 2
- [/] **T003** Task 3
- [ ] **T004** Task 4
            `;

            const result = parseTasksMarkdown(content);

            expect(result.summary.total).toBe(4);
            expect(result.summary.completed).toBe(2);
            expect(result.summary.inProgress).toBe(1);
        });

        it('should parse multiple phases', () => {
            const content = `
## Phase 1: Setup

- [x] **T001** Task 1
- [x] **T002** Task 2

## Phase 2: Implementation

- [ ] **T003** Task 3
- [ ] **T004** Task 4

## Phase 3: Testing

- [ ] **T005** Task 5
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases).toHaveLength(3);
            expect(result.phases[0].number).toBe(1);
            expect(result.phases[0].name).toBe('Setup');
            expect(result.phases[0].tasks).toHaveLength(2);
            expect(result.phases[0].status).toBe('completed');

            expect(result.phases[1].number).toBe(2);
            expect(result.phases[1].name).toBe('Implementation');
            expect(result.phases[1].tasks).toHaveLength(2);
            expect(result.phases[1].status).toBe('pending');

            expect(result.phases[2].number).toBe(3);
            expect(result.phases[2].name).toBe('Testing');
            expect(result.phases[2].tasks).toHaveLength(1);
            expect(result.phases[2].status).toBe('pending');
        });

        it('should determine phase status as current when partially completed', () => {
            const content = `
## Phase 1: Setup

- [x] **T001** Completed task
- [ ] **T002** Pending task
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases[0].status).toBe('current');
        });

        it('should determine phase status as current when has in-progress tasks', () => {
            const content = `
## Phase 1: Setup

- [/] **T001** In progress task
- [ ] **T002** Pending task
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases[0].status).toBe('current');
        });

        it('should handle phase headers with priority info', () => {
            const content = `
## Phase 3: REQ-001 — User Authentication (Priority: P1)

- [ ] **T001** Task description
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases).toHaveLength(1);
            expect(result.phases[0].number).toBe(3);
            expect(result.phases[0].name).toBe('REQ-001 — User Authentication');
        });

        it('should parse task text correctly', () => {
            const content = `
## Phase 1: Setup

- [ ] **T001** [P] Create project structure per design.md
            `;

            const result = parseTasksMarkdown(content);

            expect(result.phases[0].tasks[0].text).toBe('[P] Create project structure per design.md');
        });
    });

    describe('calculateProgress', () => {
        it('should return 0 for empty tasks', () => {
            const parsed: ParsedTasks = {
                phases: [],
                summary: { total: 0, completed: 0, inProgress: 0 },
            };

            expect(calculateProgress(parsed)).toBe(0);
        });

        it('should calculate percentage correctly', () => {
            const parsed: ParsedTasks = {
                phases: [],
                summary: { total: 10, completed: 5, inProgress: 2 },
            };

            expect(calculateProgress(parsed)).toBe(50);
        });

        it('should return 100 for all completed', () => {
            const parsed: ParsedTasks = {
                phases: [],
                summary: { total: 4, completed: 4, inProgress: 0 },
            };

            expect(calculateProgress(parsed)).toBe(100);
        });

        it('should round to nearest integer', () => {
            const parsed: ParsedTasks = {
                phases: [],
                summary: { total: 3, completed: 1, inProgress: 0 },
            };

            expect(calculateProgress(parsed)).toBe(33);
        });
    });
});

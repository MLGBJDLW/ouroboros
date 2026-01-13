/**
 * WaspAdapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaspAdapter } from '../../../codeGraph/adapters/js/WaspAdapter';
import type { GraphStore } from '../../../codeGraph/core/GraphStore';
import * as fs from 'fs';

vi.mock('fs', () => ({
    promises: {
        access: vi.fn(),
        readFile: vi.fn(),
    },
    accessSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
}));

describe('WaspAdapter', () => {
    let adapter: WaspAdapter;
    let mockStore: GraphStore;

    beforeEach(() => {
        adapter = new WaspAdapter();
        vi.clearAllMocks();
        
        mockStore = {
            getAllNodes: vi.fn().mockReturnValue([
                { id: 'file:src/pages/Main.tsx', kind: 'file', path: 'src/pages/Main.tsx' },
                { id: 'file:src/queries.ts', kind: 'file', path: 'src/queries.ts' },
                { id: 'file:src/actions.ts', kind: 'file', path: 'src/actions.ts' },
            ]),
        } as unknown as GraphStore;
    });

    describe('detect', () => {
        it('should detect wasp project with main.wasp file', async () => {
            vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
            
            const result = await adapter.detect('/workspace');
            
            expect(result).toBe(true);
        });

        it('should detect wasp project with main.wasp.ts file', async () => {
            vi.mocked(fs.promises.access)
                .mockRejectedValueOnce(new Error('not found'))
                .mockResolvedValueOnce(undefined);
            
            const result = await adapter.detect('/workspace');
            
            expect(result).toBe(true);
        });

        it('should detect wasp from package.json', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('not found'));
            
            const result = await adapter.detect('/workspace', {
                dependencies: { wasp: '^0.13.0' },
            });
            
            expect(result).toBe(true);
        });

        it('should return false without wasp indicators', async () => {
            vi.mocked(fs.promises.access).mockRejectedValue(new Error('not found'));
            
            const result = await adapter.detect('/workspace', {
                dependencies: { react: '^18.0.0' },
            });
            
            expect(result).toBe(false);
        });
    });

    describe('extractEntrypoints', () => {
        const waspConfig = `
app myApp {
  title: "My App"
}

page MainPage {
  component: import Main from "@src/pages/Main"
}

page DashboardPage {
  authRequired: true,
  component: import Dashboard from "@src/pages/Dashboard"
}

route MainRoute { path: "/", to: MainPage }
route DashboardRoute { path: "/dashboard", to: DashboardPage }

query getTasks {
  fn: import { getTasks } from "@src/queries",
  entities: [Task]
}

action createTask {
  fn: import { createTask } from "@src/actions",
  entities: [Task]
}

api stripeWebhook {
  fn: import { stripeWebhook } from "@src/apis/stripe",
  httpRoute: (POST, "/webhooks/stripe"),
  entities: [Payment]
}

job dailyReport {
  executor: PgBoss,
  perform: {
    fn: import { generateReport } from "@src/jobs/reports"
  },
  schedule: {
    cron: "0 8 * * *"
  }
}
`;

        beforeEach(() => {
            vi.mocked(fs.promises.readFile).mockResolvedValue(waspConfig);
            vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error('not found'); });
        });

        it('should extract page entrypoints', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const pages = entrypoints.filter(e => e.meta?.entrypointType === 'page');
            expect(pages).toHaveLength(2);
            expect(pages[0].name).toBe('Page: MainPage');
            expect(pages[0].meta?.framework).toBe('wasp');
        });

        it('should extract query entrypoints', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const queries = entrypoints.filter(e => e.name.startsWith('Query:'));
            expect(queries).toHaveLength(1);
            expect(queries[0].name).toBe('Query: getTasks');
            expect(queries[0].meta?.entities).toContain('Task');
        });

        it('should extract action entrypoints', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const actions = entrypoints.filter(e => e.name.startsWith('Action:'));
            expect(actions).toHaveLength(1);
            expect(actions[0].name).toBe('Action: createTask');
        });

        it('should extract API entrypoints', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const apis = entrypoints.filter(e => e.name.startsWith('API:'));
            expect(apis).toHaveLength(1);
            expect(apis[0].name).toBe('API: POST /webhooks/stripe');
            expect(apis[0].meta?.httpMethod).toBe('POST');
            expect(apis[0].meta?.httpRoute).toBe('/webhooks/stripe');
        });

        it('should extract job entrypoints', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const jobs = entrypoints.filter(e => e.meta?.entrypointType === 'job');
            expect(jobs).toHaveLength(1);
            expect(jobs[0].name).toBe('Job: dailyReport');
            expect(jobs[0].meta?.schedule).toBe('0 8 * * *');
        });

        it('should resolve @src/ imports correctly', async () => {
            const entrypoints = await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const mainPage = entrypoints.find(e => e.name === 'Page: MainPage');
            expect(mainPage?.path).toMatch(/src\/pages\/Main/);
        });
    });

    describe('extractRegistrations', () => {
        const waspConfig = `
page MainPage {
  component: import Main from "@src/pages/Main"
}

route MainRoute { path: "/", to: MainPage }
`;

        beforeEach(() => {
            vi.mocked(fs.promises.readFile).mockResolvedValue(waspConfig);
            vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error('not found'); });
        });

        it('should create edges from routes to pages', async () => {
            // First extract entrypoints to parse config
            await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const edges = await adapter.extractRegistrations(mockStore, '/workspace');
            
            expect(edges).toHaveLength(1);
            expect(edges[0].from).toBe('entrypoint:route:MainRoute');
            expect(edges[0].kind).toBe('registers');
            expect(edges[0].meta?.routePath).toBe('/');
        });
    });

    describe('detectIssues', () => {
        const waspConfig = `
page MainPage {
  component: import Main from "@src/pages/Main"
}

page MissingPage {
  component: import Missing from "@src/pages/Missing"
}

route MainRoute { path: "/", to: MainPage }
route BrokenRoute { path: "/broken", to: NonExistentPage }

query getMissing {
  fn: import { getMissing } from "@src/missing-queries"
}
`;

        beforeEach(() => {
            vi.mocked(fs.promises.readFile).mockResolvedValue(waspConfig);
            vi.mocked(fs.accessSync).mockImplementation(() => { throw new Error('not found'); });
        });

        it('should detect missing page components', async () => {
            // First extract entrypoints to parse config
            await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const issues = await adapter.detectIssues?.(mockStore) ?? [];
            
            const missingPage = issues.find(i => i.message?.includes('MissingPage'));
            expect(missingPage).toBeDefined();
            expect(missingPage?.kind).toBe('ENTRY_MISSING_HANDLER');
        });

        it('should detect routes pointing to undefined pages', async () => {
            await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const issues = await adapter.detectIssues?.(mockStore) ?? [];
            
            const brokenRoute = issues.find(i => i.message?.includes('BrokenRoute'));
            expect(brokenRoute).toBeDefined();
            expect(brokenRoute?.kind).toBe('NOT_REGISTERED');
            expect(brokenRoute?.message).toContain('NonExistentPage');
        });

        it('should detect missing query handlers', async () => {
            await adapter.extractEntrypoints(mockStore, '/workspace');
            
            const issues = await adapter.detectIssues?.(mockStore) ?? [];
            
            const missingQuery = issues.find(i => i.message?.includes('getMissing'));
            expect(missingQuery).toBeDefined();
            expect(missingQuery?.kind).toBe('ENTRY_MISSING_HANDLER');
        });
    });

    describe('adapter properties', () => {
        it('should have correct name and category', () => {
            expect(adapter.name).toBe('wasp');
            expect(adapter.displayName).toBe('Wasp');
            expect(adapter.category).toBe('fullstack');
        });

        it('should have correct file patterns', () => {
            expect(adapter.filePatterns).toContain('main.wasp');
            expect(adapter.filePatterns).toContain('main.wasp.ts');
        });
    });
});

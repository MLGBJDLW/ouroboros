/**
 * JavaIndexer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JavaIndexer } from '../../../codeGraph/indexers/JavaIndexer';
import type { TreeSitterManager } from '../../../codeGraph/parsers/TreeSitterManager';

describe('JavaIndexer', () => {
    let indexer: JavaIndexer;
    let mockTsManager: Partial<TreeSitterManager>;

    beforeEach(() => {
        mockTsManager = {
            loadLanguage: vi.fn().mockRejectedValue(new Error('Not available')),
            parse: vi.fn(),
        };

        indexer = new JavaIndexer({
            workspaceRoot: '/workspace',
            include: ['**/*.java'],
            exclude: [],
            maxFileSize: 1024 * 1024,
            treeSitterManager: mockTsManager as TreeSitterManager,
        });
    });

    describe('supports', () => {
        it('should support .java files', () => {
            expect(indexer.supports('Main.java')).toBe(true);
            expect(indexer.supports('src/com/example/App.java')).toBe(true);
        });

        it('should not support other files', () => {
            expect(indexer.supports('test.py')).toBe(false);
            expect(indexer.supports('test.kt')).toBe(false);
        });
    });

    describe('indexFile (fallback parsing)', () => {
        it('should extract import statements', async () => {
            const content = `
package com.example;

import java.util.List;
import java.util.Map;
import com.example.models.User;

public class Main {
}
            `;

            const result = await indexer.indexFile('Main.java', content);

            expect(result.edges.length).toBeGreaterThanOrEqual(3);
            expect(result.edges.some(e => e.meta?.importPath?.includes('java.util.List'))).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath?.includes('java.util.Map'))).toBe(true);
        });

        it('should detect main entrypoint', async () => {
            const content = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
            `;

            const result = await indexer.indexFile('Main.java', content);

            expect(result.nodes.some(n => n.kind === 'entrypoint')).toBe(true);
            expect(result.nodes.some(n => n.meta?.entrypointType === 'main')).toBe(true);
        });

        it('should detect Spring Boot application', async () => {
            const content = `
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
            `;

            const result = await indexer.indexFile('Application.java', content);

            expect(result.nodes.some(n => n.meta?.framework === 'spring-boot')).toBe(true);
        });

        it('should detect Spring REST controller', async () => {
            const content = `
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class UserController {
    @GetMapping("/users")
    public List<User> getUsers() {
        return users;
    }
}
            `;

            const result = await indexer.indexFile('UserController.java', content);

            expect(result.nodes.some(n => n.meta?.framework === 'spring')).toBe(true);
            expect(result.nodes.some(n => n.meta?.entrypointType === 'api')).toBe(true);
        });

        it('should create file node', async () => {
            const content = 'package com.example;';
            const result = await indexer.indexFile('src/App.java', content);

            expect(result.nodes.some(n => n.id === 'file:src/App.java')).toBe(true);
            expect(result.nodes.some(n => n.meta?.language === 'java')).toBe(true);
        });
    });
});

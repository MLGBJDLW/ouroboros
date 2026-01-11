/**
 * QueryCache Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryCache, getQueryCache, resetQueryCache } from '../../../codeGraph/core/QueryCache';

describe('QueryCache', () => {
    let cache: QueryCache;

    beforeEach(() => {
        cache = new QueryCache({ maxSize: 10, ttl: 1000 });
    });

    describe('getOrCompute', () => {
        it('should compute and cache value on first call', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            const result = cache.getOrCompute('key1', compute);
            
            expect(result).toBe('result');
            expect(compute).toHaveBeenCalledTimes(1);
        });

        it('should return cached value on subsequent calls', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.getOrCompute('key1', compute);
            const result = cache.getOrCompute('key1', compute);
            
            expect(result).toBe('result');
            expect(compute).toHaveBeenCalledTimes(1);
        });

        it('should recompute after TTL expires', async () => {
            const shortTtlCache = new QueryCache({ ttl: 50 });
            const compute = vi.fn().mockReturnValue('result');
            
            shortTtlCache.getOrCompute('key1', compute);
            await new Promise(resolve => setTimeout(resolve, 100));
            shortTtlCache.getOrCompute('key1', compute);
            
            expect(compute).toHaveBeenCalledTimes(2);
        });

        it('should not cache when disabled', () => {
            const disabledCache = new QueryCache({ enabled: false });
            const compute = vi.fn().mockReturnValue('result');
            
            disabledCache.getOrCompute('key1', compute);
            disabledCache.getOrCompute('key1', compute);
            
            expect(compute).toHaveBeenCalledTimes(2);
        });
    });

    describe('invalidate', () => {
        it('should clear all cached values', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.getOrCompute('key1', compute);
            cache.invalidate();
            cache.getOrCompute('key1', compute);
            
            expect(compute).toHaveBeenCalledTimes(2);
        });
    });

    describe('invalidatePattern', () => {
        it('should clear values matching pattern', () => {
            const compute1 = vi.fn().mockReturnValue('result1');
            const compute2 = vi.fn().mockReturnValue('result2');
            
            cache.getOrCompute('digest:all', compute1);
            cache.getOrCompute('impact:file.ts', compute2);
            
            cache.invalidatePattern('digest');
            
            cache.getOrCompute('digest:all', compute1);
            cache.getOrCompute('impact:file.ts', compute2);
            
            expect(compute1).toHaveBeenCalledTimes(2);
            expect(compute2).toHaveBeenCalledTimes(1);
        });
    });

    describe('getStats', () => {
        it('should track hits and misses', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.getOrCompute('key1', compute); // miss
            cache.getOrCompute('key1', compute); // hit
            cache.getOrCompute('key1', compute); // hit
            cache.getOrCompute('key2', compute); // miss
            
            const stats = cache.getStats();
            
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(2);
            expect(stats.hitRate).toBe(0.5);
        });

        it('should report size and maxSize', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.getOrCompute('key1', compute);
            cache.getOrCompute('key2', compute);
            
            const stats = cache.getStats();
            
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(10);
        });
    });

    describe('clear', () => {
        it('should clear cache and reset stats', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.getOrCompute('key1', compute);
            cache.clear();
            
            const stats = cache.getStats();
            
            expect(stats.size).toBe(0);
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
        });
    });

    describe('setEnabled', () => {
        it('should enable/disable caching', () => {
            const compute = vi.fn().mockReturnValue('result');
            
            cache.setEnabled(false);
            cache.getOrCompute('key1', compute);
            cache.getOrCompute('key1', compute);
            
            expect(compute).toHaveBeenCalledTimes(2);
            
            cache.setEnabled(true);
            cache.getOrCompute('key2', compute);
            cache.getOrCompute('key2', compute);
            
            expect(compute).toHaveBeenCalledTimes(3);
        });
    });

    describe('eviction', () => {
        it('should evict oldest entries when at capacity', () => {
            const smallCache = new QueryCache({ maxSize: 3 });
            
            smallCache.getOrCompute('key1', () => 'v1');
            smallCache.getOrCompute('key2', () => 'v2');
            smallCache.getOrCompute('key3', () => 'v3');
            smallCache.getOrCompute('key4', () => 'v4');
            
            const stats = smallCache.getStats();
            expect(stats.size).toBeLessThanOrEqual(3);
        });
    });
});

describe('getQueryCache singleton', () => {
    beforeEach(() => {
        resetQueryCache();
    });

    it('should return same instance', () => {
        const cache1 = getQueryCache();
        const cache2 = getQueryCache();
        
        expect(cache1).toBe(cache2);
    });

    it('should reset instance', () => {
        const cache1 = getQueryCache();
        resetQueryCache();
        const cache2 = getQueryCache();
        
        expect(cache1).not.toBe(cache2);
    });
});

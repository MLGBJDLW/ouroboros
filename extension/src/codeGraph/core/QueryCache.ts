/**
 * Query Cache
 * LRU cache for graph query results with automatic invalidation
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('QueryCache');

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    hits: number;
}

export interface QueryCacheOptions {
    /** Maximum number of entries (default: 100) */
    maxSize?: number;
    /** TTL in milliseconds (default: 5 minutes) */
    ttl?: number;
    /** Enable cache (default: true) */
    enabled?: boolean;
}

export class QueryCache {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private maxSize: number;
    private ttl: number;
    private enabled: boolean;
    private hits = 0;
    private misses = 0;
    private graphVersion = 0;

    constructor(options: QueryCacheOptions = {}) {
        this.maxSize = options.maxSize ?? 100;
        this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes
        this.enabled = options.enabled ?? true;
    }

    /**
     * Get cached value or compute and cache
     */
    getOrCompute<T>(key: string, compute: () => T): T {
        if (!this.enabled) {
            return compute();
        }

        const cacheKey = `${this.graphVersion}:${key}`;
        const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

        if (entry && Date.now() - entry.timestamp < this.ttl) {
            entry.hits++;
            this.hits++;
            logger.debug(`Cache hit: ${key}`);
            return entry.value;
        }

        this.misses++;
        const value = compute();
        this.set(cacheKey, value);
        return value;
    }

    /**
     * Set a cache entry
     */
    private set<T>(key: string, value: T): void {
        // Evict oldest entries if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            hits: 0,
        });
    }

    /**
     * Invalidate all cache entries (call when graph changes)
     */
    invalidate(): void {
        this.graphVersion++;
        this.cache.clear();
        logger.debug('Cache invalidated');
    }

    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern: string): void {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hits: number;
        misses: number;
        hitRate: number;
        enabled: boolean;
    } {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            enabled: this.enabled,
        };
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Enable or disable cache
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.clear();
        }
    }

    /**
     * Evict oldest/least used entries
     */
    private evictOldest(): void {
        // Find entry with oldest timestamp and lowest hits
        let oldestKey: string | null = null;
        let oldestScore = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            // Score = timestamp - (hits * 1000) - lower is older/less used
            const score = entry.timestamp + entry.hits * 1000;
            if (score < oldestScore) {
                oldestScore = score;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}

// Singleton instance
let cacheInstance: QueryCache | null = null;

export function getQueryCache(options?: QueryCacheOptions): QueryCache {
    if (!cacheInstance) {
        cacheInstance = new QueryCache(options);
    }
    return cacheInstance;
}

export function resetQueryCache(): void {
    cacheInstance = null;
}

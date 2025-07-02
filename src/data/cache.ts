// =================================================================
//
//      Combi-Router: Caching Logic and Cache Management
//
//      This module contains caching utilities and cache management
//      functionality.
//
// =================================================================

import type { RouteMetadata, CacheEntry, CacheConfig } from '../core/types';
import { Route } from '../core/route';

// =================================================================
// ----------------- HIGHER-ORDER ENHANCERS ----------------------
// =================================================================

export function cache<TParams>(cacheConfig: Exclude<RouteMetadata['cache'], undefined>) {
  return (r: Route<TParams>): Route<TParams> => {
    return new Route(r.matchers, { ...r.metadata, cache: cacheConfig }, r.name);
  };
}

// =================================================================
// ----------------- ENHANCED CACHE IMPLEMENTATION ---------------
// =================================================================

/**
 * Advanced cache manager with support for tags, priorities, and smart eviction.
 * Designed for modern data fetching patterns.
 */
export class AdvancedCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.defaultTTL ?? 300000; // 5 minutes
  }

  /**
   * Store data in cache with metadata and tags.
   */
  set<T>(key: string, data: T, config: CacheConfig = {}): void {
    const now = new Date();
    const ttl = config.ttl ?? this.defaultTTL;
    const priority = config.priority ?? 'normal';
    const tags = config.invalidateOn ?? [];

    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expires: Date.now() + ttl,
      priority,
      tags,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Retrieve data from cache, updating access metadata.
   */
  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry as CacheEntry<T>;
  }

  /**
   * Check if data exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expires <= Date.now()) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Check if data exists but is stale (past staleTime).
   */
  isStale(key: string, staleTime: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    
    return (Date.now() - entry.timestamp.getTime()) > staleTime;
  }

  /**
   * Delete a specific cache entry.
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries with specific tags.
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of Array.from(keys)) {
          if (this.delete(key)) {
            invalidated++;
          }
        }
      }
    }
    
    return invalidated;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let byPriority = { low: 0, normal: 0, high: 0 };

    for (const [, entry] of this.cache) {
      if (entry.expires <= now) {
        expired++;
      }
      byPriority[entry.priority]++;
    }

    return {
      totalEntries: this.cache.size,
      expired,
      byPriority,
      tags: this.tagIndex.size,
      hitRatio: this.calculateHitRatio()
    };
  }

  /**
   * Evict least recently used entry with lowest priority.
   */
  private evictLRU(): void {
    let oldestEntry: { key: string; entry: CacheEntry; score: number } | null = null;

    for (const [key, entry] of this.cache) {
      // Score combines priority and recency (lower is more evictable)
      const priorityScore = entry.priority === 'high' ? 3 : entry.priority === 'normal' ? 2 : 1;
      const recencyScore = entry.lastAccessed.getTime();
      const score = priorityScore * 1000000 + recencyScore; // Priority weighted heavily

      if (!oldestEntry || score < oldestEntry.score) {
        oldestEntry = { key, entry, score };
      }
    }

    if (oldestEntry) {
      this.delete(oldestEntry.key);
    }
  }

  /**
   * Calculate cache hit ratio for monitoring.
   */
  private calculateHitRatio(): number {
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);
    
    if (totalAccesses === 0) return 0;
    
    // This is a simplified calculation - in practice you'd track hits/misses separately
    return Math.min(1, totalAccesses / (totalAccesses + this.cache.size));
  }
}

// Global cache instance
export const globalCache = new AdvancedCache();

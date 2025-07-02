// =================================================================
//
//      Combi-Router: Performance Optimization Features
//
//      Advanced performance features for production applications
//
// =================================================================

import type { Route } from '../core/types';

export type PrefetchStrategy = 'hover' | 'visible' | 'immediate' | 'none';
export type ResourcePriority = 'high' | 'low' | 'auto';

export interface MemoryManagementConfig {
  enabled: boolean;
  maxCacheSize: number;
  maxCacheAge: number;
  cleanupInterval: number;
  lowMemoryThreshold: number;
}

export interface PerformanceConfig {
  prefetchOnHover: boolean;
  prefetchViewport: boolean;
  navigationTimeout: number;
  resourcePriority: ResourcePriority;
  memoryManagement: MemoryManagementConfig;
  connectionAware: boolean;
  enablePerformanceMonitoring: boolean;
  preloadCriticalRoutes?: string[];
}

export interface PerformanceMetrics {
  navigationTime: number;
  loadTime: number;
  firstContentfulPaint?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
  memoryUsage: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

export interface PrefetchEntry {
  route: Route;
  priority: ResourcePriority;
  timestamp: number;
  size?: number;
  accessed: boolean;
}

export class PerformanceManager {
  private config: Required<PerformanceConfig>;
  private prefetchCache = new Map<string, PrefetchEntry>();
  private navigationStart = 0;
  private intersectionObserver?: IntersectionObserver;
  private hoverTimer?: number;
  private cleanupInterval?: number;
  private metrics = new Map<string, PerformanceMetrics>();
  private connectionInfo: { effectiveType?: string; downlink?: number } = {};

  constructor(config: PerformanceConfig) {
    this.config = {
      ...defaultPerformanceConfig,
      ...config,
      memoryManagement: {
        ...defaultPerformanceConfig.memoryManagement,
        ...config.memoryManagement
      }
    };

    if (typeof window !== 'undefined') {
      this.initializePerformanceMonitoring();
      this.initializeConnectionMonitoring();
      this.initializeViewportPrefetching();
      this.initializeMemoryManagement();
      this.preloadCriticalRoutes();
    }
  }

  private initializePerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Monitor Web Vitals if available
    if ('PerformanceObserver' in window) {
      this.observeWebVitals();
    }

    // Monitor memory usage
    if ('memory' in performance) {
      this.startMemoryMonitoring();
    }
  }

  private observeWebVitals(): void {
    // Observe Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcp = entries[entries.length - 1] as PerformanceEntry;
      this.recordMetric('lcp', lcp.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // Observe First Input Delay (FID)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        this.recordMetric('fid', entry.processingStart - entry.startTime);
      });
    }).observe({ type: 'first-input', buffered: true });

    // Observe Cumulative Layout Shift (CLS)
    new PerformanceObserver((list) => {
      let cls = 0;
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
      this.recordMetric('cls', cls);
    }).observe({ type: 'layout-shift', buffered: true });
  }

  private startMemoryMonitoring(): void {
    const monitorMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        const memoryInfo = {
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          totalJSHeapSize: memory.totalJSHeapSize,
          usedJSHeapSize: memory.usedJSHeapSize
        };

        // Trigger cleanup if memory usage is high
        if (
          this.config.memoryManagement.enabled &&
          memory.usedJSHeapSize > this.config.memoryManagement.lowMemoryThreshold
        ) {
          this.performMemoryCleanup();
        }

        this.recordMemoryUsage(memoryInfo);
      }
    };

    setInterval(monitorMemory, 30000); // Monitor every 30 seconds
  }

  private initializeConnectionMonitoring(): void {
    if (!this.config.connectionAware) return;

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink
      };

      connection.addEventListener('change', () => {
        this.connectionInfo = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink
        };
        
        // Adjust prefetching strategy based on connection
        this.adjustPrefetchingStrategy();
      });
    }
  }

  private adjustPrefetchingStrategy(): void {
    const { effectiveType, downlink } = this.connectionInfo;
    
    // Disable prefetching on slow connections
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.config.prefetchOnHover = false;
      this.config.prefetchViewport = false;
    } else if (effectiveType === '3g' && downlink && downlink < 1.5) {
      // Only hover prefetching on slow 3G
      this.config.prefetchViewport = false;
    } else {
      // Re-enable on fast connections
      this.config.prefetchOnHover = true;
      this.config.prefetchViewport = true;
    }
  }

  private initializeViewportPrefetching(): void {
    if (!this.config.prefetchViewport) return;
    
    // Check if IntersectionObserver is available (not in test environment)
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('[PerformanceManager] IntersectionObserver not available, viewport prefetching disabled');
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const routeId = entry.target.getAttribute('data-prefetch-route');
            if (routeId) {
              this.prefetchRoute(routeId);
            }
          }
        });
      },
      {
        rootMargin: '100px' // Prefetch when element is 100px from viewport
      }
    );
  }

  private initializeMemoryManagement(): void {
    if (!this.config.memoryManagement.enabled) return;

    this.cleanupInterval = window.setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.memoryManagement.cleanupInterval);
  }

  private async preloadCriticalRoutes(): Promise<void> {
    if (!this.config.preloadCriticalRoutes?.length) return;

    // Wait for initial load to complete
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0);
      } else {
        window.addEventListener('load', () => resolve(void 0), { once: true });
      }
    });

    // Preload critical routes
    for (const routeId of this.config.preloadCriticalRoutes) {
      this.prefetchRoute(routeId, 'high');
    }
  }

  public startNavigationTiming(): void {
    this.navigationStart = performance.now();
  }

  public endNavigationTiming(route: Route): void {
    const navigationTime = performance.now() - this.navigationStart;
    
    this.recordMetric('navigation', navigationTime);
    
    // Record route-specific metrics
    const routeMetrics = this.metrics.get(route.id) || {} as PerformanceMetrics;
    routeMetrics.navigationTime = navigationTime;
    this.metrics.set(route.id, routeMetrics);
  }

  public async prefetchRoute(routeId: string, priority: ResourcePriority = 'auto'): Promise<void> {
    if (this.prefetchCache.has(routeId)) {
      const entry = this.prefetchCache.get(routeId)!;
      entry.accessed = true;
      return;
    }

    // Check connection conditions
    if (!this.shouldPrefetch()) return;

    try {
      // Create prefetch entry
      const entry: PrefetchEntry = {
        route: { id: routeId } as Route, // Simplified for prefetch
        priority,
        timestamp: Date.now(),
        accessed: false
      };

      this.prefetchCache.set(routeId, entry);

      // Perform actual prefetch based on priority
      await this.executePrefetch(entry);

    } catch (error) {
      console.warn(`[PerformanceManager] Prefetch failed for ${routeId}:`, error);
      this.prefetchCache.delete(routeId);
    }
  }

  private shouldPrefetch(): boolean {
    const { effectiveType, downlink } = this.connectionInfo;
    
    // Don't prefetch on slow connections
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return false;
    }
    
    // Conservative prefetching on 3G
    if (effectiveType === '3g' && downlink && downlink < 1.5) {
      return Math.random() < 0.3; // Only 30% chance
    }

    return true;
  }

  private async executePrefetch(entry: PrefetchEntry): Promise<void> {
    // This would integrate with the actual route loading logic
    // For now, just simulate prefetch timing
    const startTime = performance.now();
    
    // Simulate network request based on priority
    const delay = entry.priority === 'high' ? 100 : 
                  entry.priority === 'low' ? 500 : 300;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const loadTime = performance.now() - startTime;
    entry.size = Math.random() * 50000; // Simulate size
    
    this.recordMetric(`prefetch-${entry.route.id}`, loadTime);
  }

  public setupHoverPrefetch(element: Element, routeId: string): () => void {
    if (!this.config.prefetchOnHover) return () => {};

    const handleMouseEnter = () => {
      this.hoverTimer = window.setTimeout(() => {
        this.prefetchRoute(routeId, 'high');
      }, 100);
    };

    const handleMouseLeave = () => {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
      }
    };
  }

  public setupViewportPrefetch(element: Element, routeId: string): () => void {
    if (!this.intersectionObserver) return () => {};

    element.setAttribute('data-prefetch-route', routeId);
    this.intersectionObserver.observe(element);

    return () => {
      this.intersectionObserver?.unobserve(element);
      element.removeAttribute('data-prefetch-route');
    };
  }

  public performMemoryCleanup(): void {
    const now = Date.now();
    const { maxCacheAge, maxCacheSize } = this.config.memoryManagement;
    
    // Remove old entries
    const entriesToRemove: string[] = [];
    
    this.prefetchCache.forEach((entry, routeId) => {
      if (now - entry.timestamp > maxCacheAge) {
        entriesToRemove.push(routeId);
      }
    });

    // Remove old entries
    entriesToRemove.forEach(routeId => {
      this.prefetchCache.delete(routeId);
    });

    // If still over limit, remove least accessed entries
    if (this.prefetchCache.size > maxCacheSize) {
      const entries = Array.from(this.prefetchCache.entries())
        .sort(([, a], [, b]) => {
          // Sort by access status and timestamp
          if (a.accessed !== b.accessed) {
            return a.accessed ? 1 : -1;
          }
          return a.timestamp - b.timestamp;
        });

      const toRemove = entries.slice(0, entries.length - maxCacheSize);
      toRemove.forEach(([routeId]) => {
        this.prefetchCache.delete(routeId);
      });
    }
  }

  private recordMetric(name: string, value: number): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Store metric for later analysis
    console.log(`[PerformanceManager] ${name}: ${value.toFixed(2)}ms`);
  }

  private recordMemoryUsage(memoryInfo: any): void {
    // Store memory info for monitoring
    console.log('[PerformanceManager] Memory:', {
      used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
    });
  }

  public getPerformanceReport() {
    return {
      prefetchCacheSize: this.prefetchCache.size,
      metricsCount: this.metrics.size,
      connectionInfo: this.connectionInfo,
      memoryManagement: this.config.memoryManagement,
      prefetchHitRate: this.calculatePrefetchHitRate()
    };
  }

  private calculatePrefetchHitRate(): number {
    const totalEntries = this.prefetchCache.size;
    if (totalEntries === 0) return 0;

    const accessedEntries = Array.from(this.prefetchCache.values())
      .filter(entry => entry.accessed).length;

    return (accessedEntries / totalEntries) * 100;
  }

  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    this.intersectionObserver?.disconnect();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }
    
    this.prefetchCache.clear();
    this.metrics.clear();
  }
}

// Default configuration
export const defaultPerformanceConfig: Required<PerformanceConfig> = {
  prefetchOnHover: true,
  prefetchViewport: true,
  navigationTimeout: 10000,
  resourcePriority: 'auto',
  connectionAware: true,
  enablePerformanceMonitoring: true,
  preloadCriticalRoutes: [],
  memoryManagement: {
    enabled: true,
    maxCacheSize: 50,
    maxCacheAge: 30 * 60 * 1000,
    cleanupInterval: 5 * 60 * 1000,
    lowMemoryThreshold: 50 * 1024 * 1024
  }
};

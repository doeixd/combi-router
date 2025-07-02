// =================================================================
//
//      Combi-Router: Simple Layer Examples
//
//      Example layers that work with our custom layer system
//
// =================================================================

import type { ComposableRouterApi } from '../core/make-layered';

/**
 * Authentication layer that adds login/logout functionality
 */
export function createAuthLayer() {
  let currentUser: any = null;
  
  return function authLayer(router: ComposableRouterApi) {
    return {
      // Authentication state
      get currentUser() {
        return currentUser;
      },
      
      // Authentication methods
      isAuthenticated(): boolean {
        return currentUser !== null;
      },
      
      login(user: any): void {
        currentUser = user;
      },
      
      logout(): void {
        currentUser = null;
      },
      
      requireAuth(routeId: string): boolean {
        if (!this.isAuthenticated()) {
          console.warn(`Authentication required for route: ${routeId}`);
          return false;
        }
        return true;
      }
    };
  };
}

/**
 * Logging layer that adds navigation logging
 */
export function createLoggingLayer() {
  const logs: string[] = [];
  
  return function loggingLayer(router: ComposableRouterApi) {
    return {
      // Logging methods
      getNavigationLogs(): string[] {
        return [...logs];
      },
      
      clearLogs(): void {
        logs.length = 0;
      },
      
      // Enhanced navigation with logging
      async navigate(path: string, options?: any): Promise<boolean> {
        logs.push(`Navigating to: ${path}`);
        const result = await router.navigate(path, options);
        logs.push(`Navigation ${result ? 'succeeded' : 'failed'}: ${path}`);
        return result;
      }
    };
  };
}

/**
 * Caching layer that adds simple route caching
 */
export function createCachingLayer() {
  const cache = new Map<string, any>();
  
  return function cachingLayer(router: ComposableRouterApi) {
    return {
      // Cache methods
      getCached(key: string): any {
        return cache.get(key);
      },
      
      setCached(key: string, value: any): void {
        cache.set(key, value);
      },
      
      clearCache(): void {
        cache.clear();
      },
      
      // Route prefetching with caching
      async prefetchRoute(routeId: string): Promise<void> {
        if (!cache.has(routeId)) {
          // Simulate prefetch
          console.log(`Prefetching route: ${routeId}`);
          cache.set(routeId, { prefetched: true, timestamp: Date.now() });
        }
      }
    };
  };
}

/**
 * Analytics layer that tracks user interactions
 */
export function createAnalyticsLayer(config: { trackingId?: string } = {}) {
  const events: any[] = [];
  
  return function analyticsLayer(router: ComposableRouterApi) {
    return {
      // Analytics methods
      trackEvent(eventName: string, data?: any): void {
        events.push({
          name: eventName,
          data,
          timestamp: Date.now(),
          route: router.currentMatch?.route?.id
        });
        console.log(`[Analytics] ${eventName}`, data);
      },
      
      getEvents(): any[] {
        return [...events];
      },
      
      clearEvents(): void {
        events.length = 0;
      }
    };
  };
}

/**
 * Performance layer that adds timing and metrics
 */
export function createPerformanceLayer() {
  const metrics = new Map<string, number>();
  
  return function performanceLayer(router: ComposableRouterApi) {
    return {
      // Performance methods
      startTimer(name: string): void {
        metrics.set(`${name}_start`, performance.now());
      },
      
      endTimer(name: string): number {
        const start = metrics.get(`${name}_start`);
        if (start) {
          const duration = performance.now() - start;
          metrics.set(name, duration);
          return duration;
        }
        return 0;
      },
      
      getMetrics(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [key, value] of metrics) {
          if (!key.endsWith('_start')) {
            result[key] = value;
          }
        }
        return result;
      }
    };
  };
}

/**
 * Factory function that creates layers based on features
 */
export function createFeatureLayer(features: {
  auth?: boolean;
  logging?: boolean;
  caching?: boolean;
  analytics?: { trackingId?: string };
  performance?: boolean;
}) {
  return function featureLayer(router: ComposableRouterApi) {
    const extensions: any = {};
    
    if (features.auth) {
      Object.assign(extensions, createAuthLayer()(router));
    }
    
    if (features.logging) {
      Object.assign(extensions, createLoggingLayer()(router));
    }
    
    if (features.caching) {
      Object.assign(extensions, createCachingLayer()(router));
    }
    
    if (features.analytics) {
      Object.assign(extensions, createAnalyticsLayer(features.analytics)(router));
    }
    
    if (features.performance) {
      Object.assign(extensions, createPerformanceLayer()(router));
    }
    
    return extensions;
  };
}

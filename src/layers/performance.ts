// =================================================================
//
//      Combi-Router: Performance Layer
//
//      Performance optimization features as a composable layer
//
// =================================================================

/**
 * # Performance Layer
 *
 * Provides advanced performance optimization features including intelligent
 * prefetching, memory management, connection awareness, and performance monitoring.
 *
 * This layer enhances navigation with proactive loading strategies and
 * comprehensive performance tracking to improve user experience.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, withPerformance } from '@doeixd/combi-router';
 *
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withPerformance({
 *     prefetchOnHover: true,
 *     prefetchViewport: true,
 *     connectionAware: true
 *   }))
 *   ();
 *
 * // Performance methods are now available
 * await router.prefetchRoute('user', 'high');
 * router.setupHoverPrefetch(linkElement, 'about');
 * const report = router.getPerformanceReport();
 * ```
 *
 * @example Connection-Aware Configuration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withPerformance({
 *     prefetchOnHover: true,
 *     connectionAware: true,           // Adapts to connection speed
 *     memoryManagement: {
 *       enabled: true,
 *       maxCacheSize: 50,
 *       lowMemoryThreshold: 50 * 1024 * 1024  // 50MB
 *     }
 *   }))
 *   ();
 * ```
 *
 * ## Features Provided
 *
 * ### Intelligent Prefetching
 * - **Hover Prefetching**: Load routes when user hovers over links
 * - **Viewport Prefetching**: Load routes when links enter viewport
 * - **Connection Awareness**: Adapt strategy based on network conditions
 * - **Priority-based Loading**: High/low/auto priority prefetching
 *
 * ### Memory Management
 * - **Automatic Cache Cleanup**: Remove old prefetch entries
 * - **Memory Monitoring**: Track JS heap usage and trigger cleanup
 * - **Size-based Limits**: Configurable cache size limits
 * - **Age-based Expiration**: Time-based cache invalidation
 *
 * ### Performance Monitoring
 * - **Navigation Timing**: Track route loading performance
 * - **Web Vitals**: Monitor Core Web Vitals metrics
 * - **Prefetch Analytics**: Hit rate and efficiency metrics
 * - **Memory Usage**: Real-time memory consumption tracking
 *
 * ### Lifecycle Integration
 * - Hooks into navigation start/complete for timing
 * - Tracks route loading performance
 * - Automatic cleanup on router destruction
 *
 * ## Configuration Options
 *
 * ```typescript
 * interface PerformanceLayerConfig {
 *   prefetchOnHover?: boolean;          // Enable hover prefetching
 *   prefetchViewport?: boolean;         // Enable viewport prefetching
 *   navigationTimeout?: number;         // Navigation timeout in ms
 *   resourcePriority?: 'high' | 'low' | 'auto';  // Default priority
 *   connectionAware?: boolean;          // Adapt to connection speed
 *   enablePerformanceMonitoring?: boolean;  // Track performance metrics
 *   preloadCriticalRoutes?: string[];   // Routes to preload immediately
 *   memoryManagement?: {
 *     enabled: boolean;
 *     maxCacheSize: number;             // Max cached entries
 *     maxCacheAge: number;              // Max age in ms
 *     cleanupInterval: number;          // Cleanup frequency in ms
 *     lowMemoryThreshold: number;       // Memory limit in bytes
 *   };
 * }
 * ```
 */

import type { PerformanceLayerConfig } from "../core/layer-types";

import {
  PerformanceManager,
  type PerformanceConfig,
  defaultPerformanceConfig,
} from "../features/performance";

/**
 * Creates a performance optimization layer with intelligent prefetching and monitoring.
 *
 * This layer enhances the router with advanced performance features including
 * connection-aware prefetching, memory management, and comprehensive monitoring.
 *
 * @param config Configuration options for performance optimizations
 * @returns A router layer that adds performance capabilities
 *
 * @example Basic Performance Layer
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createPerformanceLayer({
 *     prefetchOnHover: true,
 *     connectionAware: true,
 *     enablePerformanceMonitoring: true
 *   }))
 *   ();
 *
 * // Use performance features
 * router.prefetchRoute('about');
 * router.setupHoverPrefetch(linkElement, 'user');
 * ```
 *
 * @example Memory-Optimized Configuration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createPerformanceLayer({
 *     memoryManagement: {
 *       enabled: true,
 *       maxCacheSize: 30,                    // Limit cached routes
 *       maxCacheAge: 10 * 60 * 1000,        // 10 minute TTL
 *       lowMemoryThreshold: 30 * 1024 * 1024 // 30MB threshold
 *     }
 *   }))
 *   ();
 * ```
 *
 * @example Production-Optimized Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createPerformanceLayer({
 *     prefetchOnHover: true,
 *     prefetchViewport: true,
 *     connectionAware: true,
 *     enablePerformanceMonitoring: true,
 *     preloadCriticalRoutes: ['home', 'about'],
 *     memoryManagement: {
 *       enabled: true,
 *       maxCacheSize: 50,
 *       cleanupInterval: 5 * 60 * 1000  // Cleanup every 5 minutes
 *     }
 *   }))
 *   ();
 * ```
 */
/**
 * Validates performance layer configuration
 */
function validatePerformanceConfig(
  config: PerformanceLayerConfig,
): PerformanceLayerConfig {
  const validated = { ...config };

  // Validate timeout values
  if (config.navigationTimeout !== undefined && config.navigationTimeout < 0) {
    console.warn("[PerformanceLayer] Invalid navigationTimeout, using default");
    validated.navigationTimeout = defaultPerformanceConfig.navigationTimeout;
  }

  // Validate memory management config
  if (config.memoryManagement) {
    if (
      config.memoryManagement.maxCacheSize !== undefined &&
      config.memoryManagement.maxCacheSize < 1
    ) {
      console.warn("[PerformanceLayer] Invalid maxCacheSize, using default");
      validated.memoryManagement = {
        ...defaultPerformanceConfig.memoryManagement,
        ...validated.memoryManagement,
        maxCacheSize: defaultPerformanceConfig.memoryManagement.maxCacheSize,
      };
    }
  }

  return validated;
}

export function createPerformanceLayer(config: PerformanceLayerConfig = {}) {
  // Validate and sanitize configuration
  const validatedConfig = validatePerformanceConfig(config);

  // Convert layer config to performance manager config
  const performanceConfig: PerformanceConfig = {
    prefetchOnHover:
      validatedConfig.prefetchOnHover ??
      defaultPerformanceConfig.prefetchOnHover,
    prefetchViewport:
      validatedConfig.prefetchViewport ??
      defaultPerformanceConfig.prefetchViewport,
    navigationTimeout:
      validatedConfig.navigationTimeout ??
      defaultPerformanceConfig.navigationTimeout,
    resourcePriority:
      validatedConfig.resourcePriority ??
      defaultPerformanceConfig.resourcePriority,
    connectionAware:
      validatedConfig.connectionAware ??
      defaultPerformanceConfig.connectionAware,
    enablePerformanceMonitoring:
      validatedConfig.enablePerformanceMonitoring ??
      defaultPerformanceConfig.enablePerformanceMonitoring,
    preloadCriticalRoutes:
      validatedConfig.preloadCriticalRoutes ??
      defaultPerformanceConfig.preloadCriticalRoutes,
    memoryManagement: {
      ...defaultPerformanceConfig.memoryManagement,
      ...validatedConfig.memoryManagement,
    },
  };

  // Create performance manager instance
  const performanceManager = new PerformanceManager(performanceConfig);

  // Return layer function that returns methods object
  return function performanceLayer() {
    return {
      prefetchRoute: (routeId: string) => {
        return performanceManager.prefetchRoute(routeId);
      },

      setupHoverPrefetch: (element: Element, routeId: string) => {
        return performanceManager.setupHoverPrefetch(element, routeId);
      },

      setupViewportPrefetch: (element: Element, routeId: string) => {
        return performanceManager.setupViewportPrefetch(element, routeId);
      },

      updatePerformanceConfig: (newConfig: Partial<PerformanceLayerConfig>) => {
        const updatedConfig = { ...validatedConfig, ...newConfig };
        performanceManager.updateConfig(updatedConfig);
      },

      getPerformanceReport: () => {
        return performanceManager.getPerformanceReport();
      },

      performMemoryCleanup: () => {
        performanceManager.performMemoryCleanup();
      },
    };
  };
}

// Type for the extensions this layer provides
export interface PerformanceLayerExtensions {
  performance: PerformanceManager;
  prefetchRoute: (
    routeId: string,
    priority?: "high" | "low" | "auto",
  ) => Promise<void>;
  setupHoverPrefetch: (element: Element, routeId: string) => () => void;
  setupViewportPrefetch: (element: Element, routeId: string) => () => void;
  updatePerformanceConfig: (config: Partial<PerformanceLayerConfig>) => void;
  getPerformanceReport: () => ReturnType<
    PerformanceManager["getPerformanceReport"]
  >;
  performMemoryCleanup: () => void;
}

// Convenience factory with default config
export const withPerformance = (config: PerformanceLayerConfig = {}) =>
  createPerformanceLayer(config);

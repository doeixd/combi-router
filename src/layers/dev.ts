// =================================================================
//
//      Combi-Router: Development Tools Layer
//
//      A comprehensive development layer that provides debugging tools,
//      performance monitoring, route validation, conflict detection,
//      and enhanced development workflows. This layer automatically
//      provides no-op implementations in production builds.
//
// =================================================================

import type {
  RouterLayer,
  ComposableRouter,
  RouterContext,
} from "../core/layer-types";
import {
  CombiRouterDevMode,
  enableDevMode,
  exposeDevTools,
  type DevModeConfig,
} from "../dev";

/**
 * Configuration options for the development tools layer.
 *
 * This interface extends the base DevModeConfig with layer-specific options
 * for controlling how development tools are exposed and configured.
 */
export interface DevLayerConfig extends Partial<DevModeConfig> {
  /**
   * Whether to expose dev tools to window for browser debugging.
   * When enabled, dev tools are accessible via `window.combiRouterDev`.
   *
   * @default false
   */
  exposeToWindow?: boolean;

  /**
   * Whether to automatically run initial route analysis when the router is created.
   * This includes conflict detection, validation checks, and structure analysis.
   *
   * @default true
   */
  autoAnalyze?: boolean;

  /**
   * Whether to log performance metrics and insights to the console.
   * Useful for development debugging and optimization.
   *
   * @default false
   */
  logPerformance?: boolean;
}

/**
 * Extensions added to the router by the development tools layer.
 *
 * These methods provide comprehensive development utilities including
 * debugging, performance monitoring, route analysis, and development reporting.
 * In production builds, these methods become no-ops to prevent overhead.
 */
export interface DevLayerExtensions {
  /**
   * The core development mode instance containing all dev tools.
   * Null in production builds for performance optimization.
   */
  devMode: CombiRouterDevMode | null;

  /**
   * Runs comprehensive development analysis including:
   * - Route conflict detection
   * - Route validation and structure analysis
   * - Performance bottleneck identification
   * - Development warning detection
   *
   * @example
   * ```typescript
   * const router = createLayeredRouter(routes)(devLayer())();
   * router.runDevAnalysis(); // Logs analysis results to console
   * ```
   */
  runDevAnalysis: () => void;

  /**
   * Returns a comprehensive development report containing:
   * - Route analysis and validation results
   * - Performance metrics and insights
   * - Development warnings and conflicts
   * - Optimization recommendations
   *
   * @returns Development report object or error in production
   *
   * @example
   * ```typescript
   * const report = router.getDevReport();
   * console.log(`Found ${report.warnings.length} warnings`);
   * console.log(`Performance score: ${report.performance?.score}/100`);
   * ```
   */
  getDevReport: () => any;

  /**
   * Logs a formatted development report to the console.
   * Includes summary statistics, performance metrics, and recommendations.
   *
   * @example
   * ```typescript
   * router.logDevReport();
   * // Output:
   * // [CombiRouter] Comprehensive Development Report
   * // Generated at: 2024-01-01T12:00:00.000Z
   * // Total Routes: 15
   * // Warnings: 2
   * // Performance Score: 85/100
   * ```
   */
  logDevReport: () => void;

  /**
   * Exports all development data as a JSON string.
   * Useful for sharing debugging information or automated analysis.
   *
   * @returns JSON string containing all development data
   *
   * @example
   * ```typescript
   * const devData = router.exportDevData();
   * localStorage.setItem('router-debug', devData);
   * // Or send to debugging service
   * await fetch('/api/debug', {
   *   method: 'POST',
   *   body: devData
   * });
   * ```
   */
  exportDevData: () => string;

  /**
   * Clears all development data and history including:
   * - Performance monitoring history
   * - Navigation traces
   * - Cached analysis results
   *
   * @example
   * ```typescript
   * router.clearDevData(); // Fresh start for development session
   * ```
   */
  clearDevData: () => void;

  /**
   * Updates the development mode configuration at runtime.
   * Allows enabling/disabling specific development features dynamically.
   *
   * @param config - Partial configuration to update
   *
   * @example
   * ```typescript
   * // Enable performance monitoring
   * router.updateDevConfig({
   *   performanceMonitoring: true,
   *   warnings: { runtimeWarnings: false }
   * });
   * ```
   */
  updateDevConfig: (config: Partial<DevModeConfig>) => void;
}

/**
 * Creates a development tools layer that provides comprehensive debugging,
 * performance monitoring, route analysis, and development utilities.
 *
 * This layer integrates all development tools from the `/dev` folder and provides
 * a unified interface for accessing development features. It automatically detects
 * the production environment and provides no-op implementations to prevent overhead.
 *
 * ## Features
 *
 * - **Route Analysis**: Validates routes, detects conflicts, analyzes complexity
 * - **Performance Monitoring**: Tracks navigation timing, loader performance, guard execution
 * - **Development Warnings**: Static and runtime warning system for development issues
 * - **Interactive Debugging**: Enhanced debugging tools and route introspection
 * - **Conflict Detection**: Identifies overlapping or conflicting route patterns
 * - **Browser Integration**: Optional window exposure for browser debugging
 *
 * ## Production Safety
 *
 * In production builds (`NODE_ENV === 'production'`), this layer automatically:
 * - Returns `null` for the `devMode` instance
 * - Provides no-op implementations for all methods
 * - Removes all development overhead
 * - Prevents accidental development code execution
 *
 * @param config - Configuration options for development tools
 * @returns Router layer that adds development tool extensions
 *
 * @example
 * ```typescript
 * // Basic development layer
 * const router = createLayeredRouter(routes)
 *   (devLayer())
 *   ();
 *
 * // With custom configuration
 * const router = createLayeredRouter(routes)
 *   (devLayer({
 *     exposeToWindow: true,        // Expose to window.combiRouterDev
 *     autoAnalyze: true,           // Run analysis on startup
 *     performanceMonitoring: true, // Enable performance tracking
 *     warnings: {
 *       runtimeWarnings: false     // Disable runtime warnings
 *     }
 *   }))
 *   ();
 *
 * // Use development features
 * router.runDevAnalysis();
 * const report = router.getDevReport();
 * router.logDevReport();
 *
 * // Access via window (if exposeToWindow: true)
 * window.combiRouterDev?.analyze();
 * window.combiRouterDev?.report();
 * ```
 *
 * @see {@link DevLayerConfig} for configuration options
 * @see {@link DevLayerExtensions} for available methods
 * @see {@link quickDevLayer} for a preconfigured development layer
 */
export function devLayer(
  config: DevLayerConfig = {},
): RouterLayer<RouterContext, DevLayerExtensions> {
  return (router: ComposableRouter<RouterContext>) => {
    if (process.env.NODE_ENV === "production") {
      // Return no-op implementations in production
      return {
        devMode: null,
        runDevAnalysis: () => {},
        getDevReport: () => ({
          error: "Development mode disabled in production",
        }),
        logDevReport: () =>
          console.log("[CombiRouter] Development mode disabled in production"),
        exportDevData: () => "{}",
        clearDevData: () => {},
        updateDevConfig: () => {},
      };
    }

    // Create a CombiRouter-compatible adapter
    const routerAdapter = {
      routes: router.routes,
      currentMatch: router.currentMatch,
      currentNavigation: router.currentNavigation,
      isNavigating: !!router.currentNavigation,
      isFetching: router.isFetching,
      isOnline: router.isOnline,
      subscribe: router.subscribe,

      // Add any missing methods that dev tools might need
      navigate: router.navigate,
      match: router.match,
      build: router.build,
      peek: router.peek,
      cancelNavigation: router.cancelNavigation,
      addRoute: router.addRoute,
      removeRoute: router.removeRoute,
    };

    // Initialize development mode
    const devModeConfig: DevModeConfig = {
      enabled: true,
      warnings: config.warnings ?? true,
      conflictDetection: config.conflictDetection ?? true,
      performanceMonitoring: config.performanceMonitoring ?? true,
      routeValidation: config.routeValidation ?? true,
      debugMode: config.debugMode ?? true,
      autoAnalyze: config.autoAnalyze ?? true,
      ...config,
    };

    const devMode = enableDevMode(routerAdapter as any, devModeConfig);

    // Expose to window if requested
    if (config.exposeToWindow && typeof window !== "undefined") {
      exposeDevTools(routerAdapter as any, devMode ?? undefined);
    }

    return {
      devMode,

      runDevAnalysis: () => {
        devMode?.runAnalysis();
      },

      getDevReport: () => {
        return (
          devMode?.getDevReport() || {
            error: "Development mode not initialized",
          }
        );
      },

      logDevReport: () => {
        devMode?.logDevReport();
      },

      exportDevData: () => {
        return devMode?.exportDevData() || "{}";
      },

      clearDevData: () => {
        devMode?.clearDevData();
      },

      updateDevConfig: (newConfig: Partial<DevModeConfig>) => {
        devMode?.updateConfig(newConfig);
      },
    };
  };
}

/**
 * Creates a development layer with sensible defaults for quick setup.
 *
 * This is a convenience function that configures the development layer with
 * commonly used settings for development workflows. It's equivalent to calling
 * `devLayer()` with a pre-configured set of options.
 *
 * ## Default Configuration
 *
 * - ✅ **Auto-analysis**: Runs route analysis on router creation
 * - ✅ **Window exposure**: Exposes dev tools to `window.combiRouterDev`
 * - ✅ **Performance logging**: Logs performance metrics to console
 * - ✅ **All development features**: Enables warnings, conflict detection, validation, debugging
 *
 * ## Production Safety
 *
 * Like `devLayer()`, this function is production-safe and becomes a no-op
 * when `NODE_ENV === 'production'`.
 *
 * @returns Router layer with preconfigured development tools
 *
 * @example
 * ```typescript
 * // Quick setup for development
 * const router = createLayeredRouter(routes)
 *   (quickDevLayer())  // All dev features enabled
 *   ();
 *
 * // Equivalent to:
 * const router = createLayeredRouter(routes)
 *   (devLayer({
 *     exposeToWindow: true,
 *     autoAnalyze: true,
 *     logPerformance: true,
 *     warnings: true,
 *     conflictDetection: true,
 *     performanceMonitoring: true,
 *     routeValidation: true,
 *     debugMode: true
 *   }))
 *   ();
 *
 * // Access dev tools immediately
 * window.combiRouterDev.analyze();  // Available on window
 * router.runDevAnalysis();          // Also available on router
 * ```
 *
 * @see {@link devLayer} for custom configuration options
 * @see {@link DevLayerConfig} for all available configuration options
 */
export function quickDevLayer(): RouterLayer<
  RouterContext,
  DevLayerExtensions
> {
  return devLayer({
    exposeToWindow: true,
    autoAnalyze: true,
    logPerformance: true,
    warnings: true,
    conflictDetection: true,
    performanceMonitoring: true,
    routeValidation: true,
    debugMode: true,
  });
}

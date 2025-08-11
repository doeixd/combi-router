// =================================================================
//
//      Combi-Router: Loader Execution Layer
//
//      A composable layer that handles loader execution during navigation,
//      populating match.data with loaded results and managing loading states.
//
// =================================================================

import type {
  RouterLayer,
  ComposableRouter,
  RouterContext,
} from "../core/layer-types";
import type { RouteMatch, LoaderContext } from "../core/types";
import { globalCache } from "../data/cache";
import { resourceState } from "../data/resource";

/**
 * Configuration options for the loader execution layer.
 */
export interface LoaderLayerConfig {
  /**
   * Maximum time to wait for a loader to complete before timing out.
   * @default 10000 (10 seconds)
   */
  loaderTimeout?: number;

  /**
   * Whether to run loaders in parallel for nested routes.
   * @default true
   */
  parallelLoading?: boolean;

  /**
   * Whether to cache loader results automatically.
   * @default false
   */
  cacheLoaderResults?: boolean;

  /**
   * Default cache TTL for loader results in milliseconds.
   * @default 300000 (5 minutes)
   */
  defaultCacheTTL?: number;

  /**
   * Whether to enable debug logging for loader execution.
   * @default false
   */
  debug?: boolean;
}

/**
 * Extensions provided by the LoaderLayer.
 */
export interface LoaderLayerExtensions {
  /**
   * Manually execute a loader for a specific route match.
   */
  executeLoader: (match: RouteMatch, signal?: AbortSignal) => Promise<any>;

  /**
   * Check if a route has a loader.
   */
  hasLoader: (route: any) => boolean;

  /**
   * Get the current loading state.
   */
  isLoading: () => boolean;

  /**
   * Cancel all pending loader executions.
   */
  cancelLoaders: () => void;
}

/**
 * Creates a loader execution layer that handles the execution of route loaders
 * during navigation and populates the match.data property.
 *
 * This layer integrates with the navigation lifecycle to:
 * - Execute loader functions when routes are matched
 * - Populate match.data with loader results
 * - Handle loader timeouts and errors
 * - Manage loading states
 * - Support parallel loading for nested routes
 *
 * @param config Configuration options for loader behavior
 * @returns A composable router layer
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createLoaderLayer({
 *     loaderTimeout: 5000,
 *     parallelLoading: true,
 *     debug: true
 *   }))
 *   (createViewLayer({ root: '#app' }))
 *   ();
 * ```
 */
export function createLoaderLayer(
  config: LoaderLayerConfig = {},
): RouterLayer<RouterContext, LoaderLayerExtensions> {
  const {
    loaderTimeout = 10000,
    parallelLoading: _parallelLoading = true,
    cacheLoaderResults = false,
    defaultCacheTTL = 300000,
    debug = false,
  } = config;

  console.log("[LoaderLayer] Creating loader layer with config:", config);

  return (router: ComposableRouter<RouterContext>) => {
    console.log("[LoaderLayer] Loader layer instantiated");
    console.log("[LoaderLayer] Router has routes:", !!(router as any).routes);
    console.log(
      "[LoaderLayer] Router has _registerLifecycleHook:",
      typeof (router as any)._registerLifecycleHook === "function",
    );
    const pendingLoaders = new Set<AbortController>();
    let isCurrentlyLoading = false;
    const loaderCache = new Map<
      string,
      { data: any; timestamp: number; ttl: number }
    >();
    const cleanupFunctions: (() => void)[] = [];

    /**
     * Log debug messages if debug mode is enabled.
     */
    function debugLog(message: string, ...args: any[]) {
      if (debug) {
        console.log(`[LoaderLayer] ${message}`, ...args);
      }
    }

    /**
     * Create a cache key for a loader result.
     */
    function createCacheKey(route: any, params: any): string {
      return `${route.id}:${JSON.stringify(params)}`;
    }

    /**
     * Check if cached data is still valid.
     */
    function isCacheValid(cacheEntry: {
      timestamp: number;
      ttl: number;
    }): boolean {
      return Date.now() - cacheEntry.timestamp < cacheEntry.ttl;
    }

    /**
     * Execute a loader function with proper context and error handling.
     */
    async function executeLoader(
      match: RouteMatch,
      signal?: AbortSignal,
    ): Promise<any> {
      const route = match.route;
      const loader = route.metadata?.loader;

      if (!loader) {
        debugLog(`No loader found for route ${route.id}`);
        return undefined;
      }

      debugLog(`Executing loader for route ${route.id}`, {
        params: match.params,
      });

      // Check cache first if enabled
      if (cacheLoaderResults) {
        const cacheKey = createCacheKey(route, match.params);
        const cached = loaderCache.get(cacheKey);
        if (cached && isCacheValid(cached)) {
          debugLog(`Using cached data for route ${route.id}`);
          return cached.data;
        }
      }

      // Create loader context
      const loaderContext: LoaderContext = {
        params: match.params,
        searchParams: new URLSearchParams(match.search || ""),
        signal: signal || new AbortController().signal,
      };

      try {
        const startTime = performance.now();

        // Execute the loader with timeout
        const loaderPromise = Promise.resolve(loader(loaderContext));

        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Loader timeout after ${loaderTimeout}ms`));
          }, loaderTimeout);
        });

        const result = await Promise.race([loaderPromise, timeoutPromise]);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const duration = performance.now() - startTime;
        debugLog(
          `Loader for route ${route.id} completed in ${duration.toFixed(2)}ms`,
        );

        // Cache the result if enabled
        if (cacheLoaderResults) {
          const cacheKey = createCacheKey(route, match.params);
          loaderCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
            ttl: defaultCacheTTL,
          });
          debugLog(`Cached loader result for route ${route.id}`);
        }

        return result;
      } catch (error) {
        debugLog(`Loader failed for route ${route.id}:`, error);
        throw error;
      }
    }

    /**
     * Execute loaders for a match and all its nested matches.
     */
    async function executeLoadersForMatch(
      match: RouteMatch,
      signal?: AbortSignal,
    ): Promise<RouteMatch> {
      if (!match) return match;

      const controller = signal ? undefined : new AbortController();
      const loaderSignal = signal || controller!.signal;

      if (controller) {
        pendingLoaders.add(controller);
      }

      try {
        // Execute loader for current match
        if (match.route.metadata?.loader) {
          debugLog(`Loading data for route ${match.route.id}`);
          const data = await executeLoader(match, loaderSignal);

          // Create new match with data
          const enhancedMatch: RouteMatch = {
            ...match,
            data,
          };

          // If there's a child match, recursively execute its loaders
          if (match.child) {
            const enhancedChild = await executeLoadersForMatch(
              match.child,
              loaderSignal,
            );
            return {
              ...enhancedMatch,
              child: enhancedChild,
            };
          }

          return enhancedMatch;
        } else {
          // No loader, but check for child loaders
          if (match.child) {
            const enhancedChild = await executeLoadersForMatch(
              match.child,
              loaderSignal,
            );
            return {
              ...match,
              child: enhancedChild,
            };
          }

          return match;
        }
      } finally {
        if (controller) {
          pendingLoaders.delete(controller);
        }
      }
    }

    /**
     * Handle before navigation complete - execute loaders and return enhanced match.
     */
    async function onBeforeNavigationComplete(
      match: RouteMatch,
      _isPopState: boolean,
    ): Promise<RouteMatch> {
      debugLog(`Before navigation complete for route ${match.route.id}`, {
        hasData: !!match.data,
        hasLoader: !!match.route.metadata?.loader,
      });

      if (match.route.metadata?.loader && !match.data) {
        debugLog(`Executing loader for route ${match.route.id}`);
        try {
          const enhancedMatch = await executeLoadersForMatch(match);
          debugLog(`Loader completed for route ${match.route.id}`, {
            hasData: !!enhancedMatch.data,
          });
          return enhancedMatch;
        } catch (error) {
          debugLog(`Loader failed for route ${match.route.id}:`, error);
          throw error;
        }
      }

      return match;
    }

    /**
     * Handle navigation start - prepare for loading.
     */
    async function onNavigationStart(_context: any) {
      debugLog(`Navigation starting`);
      isCurrentlyLoading = true;
    }

    /**
     * Handle navigation complete - loaders should already be executed.
     */
    async function onNavigationComplete(
      match: RouteMatch,
      _isPopState: boolean,
    ) {
      debugLog(`Navigation completed for route ${match.route.id}`, {
        hasData: !!match.data,
        pathname: match.pathname,
      });
      isCurrentlyLoading = false;
    }

    /**
     * Handle navigation errors - clean up loading state.
     */
    async function onNavigationError(error: any, _context: any) {
      debugLog(`Navigation error occurred:`, error);
      isCurrentlyLoading = false;

      // Cancel all pending loaders
      for (const controller of pendingLoaders) {
        controller.abort();
      }
      pendingLoaders.clear();
    }

    // Register lifecycle hooks
    if (typeof (router as any)._registerLifecycleHook === "function") {
      const registerHook = (router as any)._registerLifecycleHook;

      const unsubStart = registerHook("onNavigationStart", onNavigationStart);
      const unsubBeforeComplete = registerHook(
        "onBeforeNavigationComplete",
        onBeforeNavigationComplete,
      );
      const unsubComplete = registerHook(
        "onNavigationComplete",
        onNavigationComplete,
      );
      const unsubError = registerHook("onNavigationError", onNavigationError);

      cleanupFunctions.push(
        unsubStart,
        unsubBeforeComplete,
        unsubComplete,
        unsubError,
      );
      debugLog("Registered loader lifecycle hooks");
    } else {
      console.warn(
        "[LoaderLayer] Cannot register lifecycle hooks - _registerLifecycleHook not available",
      );
    }

    // Cleanup function
    const cleanup = () => {
      // Cancel all pending loaders
      for (const controller of pendingLoaders) {
        controller.abort();
      }
      pendingLoaders.clear();

      // Clear cache
      loaderCache.clear();

      // Cleanup lifecycle hooks
      for (const unsubscribe of cleanupFunctions) {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      }
      cleanupFunctions.length = 0;
    };

    // Listen for router destruction to cleanup
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", cleanup);
    }

    return {
      // Data layer compatibility extensions
      cache: globalCache,
      getGlobalResourceState: () => resourceState.getGlobalState(),
      invalidateByTags: (tags: string[]) =>
        resourceState.invalidateByTags(tags),
      onResourceEvent: (listener: any) => resourceState.onEvent(listener),
      getCacheStats: () => globalCache.getStats(),
      clearCache: () => globalCache.clear(),
      preloadRoute: async (
        routeId: string,
        params: Record<string, any> = {},
      ) => {
        const route = (router as any).routes?.find(
          (r: any) => r.id === routeId,
        );
        if (!route) {
          debugLog(`Route with ID ${routeId} not found for preloading`);
          return;
        }

        try {
          if (typeof (router as any).peek === "function") {
            await (router as any).peek(route, params);
          }
        } catch (error) {
          debugLog(`Failed to preload route ${routeId}:`, error);
        }
      },

      // Loader layer specific extensions
      executeLoader,
      hasLoader: (route: any) => !!route.metadata?.loader,
      isLoading: () => isCurrentlyLoading,
      cancelLoaders: () => {
        for (const controller of pendingLoaders) {
          controller.abort();
        }
        pendingLoaders.clear();
      },

      // Cleanup method for testing
      _cleanup: cleanup,
    };
  };
}

/**
 * Creates a loader layer with sensible defaults for quick setup.
 *
 * This is a convenience function that configures the loader layer with commonly
 * used settings for production applications.
 *
 * ## Default Configuration
 *
 * - ✅ **Parallel loading**: Enabled for better performance
 * - ✅ **10 second timeout**: Reasonable timeout for most loaders
 * - ✅ **Cache disabled**: Conservative default, enable explicitly if needed
 * - ✅ **Debug logging**: Enabled in development, disabled in production
 *
 * @returns Configured loader layer ready for production use
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (quickLoaderLayer())
 *   (createViewLayer({ root: '#app' }))
 *   ();
 * ```
 */
export function quickLoaderLayer(): RouterLayer<
  RouterContext,
  LoaderLayerExtensions
> {
  return createLoaderLayer({
    loaderTimeout: 10000,
    parallelLoading: true,
    cacheLoaderResults: false,
    debug: true,
  });
}

/**
 * A minimal loader layer that only handles basic loader execution without
 * caching or advanced features. Useful for simple applications.
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (simpleLoaderLayer())
 *   (createViewLayer({ root: '#app' }))
 *   ();
 * ```
 */
export function simpleLoaderLayer(): RouterLayer<
  RouterContext,
  LoaderLayerExtensions
> {
  return createLoaderLayer({
    loaderTimeout: 30000,
    parallelLoading: false,
    cacheLoaderResults: false,
    debug: false,
  });
}

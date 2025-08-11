// =================================================================
//
//      Combi-Router: Core Navigation Layer
//
//      Core navigation functionality as a composable layer
//
// =================================================================

/**
 * # Core Navigation Layer
 *
 * The foundational layer that provides essential routing functionality including
 * navigation, URL matching, route building, and lifecycle management.
 *
 * This layer serves as the base for all other layers and should typically be
 * the first layer applied to any router.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer } from '@doeixd/combi-router';
 *
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   ();
 *
 * // Core navigation methods are now available
 * await router.navigate('/user/123');
 * const userUrl = router.build(userRoute, { id: 123 });
 * const match = router.match('/about');
 * ```
 *
 * @example With Additional Layers
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())           // Always first
 *   (withPerformance())                     // Builds on core
 *   (withScrollRestoration())               // Builds on core + performance
 *   ();
 * ```
 *
 * ## Features Provided
 *
 * ### Navigation Methods
 * - `navigate(path, options?)` - Navigate to a URL with detailed error handling
 * - `replace(path, options?)` - Navigate with history replacement
 * - `cancelNavigation()` - Cancel ongoing navigation
 *
 * ### URL Utilities
 * - `build(route, params)` - Generate URLs from route objects
 * - `match(path)` - Match URLs to route objects
 * - `getRouteTree()` - Debug utility for route inspection
 *
 * ### Lifecycle Management
 * - Lifecycle hook registration for other layers
 * - Navigation state management (current match, ongoing navigation)
 * - Browser event handling (popstate, online/offline, bfcache)
 *
 * ### Event Management
 * - Route change subscriptions
 * - Error handling and fallback routes
 * - Navigation state tracking
 *
 * ## Lifecycle Hooks
 *
 * Other layers can register hooks that fire during navigation:
 *
 * - `onNavigationStart` - Before navigation begins
 * - `onNavigationComplete` - After successful navigation
 * - `onNavigationError` - When navigation fails
 * - `onRouteLoad` - When route loading begins
 * - `onDestroy` - When router is cleaned up
 *
 * @example Registering Lifecycle Hooks (for layer authors)
 * ```typescript
 * const customLayer = (self) => {
 *   // Register a hook to track page views
 *   self._registerLifecycleHook('onNavigationComplete', (match) => {
 *     analytics.track('page_view', { path: match.path });
 *   });
 *
 *   return {
 *     // Custom layer methods...
 *   };
 * };
 * ```
 */

import type { Route, RouteMatch, NavigationContext } from "../core/types";
import type { NavigationOptions } from "../core/layer-types";
import {
  createErrorStrategy,
  type ErrorStrategyConfig,
} from "./strategies/error-strategy";

/**
 * Configuration options for the core navigation layer.
 */
export interface CoreNavigationLayerConfig {
  /**
   * Error handling strategy configuration.
   * - 'throw': All errors cause promise rejection (default, backward compatible)
   * - 'graceful': Errors are handled through lifecycle hooks only
   * - 'selective': Custom control over which errors throw
   * - Custom ErrorStrategy object for full control
   */
  errorStrategy?: ErrorStrategyConfig | "throw" | "graceful" | "selective";

  /**
   * Options for selective error strategy (when errorStrategy is 'selective').
   */
  selectiveStrategyOptions?: {
    throwNotFound?: boolean;
    throwLoaderError?: boolean;
    throwGuardRejection?: boolean;
    throwNavigationError?: boolean;
  };
}

/**
 * Creates the core navigation layer that provides essential routing functionality.
 *
 * This layer must typically be applied first as it provides the foundational
 * navigation methods that other layers depend on.
 *
 * @returns A router layer that adds core navigation capabilities
 *
 * @example Basic Router
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   ();
 *
 * await router.navigate('/users/123');
 * ```
 *
 * @example As Foundation for Other Layers
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())     // Foundation layer
 *   (withPerformance())               // Builds on navigation
 *   (customAnalyticsLayer())          // Uses navigation hooks
 *   ();
 * ```
 */
export function createCoreNavigationLayer(
  config: CoreNavigationLayerConfig = {},
) {
  // Initialize error strategy
  const strategy =
    config.errorStrategy === "selective"
      ? createErrorStrategy("selective", config.selectiveStrategyOptions)
      : createErrorStrategy(config.errorStrategy || "throw");

  // Private state for this layer
  let navigationId = 0;
  let navigationTimeout: number | undefined;
  const lifecycleHooks = new Map<string, Function[]>();

  // Helper functions
  function registerLifecycleHook(hookName: string, fn: Function): () => void {
    if (!lifecycleHooks.has(hookName)) {
      lifecycleHooks.set(hookName, []);
    }
    lifecycleHooks.get(hookName)!.push(fn);

    // Return unsubscribe function
    return () => {
      const hooks = lifecycleHooks.get(hookName);
      if (hooks) {
        const index = hooks.indexOf(fn);
        if (index > -1) {
          hooks.splice(index, 1);
        }
      }
    };
  }

  async function callLifecycleHook(
    hookName: string,
    ...args: any[]
  ): Promise<any> {
    const hooks = lifecycleHooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      // For onBeforeNavigationComplete, return the first argument (match) unchanged
      if (hookName === "onBeforeNavigationComplete") {
        return args[0];
      }
      return;
    }

    if (hookName === "onBeforeNavigationComplete") {
      // For onBeforeNavigationComplete, execute hooks sequentially and pass results through
      let currentMatch = args[0];
      for (const hook of hooks) {
        try {
          const result = await Promise.resolve(hook(currentMatch, args[1]));
          if (result) {
            currentMatch = result;
          }
        } catch (error) {
          console.error(`[CoreLayer] Error in ${hookName} hook:`, error);
          throw error;
        }
      }
      return currentMatch;
    } else {
      // For other hooks, execute in parallel and don't return values
      await Promise.all(
        hooks.map((hook) => {
          try {
            return Promise.resolve(hook(...args));
          } catch (error) {
            console.error(`[CoreLayer] Error in ${hookName} hook:`, error);
            return Promise.resolve();
          }
        }),
      );
    }
  }

  async function navigateToURL(
    self: any,
    url: string,
    isPopState = false,
    options: any = {},
  ): Promise<boolean> {
    // Validate input parameters
    if (!url || typeof url !== "string" || url.trim() === "") {
      console.error("[CoreLayer] Invalid URL provided:", url);
      return false;
    }

    const currentNavId = ++navigationId;

    // Fire navigation start hook
    await callLifecycleHook("onNavigationStart", { url, isPopState, options });

    try {
      // Cancel any existing navigation with warning
      const currentNav =
        typeof self.currentNavigation === "function"
          ? self.currentNavigation()
          : self.currentNavigation;
      if (currentNav && !isPopState) {
        console.warn(
          "[CoreLayer] Navigation already in progress, cancelling previous navigation",
        );
        currentNav.cancel();
      }

      // Parse and match the URL
      const newMatch = matchRoute(self, url);
      const context =
        typeof self.context === "function"
          ? self.context()
          : self.context || self;
      if (!newMatch && !(context as any).fallbackRoute) {
        const error = new Error(
          `No route matches: ${url} and no fallback route configured`,
        );

        // Fire navigation error hook for 404
        await callLifecycleHook("onNavigationError", error, {
          url,
          isPopState,
          options,
          type: "not-found",
        });

        // Check strategy for whether to throw
        if (strategy.shouldThrowNotFound(url)) {
          throw error;
        }

        // Clear navigation state and return false
        self._setCurrentNavigation(null);
        return false;
      }

      let targetMatch = newMatch;
      if (!targetMatch && (context as any).fallbackRoute) {
        console.warn(
          `[CoreLayer] No route matches "${url}", using fallback route`,
        );
        const fallbackRoute = (context as any).fallbackRoute;
        // Create a match for the fallback route directly
        targetMatch = {
          route: fallbackRoute,
          params: {},
          pathname: url,
          search: "",
          hash: "",
        };
      }

      if (!targetMatch) {
        const error = new Error(
          `No route matches: ${url} and fallback route resolution failed`,
        );

        // Fire navigation error hook
        await callLifecycleHook("onNavigationError", error, {
          url,
          isPopState,
          options,
          type: "not-found",
        });

        // Check strategy for whether to throw
        if (strategy.shouldThrowNotFound(url)) {
          throw error;
        }

        // Clear navigation state and return false
        self._setCurrentNavigation(null);
        return false;
      }

      // Create navigation controller
      const controller = new AbortController();
      const navigationController = {
        id: currentNavId,
        url,
        route: targetMatch.route,
        params: targetMatch.params,
        isPopState,
        startTime: performance.now(),
        cancel: () => controller.abort(),
        cancelled: false,
        promise: Promise.resolve({ success: false }),
      };

      self._setCurrentNavigation(navigationController);

      // Set up timeout
      if (options.timeout) {
        navigationTimeout = window.setTimeout(() => {
          controller.abort();
        }, options.timeout);
      }

      // Check if navigation was cancelled
      const activeNav =
        typeof self.currentNavigation === "function"
          ? self.currentNavigation()
          : self.currentNavigation;
      if (controller.signal.aborted || activeNav?.id !== currentNavId) {
        return false;
      }

      // Update URL if not a popstate event
      if (!isPopState && typeof window !== "undefined") {
        const method = options.replace ? "replaceState" : "pushState";
        window.history[method]({ url }, "", url);
      }

      // Fire before navigation complete hook (allows modification of match)
      const enhancedMatch =
        (await callLifecycleHook(
          "onBeforeNavigationComplete",
          targetMatch,
          isPopState,
        )) || targetMatch;

      // Update current match
      self._setCurrentMatch(enhancedMatch);
      self._setCurrentNavigation(null);

      // Clear timeout
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = undefined;
      }

      // Fire navigation complete hook
      await callLifecycleHook(
        "onNavigationComplete",
        enhancedMatch,
        isPopState,
      );

      // Notify listeners
      self._notifyListeners();

      return true;
    } catch (error) {
      // Clear timeout on error
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = undefined;
      }

      self._setCurrentNavigation(null);

      // Always fire navigation error hook (separate error channel)
      await callLifecycleHook("onNavigationError", error, {
        url,
        isPopState,
        options,
      });

      // Call user error handler
      const context =
        typeof self.context === "function"
          ? self.context()
          : self.context || self;
      if ((context as any).onError) {
        (context as any).onError({
          error: error as Error,
          route: null,
          path: url,
          params: {},
          query: {},
        });
      }

      // Check strategy to determine if we should throw
      let shouldThrow = false;

      // Determine error type and check strategy
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Loader")) {
        shouldThrow = strategy.shouldThrowLoaderError(error as Error);
      } else if (errorMessage.includes("Guard")) {
        shouldThrow = strategy.shouldThrowGuardRejection(error);
      } else {
        shouldThrow = strategy.shouldThrowNavigationError(error as Error);
      }

      if (shouldThrow) {
        throw error;
      }

      // Graceful handling - return false
      return false;
    }
  }

  function buildURL(
    self: any,
    route: any,
    params: Record<string, any>,
  ): string | null {
    try {
      if (!route?.path) {
        // Try to get path from matchers
        if (route?.matchers) {
          const pathMatcher = route.matchers.find(
            (m: any) => m.type === "path",
          );
          if (pathMatcher && pathMatcher.build) {
            // Use the build function to construct the path
            const builtPath = pathMatcher.build(params || {});
            // Clean up path (remove duplicate slashes)
            const cleanPath = builtPath.replace(/\/+/g, "/");
            return cleanPath;
          }
        }
        return null;
      }

      let path = route.path;

      // Replace path parameters
      for (const [key, value] of Object.entries(params || {})) {
        const paramPattern = new RegExp(`:${key}\\b`, "g");
        path = path.replace(paramPattern, String(value));
      }

      // Check for unresolved parameters
      if (path.includes(":")) {
        console.warn(`[CoreLayer] Unresolved parameters in route: ${path}`);
        return null;
      }

      // Add base URL if configured
      const context =
        typeof self.context === "function"
          ? self.context()
          : self.context || self;
      if (context.baseURL) {
        path =
          context.baseURL.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
      }

      return path;
    } catch (error) {
      console.error("[CoreLayer] Error building URL:", error);
      return null;
    }
  }

  function matchRoute(self: any, path: string): any | null {
    try {
      const context =
        typeof self.context === "function"
          ? self.context()
          : self.context || self;

      // Remove base URL if present
      let normalizedPath = path;
      if (context.baseURL) {
        const baseURL = context.baseURL.replace(/\/$/, "");
        if (normalizedPath.startsWith(baseURL)) {
          normalizedPath = normalizedPath.slice(baseURL.length) || "/";
        }
      }

      // Hash mode handling
      if (context.hashMode) {
        const hashIndex = normalizedPath.indexOf("#");
        if (hashIndex >= 0) {
          normalizedPath = normalizedPath.slice(hashIndex + 1) || "/";
        }
      }

      // Split path and query
      const [pathname, search] = normalizedPath.split("?");
      const searchParams = new URLSearchParams(search || "");

      // Find matching route using Route parser
      console.log(`[CoreLayer] Attempting to match path: "${pathname}"`);
      console.log(
        `[CoreLayer] Available routes:`,
        self.routes().map((r: any) => ({ id: r.id, staticPath: r.staticPath })),
      );

      for (const route of self.routes()) {
        try {
          console.log(
            `[CoreLayer] Testing route ${route.id} (staticPath: ${route.staticPath})`,
          );

          // Use the route's parser to match the path
          const parseResult = route.parser.run({ input: pathname, index: 0 });
          console.log(`[CoreLayer] Parse result for route ${route.id}:`, {
            type: parseResult.type,
            index:
              parseResult.type === "success" ? parseResult.state.index : "N/A",
            pathLength: pathname.length,
            fullMatch:
              parseResult.type === "success" &&
              parseResult.state.index === pathname.length,
            value: parseResult.type === "success" ? parseResult.value : "N/A",
          });

          if (
            parseResult.type === "success" &&
            parseResult.state.index === pathname.length
          ) {
            // Successfully parsed the entire path
            const pathParams =
              parseResult.value?.path || parseResult.value || {};

            // Process query parameters if the route defines any
            const queryMatchers = route.matchers.filter(
              (m: any) => m.type === "query",
            );
            const queryParams: Record<string, any> = {};

            for (const queryMatcher of queryMatchers) {
              const paramName = queryMatcher.paramName;
              const rawValue = searchParams.get(paramName);

              if (rawValue !== null && queryMatcher.schema) {
                // Validate query parameter using its schema
                const validationResult =
                  queryMatcher.schema["~standard"].validate(rawValue);
                if (validationResult.value !== undefined) {
                  queryParams[paramName] = validationResult.value;
                } else {
                  // Invalid query parameter - route doesn't match
                  continue;
                }
              }
            }

            console.log(
              `[CoreLayer] ✓ Route ${route.id} matched successfully!`,
            );

            return {
              route,
              params: { ...pathParams, ...queryParams },
              query: Object.fromEntries(searchParams.entries()),
              path: normalizedPath,
              pathname,
              search: search || "",
            };
          }
        } catch (error) {
          console.log(`[CoreLayer] ✗ Route ${route.id} parser error:`, error);
          // Parser failed for this route, try next one
          continue;
        }
      }

      console.log(`[CoreLayer] ✗ No routes matched path: "${pathname}"`);
      return null;
    } catch (error) {
      console.error("[CoreLayer] Error matching route:", error);
      return null;
    }
  }

  // Route pattern matching helper - DEPRECATED, using Route.parser instead
  // This function is kept for backward compatibility but is no longer used
  // @ts-ignore - Intentionally unused deprecated function
  function _deprecatedMatchRoutePattern(
    _route: any,
    _pathname: string,
  ): { params: Record<string, string> } | null {
    // This function is now unused - matching is done via Route.parser in matchRoute()
    return null;
  }

  function cancelNavigation(self: any): boolean {
    const currentNav =
      typeof self.currentNavigation === "function"
        ? self.currentNavigation()
        : self.currentNavigation;
    if (currentNav) {
      currentNav.cancel();
      self._setCurrentNavigation(null);
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = undefined;
      }
      return true;
    }
    return false;
  }

  function getRouteTree(self: any): string {
    try {
      return self
        .routes()
        .map(
          (route: any) =>
            buildURL(self, route, {}) || `[Dynamic: ${route.name || route.id}]`,
        )
        .sort()
        .join("\n");
    } catch (error) {
      console.error("[CoreLayer] Error generating route tree:", error);
      return "[]";
    }
  }

  // Return layer function that returns methods object bound to router context
  return function coreNavigationLayer(router: any) {
    return {
      navigate: (path: string, options: any = {}) => {
        return navigateToURL(router, path, false, options);
      },

      replace: (path: string, options: any = {}) => {
        return navigateToURL(router, path, false, {
          ...options,
          replace: true,
        });
      },

      build: (route: any, params: Record<string, any>) => {
        return buildURL(router, route, params);
      },

      match: (path: string) => {
        return matchRoute(router, path);
      },

      cancelNavigation: () => {
        return cancelNavigation(router);
      },

      getRouteTree: () => {
        return getRouteTree(router);
      },

      _registerLifecycleHook: (hookName: string, fn: Function) => {
        return registerLifecycleHook(hookName, fn);
      },

      _callLifecycleHook: (hookName: string, ...args: any[]) => {
        return callLifecycleHook(hookName, ...args);
      },
    };
  };
}

// End of createCoreNavigationLayer

// Type for the extensions this layer provides
export interface CoreNavigationExtensions {
  navigate: (path: string, options?: NavigationOptions) => Promise<boolean>;
  replace: (path: string, options?: NavigationOptions) => Promise<boolean>;
  build: (route: Route<any>, params: Record<string, any>) => string | null;
  match: (path: string) => RouteMatch<any> | null;
  cancelNavigation: () => boolean;
  getRouteTree: () => string;
  _navigateToURL: (
    url: string,
    isPopState?: boolean,
    options?: NavigationOptions,
  ) => Promise<boolean>;
  _handlePopstate: (url: string) => Promise<boolean>;
  _lifecycleHooks: Map<string, Function[]>;
  _registerLifecycleHook: (hookName: string, fn: Function) => void;
  _callLifecycleHook: (hookName: string, ...args: any[]) => Promise<void>;
}

// Lifecycle hooks interface for layers to implement
export interface LayerLifecycleHooks {
  onNavigationStart?: (context: NavigationContext) => void | Promise<void>;
  onNavigationComplete?: (
    match: RouteMatch<any>,
    isPopState?: boolean,
  ) => void | Promise<void>;
  onNavigationError?: (
    error: Error,
    context: NavigationContext,
  ) => void | Promise<void>;
  onRouteLoad?: (route: Route<any>) => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
}

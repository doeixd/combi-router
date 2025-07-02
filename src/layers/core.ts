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

import type { 
  Route, 
  RouteMatch, 
  NavigationController,
  NavigationContext,
  ErrorContext 
} from '../core/types';
import type { 
  RouterLayer, 
  RouterContext, 
  ComposableRouter,
  NavigationOptions 
} from '../core/layer-types';

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
export function createCoreNavigationLayer() {
  // Private state for this layer
  let navigationId = 0;
  let navigationTimeout: number | undefined;

  // Helper functions
  async function navigateToURL(
    self: any, 
    url: string, 
    isPopState = false, 
    options: any = {}
  ): Promise<boolean> {
    // Validate input parameters
    if (!url || typeof url !== 'string' || url.trim() === '') {
      console.error('[CoreLayer] Invalid URL provided:', url);
      return false;
    }

    const currentNavId = ++navigationId;
    
    try {
      // Cancel any existing navigation with warning  
      const currentNav = typeof self.currentNavigation === 'function' ? self.currentNavigation() : self.currentNavigation;
      if (currentNav && !isPopState) {
        console.warn('[CoreLayer] Navigation already in progress, cancelling previous navigation');
        currentNav.cancel();
      }

      // Parse and match the URL
      const newMatch = matchRoute(self, url);
      const context = typeof self.context === 'function' ? self.context() : self.context || self;
      if (!newMatch && !(context as any).fallbackRoute) {
        throw new Error(`No route matches: ${url} and no fallback route configured`);
      }

      let targetMatch = newMatch;
      if (!targetMatch && (context as any).fallbackRoute) {
        console.warn(`[CoreLayer] No route matches "${url}", using fallback route`);
        const fallbackRoute = (context as any).fallbackRoute;
        const fallbackUrl = buildURL(self, fallbackRoute, {});
        if (fallbackUrl) {
          targetMatch = matchRoute(self, fallbackUrl);
        }
      }

      if (!targetMatch) {
        throw new Error(`No route matches: ${url} and fallback route resolution failed`);
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
        promise: Promise.resolve({ success: false })
      };

      self._setCurrentNavigation(navigationController);

      // Set up timeout
      if (options.timeout) {
        navigationTimeout = window.setTimeout(() => {
          controller.abort();
        }, options.timeout);
      }

      // Check if navigation was cancelled
      const activeNav = typeof self.currentNavigation === 'function' ? self.currentNavigation() : self.currentNavigation;
      if (controller.signal.aborted || activeNav?.id !== currentNavId) {
        return false;
      }

      // Update URL if not a popstate event
      if (!isPopState && typeof window !== 'undefined') {
        const method = options.replace ? 'replaceState' : 'pushState';
        window.history[method]({ url }, '', url);
      }

      // Update current match
      self._setCurrentMatch(targetMatch);
      self._setCurrentNavigation(null);

      // Clear timeout
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = undefined;
      }

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

      // Call user error handler
      const context = typeof self.context === 'function' ? self.context() : self.context || self;
      if ((context as any).onError) {
        (context as any).onError({
          error: error as Error,
          route: null,
          path: url,
          params: {},
          query: {}
        });
      }

      return false;
    }
  }

  function buildURL(self: any, route: any, params: Record<string, any>): string | null {
    try {
      if (!route?.path) {
        // Try to get path from matchers
        if (route?.matchers) {
          const pathMatcher = route.matchers.find((m: any) => m.type === 'path');
          if (pathMatcher && pathMatcher.build) {
            // Use the build function to construct the path
            const builtPath = pathMatcher.build(params || {});
            // Clean up path (remove duplicate slashes)
            const cleanPath = builtPath.replace(/\/+/g, '/');
            return cleanPath;
          }
        }
        return null;
      }

      let path = route.path;
      
      // Replace path parameters
      for (const [key, value] of Object.entries(params || {})) {
        const paramPattern = new RegExp(`:${key}\\b`, 'g');
        path = path.replace(paramPattern, String(value));
      }

      // Check for unresolved parameters
      if (path.includes(':')) {
        console.warn(`[CoreLayer] Unresolved parameters in route: ${path}`);
        return null;
      }

      // Add base URL if configured
      const context = typeof self.context === 'function' ? self.context() : self.context || self;
      if (context.baseURL) {
        path = context.baseURL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
      }

      return path;
    } catch (error) {
      console.error('[CoreLayer] Error building URL:', error);
      return null;
    }
  }

  function matchRoute(self: any, path: string): any | null {
    try {
      const context = typeof self.context === 'function' ? self.context() : self.context || self;
      
      // Remove base URL if present
      let normalizedPath = path;
      if (context.baseURL) {
        const baseURL = context.baseURL.replace(/\/$/, '');
        if (normalizedPath.startsWith(baseURL)) {
          normalizedPath = normalizedPath.slice(baseURL.length) || '/';
        }
      }

      // Hash mode handling
      if (context.hashMode) {
        const hashIndex = normalizedPath.indexOf('#');
        if (hashIndex >= 0) {
          normalizedPath = normalizedPath.slice(hashIndex + 1) || '/';
        }
      }

      // Split path and query
      const [pathname, search] = normalizedPath.split('?');
      const query = new URLSearchParams(search || '');

      // Find matching route
      for (const route of self.routes()) {
        const match = matchRoutePattern(route, pathname);
        if (match) {
          return {
            route,
            params: match.params,
            query: Object.fromEntries(query.entries()),
            path: normalizedPath,
            pathname,
            search: search || ''
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[CoreLayer] Error matching route:', error);
      return null;
    }
  }

  // Route pattern matching helper
  function matchRoutePattern(route: any, pathname: string): { params: Record<string, string> } | null {
    let routePattern = route.path;
    
    // If route doesn't have a path property, extract from matchers
    if (!routePattern && route.matchers) {
      const pathMatcher = route.matchers.find((m: any) => m.type === 'path');
      if (pathMatcher && pathMatcher.build) {
        routePattern = pathMatcher.build({}).replace(/\/+/g, '/');
      }
    }
    
    if (!routePattern) return null;
    
    const routeParts = routePattern.split('/');
    const pathParts = pathname.split('/');

    if (routeParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart.startsWith(':')) {
        // Parameter
        const paramName = routePart.slice(1);
        params[paramName] = decodeURIComponent(pathPart);
      } else if (routePart !== pathPart) {
        // Exact match required
        return null;
      }
    }

    return { params };
  }

  function cancelNavigation(self: any): boolean {
    const currentNav = typeof self.currentNavigation === 'function' ? self.currentNavigation() : self.currentNavigation;
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
      return self.routes()
        .map((route: any) => buildURL(self, route, {}) || `[Dynamic: ${route.name || route.id}]`)
        .sort()
        .join('\n');
    } catch (error) {
      console.error('[CoreLayer] Error generating route tree:', error);
      return '[]';
    }
  }

  // Return layer function that returns methods object bound to router context
  return function coreNavigationLayer(router: any) {
    return {
    navigate: (path: string, options: any = {}) => {
      return navigateToURL(router, path, false, options);
    },
    
    replace: (path: string, options: any = {}) => {
      return navigateToURL(router, path, false, { ...options, replace: true });
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
    }
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
  _navigateToURL: (url: string, isPopState?: boolean, options?: NavigationOptions) => Promise<boolean>;
  _handlePopstate: (url: string) => Promise<boolean>;
  _lifecycleHooks: Map<string, Function[]>;
  _registerLifecycleHook: (hookName: string, fn: Function) => void;
  _callLifecycleHook: (hookName: string, ...args: any[]) => Promise<void>;
}

// Lifecycle hooks interface for layers to implement
export interface LayerLifecycleHooks {
  onNavigationStart?: (context: NavigationContext) => void | Promise<void>;
  onNavigationComplete?: (match: RouteMatch<any>, isPopState?: boolean) => void | Promise<void>;
  onNavigationError?: (error: Error, context: NavigationContext) => void | Promise<void>;
  onRouteLoad?: (route: Route<any>) => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
}

// =================================================================
//
//      Combi-Router: Fixed Layered Router Implementation
//
//      Main implementation using makeLayered pattern for composability
//
// =================================================================

import { makeLayered } from "./make-layered";
import type {
  Route,
  RouteMatch,
  NavigationController,
  RouterOptions,
} from "./types";
import type { RouterContext } from "./layer-types";
import { CombiRouter } from "./router";

export function createComposableRouter(
  routes: Route<any>[],
  options: {
    baseURL?: string;
    hashMode?: boolean;
  } = {},
) {
  // Initial router context
  const initialContext: RouterContext = {
    routes: [...routes],
    baseURL: options.baseURL,
    hashMode: options.hashMode ?? false,
    currentMatch: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isFetching: false,
    listeners: new Set(),
    currentNavigation: null,
  };

  // Base router methods - these will be bound to the context
  const baseMethods = {
    // Route accessor
    routes: (self: RouterContext) => self.routes,

    // Event management
    subscribe: (
      self: RouterContext,
      listener: (match: RouteMatch<any> | null) => void,
    ) => {
      self.listeners.add(listener);
      // Call immediately with current match
      listener(self.currentMatch);

      // Return unsubscribe function
      return () => {
        self.listeners.delete(listener);
      };
    },

    fallback: (self: RouterContext, route: Route<any>) => {
      (self as any).fallbackRoute = route;
    },

    onError: (self: RouterContext, handler: (context: any) => void) => {
      (self as any).onError = handler;
    },

    // Navigation methods
    navigate: async (self: RouterContext, path: string, _options?: any) => {
      // Use the underlying CombiRouter for navigation
      const fallbackRouter = new CombiRouter(self.routes, {
        baseURL: self.baseURL,
        hashMode: self.hashMode,
      });

      // Find the route that matches this path
      const match = fallbackRouter.match(path);
      if (!match) return false;

      const result = await fallbackRouter.navigate(match.route, match.params);
      if (result.success) {
        self.currentMatch = match;
        // Notify listeners
        for (const listener of self.listeners) {
          listener(match);
        }
      }
      return result.success;
    },

    replace: async (self: RouterContext, path: string, options?: any) => {
      // Similar to navigate but would replace instead of push
      return baseMethods.navigate(self, path, { ...options, replace: true });
    },

    // Route operations
    match: (self: RouterContext, url: string) => {
      // Using CombiRouter for actual matching logic
      const fallbackRouter = new CombiRouter(self.routes, {
        baseURL: self.baseURL,
        hashMode: self.hashMode,
      });
      return fallbackRouter.match(url);
    },

    build: (
      self: RouterContext,
      route: Route<any>,
      params: Record<string, any>,
    ) => {
      // Using CombiRouter for actual building logic
      const fallbackRouter = new CombiRouter(self.routes, {
        baseURL: self.baseURL,
        hashMode: self.hashMode,
      });
      return fallbackRouter.build(route, params);
    },

    // Dynamic route management
    addRoute: (self: RouterContext, route: Route<any>) => {
      if (!route || !route.id) {
        return false; // Invalid route
      }
      const existingIndex = self.routes.findIndex((r) => r.id === route.id);
      if (existingIndex !== -1) {
        return false; // Route already exists
      }
      self.routes.push(route);
      return true;
    },

    removeRoute: (self: RouterContext, route: Route<any>) => {
      if (!route || !route.id) {
        return false; // Invalid route
      }
      const index = self.routes.findIndex((r) => r.id === route.id);
      if (index === -1) {
        return false; // Route not found
      }
      self.routes.splice(index, 1);
      return true;
    },

    // Route prefetching
    peek: (self: RouterContext) => {
      self.isFetching = true;
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          self.isFetching = false;
          resolve();
        }, 100);
      });
    },

    // Cancel any ongoing navigation
    cancelNavigation: (self: RouterContext) => {
      if (self.currentNavigation) {
        self.currentNavigation.cancel();
        self.currentNavigation = null;
        return true;
      }
      return false;
    },

    getRouteTree: (self: RouterContext) => {
      return JSON.stringify(
        self.routes.map((r) => ({ id: r.id, metadata: r.metadata })),
        null,
        2,
      );
    },

    // Internal navigation state management (for layers to use)
    _setCurrentMatch: (self: RouterContext, match: RouteMatch<any> | null) => {
      self.currentMatch = match;
      for (const listener of self.listeners) {
        listener(match);
      }
    },

    _setCurrentNavigation: (
      self: RouterContext,
      controller: NavigationController | null,
    ) => {
      self.currentNavigation = controller;
    },

    _updateFetchingState: (self: RouterContext, isFetching: boolean) => {
      self.isFetching = isFetching;
    },

    _notifyListeners: (self: RouterContext) => {
      for (const listener of self.listeners) {
        listener(self.currentMatch);
      }
    },

    _setFetching: (self: RouterContext, fetching: boolean) => {
      self.isFetching = fetching;
    },
  };

  return makeLayered(initialContext)(baseMethods);
}

// Enhanced createComposableRouter that returns a proper builder
export function createLayeredRouter(
  routes: Route<any>[],
  options: {
    baseURL?: string;
    hashMode?: boolean;
  } = {},
) {
  return createComposableRouter(routes, options);
}

// Convenience function that creates a working router with the original implementation
export function createRouter(
  routes: Route<any>[],
  options: RouterOptions = {},
): CombiRouter {
  return new CombiRouter(routes, options);
}

// Helper to create an identity layer (no-op)
export const identityLayer = () => () => ({});

// Helper to conditionally apply a layer
export const conditionalLayer = <T extends object>(
  condition: boolean,
  layer: (router: any) => T,
) => (condition ? layer : identityLayer());

// Re-export makeLayered for advanced users
export { makeLayered } from "./make-layered";

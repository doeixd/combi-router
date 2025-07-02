// =================================================================
//
//      Combi-Router: Custom Layer Composition System
//
//      A custom implementation of the layered pattern specifically
//      designed for the router architecture
//
// =================================================================

import type { RouterContext } from './layer-types';

// Method signature for base router methods
type RouterMethod<TContext extends RouterContext = RouterContext> = (self: TContext, ...args: any[]) => any;

// Base methods object type
type BaseMethods<TContext extends RouterContext = RouterContext> = Record<string, RouterMethod<TContext>>;

// Layer function that extends the router with additional methods
type LayerFunction<TContext extends RouterContext = RouterContext, TExtensions extends object = {}> = 
  (router: ComposableRouterApi<TContext>) => TExtensions;

// The composable router API that gets built up through layers
export interface ComposableRouterApi<TContext extends RouterContext = RouterContext> {
  // Core properties - these are getters that access the context
  readonly context: TContext;
  readonly routes: any[];
  readonly currentMatch: any;
  readonly currentNavigation: any;
  readonly isOnline: boolean;
  readonly isFetching: boolean;

  // Core methods - these are bound to the context
  [key: string]: any;
}

/**
 * Creates a layered router builder that allows composition of functionality
 * through a series of layer functions.
 */
export function makeLayered<TContext extends RouterContext>(
  initialContext: TContext
) {
  return function<TBaseMethods extends BaseMethods<TContext>>(
    baseMethods: TBaseMethods
  ) {
    // Start with the base API
    let currentApi = createBaseApi(initialContext, baseMethods);
    
    // We don't need the complex builder object anymore since we're handling the fluent API directly

    // Create a callable function that supports the fluent API
    function applyLayer(layer?: LayerFunction<TContext, any>): any {
      if (!layer) {
        // No layer provided, return the final API
        return currentApi;
      }
      
      // Apply the layer by getting extensions and merging them
      const extensions = layer(currentApi);
      Object.assign(currentApi, extensions);
      
      // Return a new callable function that maintains the updated currentApi
      return createApplyLayerFunction();
    }

    function createApplyLayerFunction(): any {
      return function(layer?: LayerFunction<TContext, any>): any {
        if (!layer) {
          // No layer provided, return the final API
          return currentApi;
        }
        
        // Apply the layer by getting extensions and merging them
        const extensions = layer(currentApi);
        Object.assign(currentApi, extensions);
        
        // Return another callable function
        return createApplyLayerFunction();
      };
    }

    return applyLayer;
  };
}

/**
 * Creates the base API from the initial context and base methods
 */
function createBaseApi<TContext extends RouterContext, TBaseMethods extends BaseMethods<TContext>>(
  context: TContext,
  baseMethods: TBaseMethods
): ComposableRouterApi<TContext> & TBaseMethods {
  const api: any = {};

  // Add property getters for core router state
  Object.defineProperty(api, 'context', {
    get: () => context,
    enumerable: true,
    configurable: false
  });

  // Define routes as a method for test compatibility
  api.routes = () => context.routes;

  Object.defineProperty(api, 'currentMatch', {
    get: () => context.currentMatch,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(api, 'currentNavigation', {
    get: () => context.currentNavigation,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(api, 'isOnline', {
    get: () => context.isOnline,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(api, 'isFetching', {
    get: () => context.isFetching,
    enumerable: true,
    configurable: false
  });

  // Bind all base methods to the context
  for (const [methodName, method] of Object.entries(baseMethods)) {
    // Skip if this property is already defined as a getter
    const descriptor = Object.getOwnPropertyDescriptor(api, methodName);
    if (descriptor && descriptor.get && !descriptor.configurable) {
      continue; // Skip non-configurable getters
    }
    api[methodName] = (...args: any[]) => method(context, ...args);
  }

  return api;
}

/**
 * Simple helper to create a layer that adds methods to the router
 */
export function createLayer<TExtensions extends object>(
  extensions: TExtensions
): LayerFunction<any, TExtensions> {
  return () => extensions;
}

/**
 * Helper to create a conditional layer
 */
export function conditionalLayer<T extends object>(
  condition: boolean,
  layer: LayerFunction<any, T>
): LayerFunction<any, T | {}> {
  return condition ? layer : () => ({} as any);
}

/**
 * Helper to create an identity layer (no-op)
 */
export function identityLayer(): LayerFunction<any, {}> {
  return () => ({});
}

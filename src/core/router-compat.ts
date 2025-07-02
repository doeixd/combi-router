// =================================================================
//
//      Combi-Router: Backwards Compatibility Wrapper
//
//      Maintains backwards compatibility with existing CombiRouter API
//      while delegating to the new layered implementation
//
// =================================================================

import type { 
  Route,
  RouteMatch, 
  RouterOptions,
  NavigationController,
  NavigationResult,
  ProductionFeatures,
  ErrorContext
} from './types';

import { 
  createLayeredRouter,
  conditionalLayer
} from './layered-router';

import { createCoreNavigationLayer } from '../layers/core';
import { createPerformanceLayer } from '../layers/performance';
import { createScrollRestorationLayer } from '../layers/scroll-restoration';
import { createCodeSplittingLayer } from '../layers/code-splitting';
import { createTransitionsLayer } from '../layers/transitions';
import { createHeadManagementLayer } from '../layers/head';
import { devLayer, quickDevLayer } from '../layers/dev';
import { dataLayer, quickDataLayer } from '../layers/data';

// Import existing feature managers for compatibility
import { ScrollRestorationManager } from '../features/scroll-restoration';
import { PerformanceManager } from '../features/performance';

// Simple createRouter function for basic usage (backwards compatible)
export function createRouter(routes: Route<any>[], options: RouterOptions = {}): CombiRouter {
  return new CombiRouter(routes, options);
}

// Backwards compatible CombiRouter class
export class CombiRouter {
  private _layeredRouter: any;
  private _listeners = new Set<(match: RouteMatch<any> | null) => void>();
  private _currentNavigation: NavigationController | null = null;

  constructor(routes: Route<any>[], options: RouterOptions = {}) {
    // Build the layered router with the same features as the original
    this._layeredRouter = createLayeredRouter(routes, {
      baseURL: options.baseURL,
      hashMode: options.hashMode
    })
    // Always include core navigation
    (createCoreNavigationLayer())
    // Conditionally add features based on options
    (conditionalLayer(
      !!options.features?.scrollRestoration,
      createScrollRestorationLayer(options.features?.scrollRestoration || {})
    ))
    (conditionalLayer(
      !!options.features?.performance,
      createPerformanceLayer(options.features?.performance || {})
    ))
    (conditionalLayer(
      !!options.features?.codeSplitting,
      createCodeSplittingLayer(options.features?.codeSplitting || {})
    ))
    (conditionalLayer(
      !!options.features?.transitions,
      createTransitionsLayer(options.features?.transitions || {})
    ))
    (conditionalLayer(
      !!options.features?.head,
      createHeadManagementLayer(options.features?.head || {})
    ))
    // Always include data layer for resource management
    (dataLayer())
    // Include dev layer in development
    (conditionalLayer(
      process.env.NODE_ENV !== 'production',
      devLayer({ exposeToWindow: true, autoAnalyze: true })
    ))
    ();

    // Initialize the router
    if ('init' in this._layeredRouter) {
      this._layeredRouter.init();
    }
  }

  // Delegate all public API methods to the layered router

  // Core properties
  get routes(): readonly Route<any>[] {
    return this._layeredRouter.routes;
  }

  get currentMatch(): RouteMatch<any> | null {
    return this._layeredRouter.currentMatch;
  }

  get currentNavigation(): NavigationController | null {
    return this._currentNavigation || this._layeredRouter.currentNavigation;
  }

  get isOnline(): boolean {
    return this._layeredRouter.isOnline;
  }

  get isNavigating(): boolean {
    return this.currentNavigation !== null;
  }

  get isFetching(): boolean {
    return this._layeredRouter.isFetching || false;
  }

  // Navigation methods
  async navigate(path: string, options?: any): Promise<boolean>;
  async navigate<TParams>(route: Route<TParams>, params: TParams): Promise<NavigationResult>;
  async navigate<TParams>(pathOrRoute: string | Route<TParams>, paramsOrOptions?: TParams | any): Promise<boolean | NavigationResult> {
    if (typeof pathOrRoute === 'string') {
      // String-based navigation (layered router API)
      return this._layeredRouter.navigate(pathOrRoute, paramsOrOptions);
    } else {
      // Route-based navigation (backwards compatibility)
      const url = this.build(pathOrRoute, paramsOrOptions as any);
      if (url === null) {
        return {
          success: false,
          error: {
            type: 'validation-failed',
            message: "Failed to build URL. A required parameter may be missing.",
            route: pathOrRoute,
            params: paramsOrOptions
          }
        } as NavigationResult;
      }

      // Create a fake navigation controller for compatibility
      const controller = {
        route: pathOrRoute,
        params: paramsOrOptions,
        cancel: () => {},
        get cancelled() { return false; }
      };

      // Set current navigation for isNavigating tracking
      this._currentNavigation = controller;

      try {
        const success = await this._layeredRouter.navigate(url);
        return { 
          success, 
          error: success ? undefined : { type: 'navigation-failed', message: 'Navigation failed' },
          match: success ? this.currentMatch : undefined
        } as NavigationResult;
      } finally {
        // Clear navigation state
        this._currentNavigation = null;
      }
    }
  }

  async navigateSimple<TParams>(route: Route<TParams>, params: TParams): Promise<boolean> {
    const result = await this.navigate(route, params);
    return typeof result === 'boolean' ? result : result.success;
  }

  async replace(path: string, options?: any): Promise<boolean> {
    return this._layeredRouter.replace(path, options);
  }

  build(route: Route<any>, params: Record<string, any>): string | null {
    return this._layeredRouter.build(route, params);
  }

  match(path: string): RouteMatch<any> | null {
    return this._layeredRouter.match(path);
  }

  peek(route: Route<any>, params: Record<string, any>): Promise<void> {
    if ('peek' in this._layeredRouter && typeof this._layeredRouter.peek === 'function') {
      return this._layeredRouter.peek(route, params);
    }
    console.warn('[CombiRouter] peek() not supported in this router configuration');
    return Promise.resolve();
  }

  // Event management
  subscribe(listener: (match: RouteMatch<any> | null) => void): () => void {
    return this._layeredRouter.subscribe(listener);
  }

  fallback(route: Route<any>): void {
    this._layeredRouter.fallback(route);
  }

  onError(handler: (context: ErrorContext) => void): void {
    this._layeredRouter.onError(handler);
  }

  // Navigation control
  cancelNavigation(): boolean {
    return this._layeredRouter.cancelNavigation();
  }

  getRouteTree(): string {
    return this._layeredRouter.getRouteTree();
  }

  // Dynamic route management
  addRoute(route: Route<any>): boolean {
    if ('addRoute' in this._layeredRouter && typeof this._layeredRouter.addRoute === 'function') {
      return this._layeredRouter.addRoute(route);
    }
    console.warn('[CombiRouter] Dynamic route addition not supported in this router configuration');
    return false;
  }

  removeRoute(route: Route<any>): boolean {
    if ('removeRoute' in this._layeredRouter && typeof this._layeredRouter.removeRoute === 'function') {
      return this._layeredRouter.removeRoute(route);
    }
    console.warn('[CombiRouter] Dynamic route removal not supported in this router configuration');
    return false;
  }

  // Feature manager access (for backwards compatibility)
  get scrollRestoration(): ScrollRestorationManager | undefined {
    return this._layeredRouter.scrollRestoration;
  }

  get performance(): PerformanceManager | undefined {
    return this._layeredRouter.performance;
  }

  get codeSplitting(): any | undefined {
    return this._layeredRouter.codeSplitting;
  }

  get transitions(): any | undefined {
    return this._layeredRouter.transitions;
  }

  get headManager(): any | undefined {
    return this._layeredRouter.headManager;
  }

  // Feature-specific methods (delegated to layers)
  
  // Scroll restoration methods
  saveScrollPosition(routeId?: string): void {
    if ('saveScrollPosition' in this._layeredRouter) {
      this._layeredRouter.saveScrollPosition(routeId);
    }
  }

  restoreScrollPosition(routeId: string): void {
    if ('restoreScrollPosition' in this._layeredRouter) {
      this._layeredRouter.restoreScrollPosition(routeId);
    }
  }

  clearScrollHistory(): void {
    if ('clearScrollHistory' in this._layeredRouter) {
      this._layeredRouter.clearScrollHistory();
    }
  }

  // Performance methods
  prefetchRoute(routeId: string, priority?: 'high' | 'low' | 'auto'): Promise<void> {
    if ('prefetchRoute' in this._layeredRouter) {
      return this._layeredRouter.prefetchRoute(routeId, priority);
    }
    return Promise.resolve();
  }

  setupHoverPrefetch(element: Element, routeId: string): () => void {
    if ('setupHoverPrefetch' in this._layeredRouter) {
      return this._layeredRouter.setupHoverPrefetch(element, routeId);
    }
    return () => {};
  }

  setupViewportPrefetch(element: Element, routeId: string): () => void {
    if ('setupViewportPrefetch' in this._layeredRouter) {
      return this._layeredRouter.setupViewportPrefetch(element, routeId);
    }
    return () => {};
  }

  getPerformanceReport() {
    if ('getPerformanceReport' in this._layeredRouter) {
      return this._layeredRouter.getPerformanceReport();
    }
    return null;
  }

  performMemoryCleanup(): void {
    if ('performMemoryCleanup' in this._layeredRouter) {
      this._layeredRouter.performMemoryCleanup();
    }
  }
}

// Note: createRouter is exported from layered-router.ts

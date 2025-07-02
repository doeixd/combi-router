// =================================================================
//
//      Combi-Router: Layer System Type Definitions
//
//      Type definitions for the layered router architecture
//
// =================================================================

import type { Route, RouteMatch, NavigationController, NavigationContext, ErrorContext } from './types';

// Base router context that all layers receive
export interface RouterContext {
  routes: Route<any>[];  // Changed from readonly to allow dynamic updates
  baseURL?: string;
  hashMode?: boolean;
  currentMatch: RouteMatch<any> | null;
  isOnline: boolean;
  isFetching: boolean;  // Add fetching state
  listeners: Set<(match: RouteMatch<any> | null) => void>;
  fallbackRoute?: Route<any>;
  onError?: (context: ErrorContext) => void;
  currentNavigation: NavigationController | null;
}

// Layer function signature - receives router API and returns extensions
export type RouterLayer<TContext extends RouterContext = RouterContext, TExtensions extends object = {}> = 
  (self: ComposableRouter<TContext>) => TExtensions;

// The composable router API that layers build upon
export interface ComposableRouter<TContext extends RouterContext = RouterContext> {
  // Core properties
  readonly context: TContext;
  readonly routes: Route<any>[];  // Changed from readonly
  readonly currentMatch: RouteMatch<any> | null;
  readonly currentNavigation: NavigationController | null;
  readonly isOnline: boolean;
  readonly isFetching: boolean;

  // Core navigation methods
  navigate: (path: string, options?: NavigationOptions) => Promise<boolean>;
  replace: (path: string, options?: NavigationOptions) => Promise<boolean>;
  build: (route: Route<any>, params: Record<string, any>) => string | null;
  match: (path: string) => RouteMatch<any> | null;
  
  // Event management
  subscribe: (listener: (match: RouteMatch<any> | null) => void) => () => void;
  fallback: (route: Route<any>) => void;
  onError: (handler: (context: ErrorContext) => void) => void;

  // Navigation control
  cancelNavigation: () => boolean;
  getRouteTree: () => string;

  // Dynamic route management
  addRoute: (route: Route<any>) => boolean;
  removeRoute: (route: Route<any>) => boolean;
  
  // Route loading and prefetching
  peek: (route: Route<any>, params: Record<string, any>) => Promise<void>;

  // Lifecycle hooks (to be called by layers)
  _notifyListeners: () => void;
  _setCurrentMatch: (match: RouteMatch<any> | null) => void;
  _setCurrentNavigation: (navigation: NavigationController | null) => void;
  _setFetching: (fetching: boolean) => void;
}

// Navigation options for layer extensions
export interface NavigationOptions {
  replace?: boolean;
  data?: any;
  preserveScroll?: boolean;
  timeout?: number;
}

// Lifecycle hooks that layers can implement
export interface LayerLifecycleHooks {
  onNavigationStart?: (context: NavigationContext) => void | Promise<void>;
  onNavigationComplete?: (match: RouteMatch<any>, isPopState?: boolean) => void | Promise<void>;
  onNavigationError?: (error: Error, context: NavigationContext) => void | Promise<void>;
  onRouteLoad?: (route: Route<any>) => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
}

// Built-in layer configurations
export interface PerformanceLayerConfig {
  prefetchOnHover?: boolean;
  prefetchViewport?: boolean;
  navigationTimeout?: number;
  resourcePriority?: 'high' | 'low' | 'auto';
  connectionAware?: boolean;
  enablePerformanceMonitoring?: boolean;
  preloadCriticalRoutes?: string[];
  memoryManagement?: {
    enabled: boolean;
    maxCacheSize: number;
    maxCacheAge: number;
    cleanupInterval: number;
    lowMemoryThreshold: number;
  };
}

export interface ScrollRestorationLayerConfig {
  enabled?: boolean;
  strategy?: 'auto' | 'manual' | 'smooth';
  restoreOnBack?: boolean;
  saveDelay?: number;
  maxPositions?: number;
  smoothScrollBehavior?: ScrollBehavior;
  excludePaths?: string[];
}

export interface TransitionsLayerConfig {
  enabled?: boolean;
  duration?: number;
  easing?: string;
  respectMotionPreference?: boolean;
  customTransitions?: Record<string, (context: any) => Promise<void>>;
}

export interface CodeSplittingLayerConfig {
  strategy?: 'route-based' | 'feature-based' | 'hybrid';
  preloadStrategy?: 'hover' | 'visible' | 'immediate' | 'none';
  chunkNaming?: (route: Route<any>) => string;
  fallback?: any;
  errorBoundary?: any;
  preloadTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  priority?: 'high' | 'low' | 'auto';
  connectionAware?: boolean;
}

export interface TransitionsLayerConfig {
  enabled?: boolean;
  type?: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
  duration?: number;
  easing?: string;
  customTransition?: (context: any) => Promise<void> | void;
  skipSameRoute?: boolean;
  fallbackTransition?: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
  debugMode?: boolean;
  respectPreferences?: boolean;
}

export interface HeadManagementLayerConfig {
  titleTemplate?: string;
  defaultTitle?: string;
  enableOpenGraph?: boolean;
  enableTwitterCard?: boolean;
  enableCanonical?: boolean;
  baseUrl?: string;
  preserveExisting?: boolean;
}

// Helper type for extracting layer extensions
export type LayerExtensions<TLayer> = TLayer extends RouterLayer<any, infer TExtensions> ? TExtensions : never;

// Utility type for composing multiple layers
export type ComposedRouter<TLayers extends readonly RouterLayer<any, any>[]> = 
  TLayers extends readonly [RouterLayer<any, infer T1>, ...infer Rest]
    ? Rest extends readonly RouterLayer<any, any>[]
      ? ComposableRouter<RouterContext> & T1 & LayerExtensions<ComposedRouter<Rest>>
      : ComposableRouter<RouterContext> & T1
    : ComposableRouter<RouterContext>;

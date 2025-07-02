// =================================================================
//
//      Combi-Router: Core Type Definitions
//
//      This module contains all the core interfaces, types, and enums
//      used throughout the router system.
//
// =================================================================

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Parser } from '@doeixd/combi-parse';

// Re-export for consumers
export type { StandardSchemaV1 } from '@standard-schema/spec';
export type { StandardSchemaV1 as StandardSchemaV1Namespace } from '@standard-schema/spec';

// =================================================================
// ----------------- SUSPENSE & RESOURCE TYPES -------------------
// =================================================================

export type ResourceStatus = 'pending' | 'success' | 'error';

/**
 * A special wrapper for asynchronous data that enables suspense-like features.
 * When a `loader` returns a Resource, the router can track its loading state.
 * @template T The type of the successfully resolved data.
 */
export interface Resource<T> {
  /**
   * Reads the resource's value.
   * - If successful, returns the data.
   * - If pending, it "suspends" by throwing a special promise.
   * - If errored, it throws the original error.
   */
  read(): T;
  /** The current status of the resource. */
  readonly status: ResourceStatus;
}

/**
 * Configuration for retry behavior in enhanced resources.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  attempts?: number;
  /** Delay between attempts in ms, or function to calculate delay (default: exponential backoff) */
  delay?: number | ((attempt: number) => number);
  /** Function to determine if error should trigger retry (default: retry on network errors) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback fired on each retry attempt */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Configuration for cache behavior in enhanced resources.
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Allow serving stale data while revalidating in background */
  staleWhileRevalidate?: boolean;
  /** Cache tags for targeted invalidation */
  invalidateOn?: string[];
  /** Cache priority level for memory management */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Configuration options for enhanced resources.
 */
export interface ResourceConfig {
  /** Retry configuration for failed requests */
  retry?: RetryConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Time in ms after which data is considered stale (default: 0 - always fresh) */
  staleTime?: number;
  /** Enable background refetch for stale data */
  backgroundRefetch?: boolean;
}

/**
 * Enhanced Resource interface with advanced state management and control.
 * Extends the basic Resource interface with modern data fetching capabilities.
 * @template T The type of the successfully resolved data.
 */
export interface AdvancedResource<T> extends Resource<T> {
  // State management
  /** Whether the resource is currently loading/fetching */
  readonly isLoading: boolean;
  /** Whether the data is stale according to staleTime configuration */
  readonly isStale: boolean;
  /** Timestamp of when data was last successfully fetched */
  readonly lastFetched?: Date;
  /** Last error that occurred, if any */
  readonly error?: Error;
  
  // Control methods
  /** Manually refetch the data, bypassing cache */
  refetch(): Promise<T>;
  /** Mark the resource as invalid, triggering refetch on next read */
  invalidate(): void;
  /** Non-suspending read that returns undefined if not available */
  peek(): T | undefined;
  
  // Configuration
  /** The configuration used for this resource */
  readonly config: ResourceConfig;
}

/**
 * Events emitted by enhanced resources for observability.
 */
export interface ResourceEvent<T = any> {
  type: 'fetch-start' | 'fetch-success' | 'fetch-error' | 'retry' | 'invalidate' | 'stale';
  resource: AdvancedResource<T>;
  data?: T;
  error?: Error;
  attempt?: number;
  timestamp: Date;
}

/**
 * Global resource state aggregation for loading indicators.
 */
export interface GlobalResourceState {
  /** Total number of resources currently loading */
  loadingCount: number;
  /** Whether any resource is loading */
  isLoading: boolean;
  /** All resources that are currently loading */
  loadingResources: AdvancedResource<any>[];
}

/**
 * Cache entry with metadata for advanced caching strategies.
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  expires: number;
  priority: 'low' | 'normal' | 'high';
  tags: string[];
  accessCount: number;
  lastAccessed: Date;
}

// =================================================================
// ------------------------- CORE TYPES ---------------------------
// =================================================================

/**
 * Infers the parameter types from a Route object. This is the cornerstone of
 * Combi-Router's type safety, allowing for fully typed `navigate` and `build` calls.
 * @template T The `Route` object type.
 * @example
 * const userRoute = route(path('users'), param('id', z.number()));
 * // `UserParams` is now `{ id: number }`
 * type UserParams = InferParams<typeof userRoute>;
 */
export type InferParams<T> = T extends Route<infer P> ? P : never;

/**
 * Represents the result of a successful route match. It's a tree structure
 * where each node contains the context for one segment of a nested route.
 * @template TParams The type of this route segment's parameters.
 */
export interface RouteMatch<TParams = any> {
  /** The `Route` object that was matched for this segment. */
  readonly route: Route<TParams>;
  /** The parameters for this segment, validated and typed. */
  readonly params: TParams;
  /** The portion of the pathname matched by this route and its parents (e.g., "/users/123"). */
  readonly pathname: string;
  /** The full search/query string from the URL (e.g., "?q=test"). */
  readonly search: string;
  /** The full hash from the URL (e.g., "#section"). */
  readonly hash: string;
  /** Data loaded by this route's `loader` function. */
  data?: any;
  /** The next match in the nested route hierarchy, if any. */
  readonly child?: RouteMatch<any>;
}

/** The internal representation of a route building block (matcher). @internal */
export interface RouteMatcher {
  readonly type: 'path' | 'param' | 'query' | 'end' | 'optionalPath' | 'wildcard' | 'meta';
  readonly parser: Parser<any>;
  readonly paramName?: string;
  readonly schema?: StandardSchemaV1<any, any>;
  readonly build: (params: Record<string, any>) => string | null;
}

/** Metadata that can be attached to a route to add behavior and information. */
export interface RouteMetadata {
  title?: string | ((params: any, data?: any) => string);
  loader?: (context: LoaderContext<any>) => Promise<any> | any;
  layout?: any;
  lazy?: { import: () => Promise<{ default: any }>; preload?: 'hover' | 'visible' | 'immediate' | 'none'; fallback?: any; };
  guards?: RouteGuard[];
  errorBoundary?: any;
  cache?: { key?: (params: any) => string; ttl: number; staleWhileRevalidate?: boolean; };
  [key: string]: any;
}

/** The context object provided to a route's `loader` function. */
export interface LoaderContext<TParams = any> {
  params: TParams;
  searchParams: URLSearchParams;
  signal: AbortSignal;
}

/** A route guard function. Return `true` to allow, `false` to block, or a URL string to redirect. */
export type RouteGuard = (context: { to: RouteMatch<any>, from: RouteMatch<any> | null }) => Promise<boolean | string> | boolean | string;

/** The context passed to the global error handler `router.onError`. */
export interface ErrorContext {
  readonly error: any;
  readonly to: RouteMatch<any> | null;
  readonly from: RouteMatch<any> | null;
}

/** Configuration options for creating a router instance. */
export interface RouterOptions {
  baseURL?: string;
  hashMode?: boolean;
  features?: ProductionFeatures;
}

/** Production features configuration */
export interface ProductionFeatures {
  scrollRestoration?: ScrollRestorationConfig;
  codeSplitting?: CodeSplittingConfig;
  transitions?: TransitionConfig;
  performance?: PerformanceConfig;
  head?: HeadManagementConfig;
}

export interface HeadManagementConfig {
  titleTemplate?: string;
  defaultTitle?: string;
  enableOpenGraph?: boolean;
  enableTwitterCard?: boolean;
  enableCanonical?: boolean;
  baseUrl?: string;
  preserveExisting?: boolean;
}

// Forward declarations for production features
export interface ScrollRestorationConfig {
  enabled: boolean;
  strategy: 'auto' | 'manual' | 'smooth';
  restoreOnBack: boolean;
  saveDelay?: number;
  maxPositions?: number;
  smoothScrollBehavior?: ScrollBehavior;
  excludePaths?: string[];
}

export interface CodeSplittingConfig {
  strategy: 'route-based' | 'feature-based' | 'hybrid';
  preloadStrategy: 'hover' | 'visible' | 'immediate' | 'none';
  chunkNaming?: (route: Route) => string;
  fallback?: any;
  errorBoundary?: any;
  preloadTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  priority?: 'high' | 'low' | 'auto';
  connectionAware?: boolean;
}

export interface TransitionConfig {
  enabled: boolean;
  type: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
  duration?: number;
  easing?: string;
  customTransition?: (context: TransitionContext) => Promise<void> | void;
  skipSameRoute?: boolean;
  fallbackTransition?: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
  debugMode?: boolean;
  respectPreferences?: boolean;
}

export interface TransitionContext {
  from: RouteMatch | null;
  to: RouteMatch;
  direction: 'forward' | 'back' | 'replace';
  isInitial: boolean;
  element?: Element;
}

export interface NavigationContext {
  readonly from: RouteMatch<any> | null;
  readonly to: RouteMatch<any> | null;
  readonly isPopState: boolean;
  readonly controller: NavigationController | null;
  readonly options?: any;
}

export interface PerformanceConfig {
  prefetchOnHover: boolean;
  prefetchViewport: boolean;
  navigationTimeout: number;
  resourcePriority: 'high' | 'low' | 'auto';
  memoryManagement: {
    enabled: boolean;
    maxCacheSize: number;
    maxCacheAge: number;
    cleanupInterval: number;
    lowMemoryThreshold: number;
  };
  connectionAware: boolean;
  enablePerformanceMonitoring: boolean;
  preloadCriticalRoutes?: string[];
}

// =================================================================
// -------------------- NEW API TYPES & ERRORS --------------------
// =================================================================

/** Error thrown when route validation fails during creation */
export class RouteValidationError extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'RouteValidationError';
  }
}

/** Types of navigation errors that can occur */
export enum NavigationErrorType {
  RouteNotFound = 'route-not-found',
  GuardRejected = 'guard-rejected', 
  LoaderFailed = 'loader-failed',
  ValidationFailed = 'validation-failed',
  Cancelled = 'cancelled',
  Unknown = 'unknown'
}

/** Detailed information about a navigation error */
export interface NavigationError {
  readonly type: NavigationErrorType;
  readonly message: string;
  readonly originalError?: any;
  readonly route?: Route<any>;
  readonly params?: any;
}

/** Result of a navigation attempt */
export interface NavigationResult {
  readonly success: boolean;
  readonly match?: RouteMatch<any>;
  readonly error?: NavigationError;
  readonly cancelled?: boolean;
}

/** Controller for managing ongoing navigation */
export interface NavigationController {
  readonly id?: number;  // Optional id for tracking concurrent navigations
  readonly url?: string;
  readonly route?: Route<any>;
  readonly params?: any;
  readonly promise: Promise<NavigationResult>;
  cancel(): void;
  readonly cancelled: boolean;
  readonly isPopState?: boolean;
  readonly startTime?: number;
}

/** Context provided to typed guards */
export interface GuardContext<TParams = any> {
  readonly to: RouteMatch<TParams>;
  readonly from: RouteMatch<any> | null;
  readonly params: TParams;
  readonly searchParams: URLSearchParams;
}

/** Result from a typed guard function */
export type GuardResult = boolean | string | Promise<boolean | string>;

/** A typed route guard with better type safety */
export type TypedRouteGuard<TParams = any> = (context: GuardContext<TParams>) => GuardResult;

// =================================================================
// --------------------- TYPE UTILITIES ---------------------------
// =================================================================

/**
 * Enhanced type inference for StandardSchema types.
 * Infers the output type from a StandardSchema, providing better type safety.
 */
export type InferSchemaType<S> = S extends StandardSchemaV1<any, infer O> ? O : never;

/**
 * Validates parameter types at compile-time using StandardSchema inference.
 * Ensures type safety for route parameter validation.
 */
export type ValidateParams<T> = T extends Record<string, StandardSchemaV1<any, any>> 
  ? { [K in keyof T]: InferSchemaType<T[K]> }
  : T;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

/**
 * Enhanced matcher parameter inference with better StandardSchema integration.
 * Handles all matcher types with improved type safety.
 */
type InferMatcherParam<T extends RouteMatcher> = T extends { paramName: infer N; schema: StandardSchemaV1<any, infer S> }
  ? N extends string ? { [K in N]: S } : {}
  : T extends { type: 'optionalPath', paramName: infer N }
  ? N extends string ? { [K in N]?: boolean } : {}
  : T extends { type: 'wildcard', paramName: infer N }
  ? N extends string ? { [K in N]: string[] } : {}
  : {};

export type InferMatcherParams<T extends RouteMatcher[]> = UnionToIntersection<{ [K in keyof T]: T[K] extends RouteMatcher ? InferMatcherParam<T[K]> : never }[number]>;

// Forward declaration for circular dependency resolution  
// The actual Route class is defined in ./route.ts
export type Route<TParams = any> = any & { _phantom?: TParams };

// Re-export from combi-parse for convenience
export type { Parser, Success } from '@doeixd/combi-parse';

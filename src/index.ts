// =================================================================
//
//      Combi-Router: A Composable, Type-Safe Router
//
//      This file provides the complete, final, and production-ready
//      implementation. It emphasizes functional composition, reference-based
//      navigation, and end-to-end type safety. This version includes
//      advanced features like true hierarchical matching, parallel data loading,
//      suspense, and View Transitions for a modern, high-performance
//      user experience.
//
// =================================================================

import {
  Parser,
  str,
  regex,
  sequence,
  failure,
  optional as optionalParser,
  eof,
  many,
  type Success,
  success,
} from '@doeixd/combi-parse';
import { z } from 'zod';

// =================================================================
// ----------------- SUSPENSE & RESOURCE TYPES ---------------------
// =================================================================

type ResourceStatus = 'pending' | 'success' | 'error';

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

/** A special promise subclass thrown during suspense to signal loading. @internal */
class SuspensePromise extends Promise<void> {}

/**
 * Creates a Resource object from a promise-returning function.
 * This is the primary utility for enabling suspense-based data fetching.
 *
 * @param promiseFn A function that returns the promise to be wrapped.
 * @returns A `Resource` object.
 *
 * @example
 * // In a route loader:
 * const userRoute = route(
 *   path('users'),
 *   param('id', z.number()),
 *   loader(({ params }) => ({
 *     user: createResource(() => api.fetchUser(params.id))
 *   }))
 * );
 *
 * // In a component/view:
 * const { user } = router.currentMatch.data;
 * // This will either return the user data or suspend rendering.
 * const userData = user.read();
 */
export function createResource<T>(promiseFn: () => Promise<T>): Resource<T> {
  let status: ResourceStatus = 'pending';
  let result: T | any;
  let suspender = promiseFn().then(
    (r) => { status = 'success'; result = r; },
    (e) => { status = 'error'; result = e; }
  );

  return {
    get status() { return status; },
    read(): T {
      switch (status) {
        case 'pending': throw new SuspensePromise((resolve) => suspender.then(resolve, resolve));
        case 'error': throw result;
        case 'success': return result as T;
      }
    },
  };
}

// =================================================================
// ------------------------- CORE TYPES ----------------------------
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
interface RouteMatcher {
  readonly type: 'path' | 'param' | 'query' | 'end' | 'optionalPath' | 'wildcard';
  readonly parser: Parser<any>;
  readonly paramName?: string;
  readonly schema?: z.ZodType<any>;
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
}

// =================================================================
// ---------------------- THE ROUTE CLASS --------------------------
// =================================================================

let nextRouteId = 1;

/**
 * A `Route` is a declarative, type-safe blueprint for a URL.
 * It's an immutable object combining URL matchers and metadata, which can be
 * exported, imported, and composed to build an application's routing graph.
 * @template TParams The inferred type of the route's parameters.
 */
export class Route<TParams = {}> {
  public readonly id: number = nextRouteId++;
  public readonly name?: string;
  public readonly _phantomParams?: TParams;
  private _parser?: Parser<TParams>;

  constructor(public readonly matchers: readonly RouteMatcher[], public readonly metadata: RouteMetadata = {}, name?: string) {
    this.name = name;
  }

  /**
   * Lazily builds and retrieves the composite parser for this route.
   * The parser is created on first access and cached for performance.
   */
  get parser(): Parser<TParams> {
    if (!this._parser) {
      this._parser = buildRouteParser(this.matchers) as Parser<TParams>;
    }
    return this._parser;
  }
}

// =================================================================
// ---------------------- ROUTE MATCHERS ---------------------------
// =================================================================

/**
 * Matches a static path segment. Each segment must be preceded by a '/'.
 * @param segment The string segment to match (e.g., 'users').
 * @example
 * // Matches the URL "/about"
 * const aboutRoute = route(path('about'));
 */
export function path(segment: string): RouteMatcher {
  return { type: 'path', parser: str('/').keepRight(str(segment)), build: () => `/${segment}` };
}

/**
 * Matches an optional static path segment.
 * @param segment The optional string segment.
 * @example
 * // Matches "/products" and "/products/all"
 * const productsRoute = route(path('products'), path.optional('all'));
 */
path.optional = function(segment: string): RouteMatcher {
  return { type: 'optionalPath', paramName: segment, parser: optionalParser(str('/').keepRight(str(segment))).map(res => res ? { [segment]: true } : {}), build: (params) => (params[segment] ? `/${segment}` : '') };
};

/**
 * Matches all remaining path segments into an array of strings.
 * This should typically be the last path-related matcher in a route definition.
 * @param name The name for the array of segments in the params object.
 * @example
 * // Matches "/files/a/b/c" -> params.filePath === ['a', 'b', 'c']
 * const fileRoute = route(path('files'), path.wildcard('filePath'));
 */
path.wildcard = function(name = 'wildcard'): RouteMatcher {
  return { type: 'wildcard', paramName: name, parser: str('/').keepRight(many(regex(/[^/?#]+/))).map(segments => ({ [name]: segments })), build: (params) => (Array.isArray(params[name]) ? `/${params[name].join('/')}` : null) };
};

/**
 * Matches a dynamic parameter in the path and validates it using a Zod schema.
 * @param name The name of the parameter (e.g., 'id').
 * @param schema A Zod schema for validation and type coercion.
 * @example
 * // Matches "/users/123" and provides `params.id` as a number.
 * const userRoute = route(path('users'), param('id', z.number()));
 */
export function param<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'param',
    paramName: name,
    schema,
    parser: str('/').keepRight(regex(/[^/?#]+/)).chain(value =>
      new Parser(state => {
        const valueToParse = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
        const result = schema.safeParse(valueToParse);
        if (!result.success) {
          const message = `Validation failed for param "${name}": ${result.error.issues.map(i => i.message).join(', ')}`;
          return failure(message, state);
        }
        return success({ [name]: result.data }, state);
      })
    ),
    build: (params) => (params[name] !== undefined && params[name] !== null ? `/${encodeURIComponent(params[name])}` : null),
  };
}

/**
 * Declares a required query parameter and its validation schema.
 * Note: This matcher does not consume path input; it provides metadata for the
 * router to perform validation against the URL's search string after path matching.
 * @param name The name of the query parameter (e.g., 'page').
 * @param schema A Zod schema for validation.
 * @example
 * // Matches "/items?page=2" and provides `params.page` as a number.
 * const listRoute = route(path('items'), query('page', z.number().default(1)));
 */
export function query<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'query',
    paramName: name,
    schema,
    parser: new Parser((state) => success({ name, schema }, state)),
    build: (params) => (params[name] !== undefined ? `${name}=${encodeURIComponent(params[name])}` : null),
  };
}

/**
 * Declares an optional query parameter. A shorthand for making a Zod schema optional.
 * @param name The name of the query parameter.
 * @param schema A Zod schema for the parameter's type if it exists.
 * @example
 * // Matches "/search?q=term" or "/search". `params.q` will be string or undefined.
 * const searchRoute = route(path('search'), query.optional('q', z.string()));
 */
query.optional = <T>(name: string, schema: z.ZodType<T>): RouteMatcher => {
  return query(name, schema.optional() as any);
};

/** A matcher that ensures the path has no remaining segments to parse. */
export const end: RouteMatcher = { type: 'end', parser: eof, build: () => '' };

// =================================================================
// ------------------ ROUTE BUILDING & COMPOSITION -----------------
// =================================================================

export function route<T extends RouteMatcher[]>(...matchers: T): Route<InferMatcherParams<T>> {
  return new Route(matchers);
}

/**
 * Extends an existing base route with additional matchers, creating a child route.
 * This is the primary way to build nested routes and hierarchies, ensuring that
 * changes to the parent route automatically propagate to all children.
 * @param baseRoute The parent `Route` object to extend.
 * @param additionalMatchers More `RouteMatcher` functions to append.
 * @returns A new, immutable child `Route` object.
 * @example
 * const dashboardRoute = route(path('dashboard'));
 * const usersRoute = extend(dashboardRoute, path('users')); // -> /dashboard/users
 * const userRoute = extend(usersRoute, param('id', z.number())); // -> /dashboard/users/:id
 */
export function extend<TBase, TExtension extends RouteMatcher[]>(
  baseRoute: Route<TBase>,
  ...additionalMatchers: TExtension
): Route<TBase & InferMatcherParams<TExtension>> {
  return new Route([...baseRoute.matchers, ...additionalMatchers], { ...baseRoute.metadata });
}

// =================================================================
// ----------------- HIGHER-ORDER ENHANCERS ------------------------
// =================================================================

export function pipe<T>(initial: T, ...fns: Array<(arg: T) => T>): T {
  return fns.reduce((acc, fn) => fn(acc), initial);
}

export function meta<TParams>(metadata: RouteMetadata) {
  return (r: Route<TParams>): Route<TParams> => new Route(r.matchers, { ...r.metadata, ...metadata }, r.name);
}

export function loader<TParams>(loaderFn: (context: LoaderContext<TParams>) => Promise<any> | any) {
  return meta<TParams>({ loader: loaderFn as any });
}

export function layout<TParams>(layoutComponent: any) {
  return meta<TParams>({ layout: layoutComponent });
}

export function guard<TParams>(...guardFns: RouteGuard[]) {
  return (r: Route<TParams>): Route<TParams> => {
    const existingGuards = r.metadata.guards || [];
    return new Route(r.matchers, { ...r.metadata, guards: [...existingGuards, ...guardFns] }, r.name);
  };
}

export function cache<TParams>(cacheConfig: Exclude<RouteMetadata['cache'], undefined>) {
    return meta<TParams>({ cache: cacheConfig });
}

export function lazy<TParams>(importFn: () => Promise<{ default: any }>, options: Omit<Exclude<RouteMetadata['lazy'], undefined>, 'import'> = {}) {
    return meta<TParams>({ lazy: { import: importFn, ...options } });
}

// =================================================================
// -------------------- THE ROUTER CLASS ---------------------------
// =================================================================

type Listener = (match: RouteMatch<any> | null) => void;

/**
 * The main router class that manages state, navigation, and lifecycle events.
 * It is instantiated via the `createRouter` factory function.
 */
export class CombiRouter {
  public currentMatch: RouteMatch<any> | null = null;
  public isNavigating = false;
  public isFetching = false;
  public isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  private readonly _allRoutes: Route<any>[];
  private readonly _options: RouterOptions;
  private readonly _dataCache = new Map<string, { data: any; expires: number }>();
  private readonly _listeners = new Set<Listener>();
  private _fallbackRoute: Route<any> | null = null;
  private _onError: (context: ErrorContext) => void = () => {};

  constructor(routes: Route<any>[], options: RouterOptions) {
    this._allRoutes = routes;
    this._options = options;

    if(typeof window !== 'undefined') {
        window.addEventListener('popstate', (event) => {
            const url = event.state?.url || window.location.pathname + window.location.search;
            this._navigateToURL(url, true);
        });
        window.addEventListener('online', () => (this.isOnline = true));
        window.addEventListener('offline', () => (this.isOnline = false));
    }
  }

  get routes(): readonly Route<any>[] { return this._allRoutes; }
  public getRouteTree(): string { return this._allRoutes.map(route => this.build(route, {})?.split('?')[0] || `[Dynamic: ${route.name || route.id}]`).sort().join('\n'); }
  public subscribe(listener: Listener): () => void { this._listeners.add(listener); listener(this.currentMatch); return () => this._listeners.delete(listener); }
  public fallback(route: Route<any>) { this._fallbackRoute = route; }
  public onError(handler: (context: ErrorContext) => void) { this._onError = handler; }

  /**
   * Builds a URL string for a given route and its parameters.
   * This method is fully type-safe.
   * @param route The `Route` object to build a URL for.
   * @param params The parameters for the route, matching its definition.
   * @returns The generated URL string, or `null` if a required parameter is missing.
   * @example
   * const url = router.build(userRoute, { id: 123 }); // -> "/users/123"
   */
  public build<TParams>(route: Route<TParams>, params: TParams): string | null {
    let pathname = '';
    const query: string[] = [];
    for (const matcher of route.matchers) {
        const builtPart = matcher.build(params as any);
        if (builtPart === null && !['optionalPath', 'query', 'end'].includes(matcher.type)) return null;
        if (matcher.type === 'query') { if (builtPart) query.push(builtPart); } 
        else { pathname += builtPart; }
    }
    return (pathname || '/') + (query.length > 0 ? `?${query.join('&')}` : '');
  }
  
  /**
   * Navigates to a route using its type-safe reference.
   * This is the primary and recommended method for navigation.
   * @param route The `Route` object to navigate to.
   * @param params The parameters for the route, matching its definition.
   * @returns A promise that resolves to `true` if navigation was successful.
   * @example
   * await router.navigate(userRoute, { id: 456 });
   */
  public async navigate<TParams>(route: Route<TParams>, params: TParams): Promise<boolean> {
      const url = this.build(route, params);
      if (url === null) {
          console.error("[CombiRouter] Failed to build URL. A required parameter may be missing.", { route, params });
          return false;
      }
      return this._navigateToURL(url);
  }

  /**
   * Proactively fetches a route's data and lazy-loaded code without navigating.
   * This is ideal for improving perceived performance by loading on hover or viewport entry.
   * @param route The `Route` object to preload.
   * @param params The parameters for the route.
   * @example
   * link.addEventListener('mouseenter', () => {
   *   router.peek(userRoute, { id: 123 });
   * });
   */
  public async peek<TParams>(route: Route<TParams>, params: TParams): Promise<void> {
    if (route.metadata.lazy) await route.metadata.lazy.import();
    if (route.metadata.loader) {
      const url = this.build(route, params);
      if (!url) return;
      const cacheKey = route.metadata.cache?.key ? route.metadata.cache.key(params) : url;
      if (this._dataCache.has(cacheKey)) return;
      try {
        const data = await this._loadDataForRoute(route, { params } as any, new AbortController().signal);
        if (route.metadata.cache && cacheKey) {
          this._dataCache.set(cacheKey, { data, expires: Date.now() + route.metadata.cache.ttl });
        }
      } catch (error) {
        console.warn(`[CombiRouter] Peek failed for route ${route.id}:`, error);
      }
    }
  }
  
  /**
   * Matches a URL against the route configuration, building a complete, hierarchical
   * match tree representing the entire active nested route structure.
   * @param url The URL string to match.
   * @returns The root of the `RouteMatch` tree if successful, otherwise `null`.
   */
  public match(url: string): RouteMatch<any> | null {
      const parsedUrl = new URL(url, this._options.baseURL || 'http://localhost');
      
      const findRecursiveMatch = (currentPath: string, parentPath = ''): RouteMatch<any> | undefined => {
        let bestMatch: { route: Route<any>; result: Success<any>; remainingPath: string } | null = null;
        
        for (const route of this._allRoutes) {
          const result = route.parser.run({ input: currentPath, index: 0 });
          if (result.type === 'success') {
            const remainingPath = result.state.input.slice(result.state.index);
            if (!bestMatch || remainingPath.length < bestMatch.remainingPath.length) {
              bestMatch = { route, result, remainingPath };
            }
          }
        }
  
        if (!bestMatch) return undefined;

        const { route, result, remainingPath } = bestMatch;
        const { pathParams, queryParams } = this._processParams(result, parsedUrl);
        const allParams = { ...pathParams, ...queryParams };
  
        const matchedPathSegment = currentPath.substring(0, currentPath.length - remainingPath.length) || '/';
        const fullMatchedPath = parentPath ? `${parentPath.replace(/\/$/, '')}${matchedPathSegment}` : matchedPathSegment;

        return {
          route,
          params: allParams,
          pathname: fullMatchedPath,
          search: parsedUrl.search,
          hash: parsedUrl.hash,
          child: remainingPath && remainingPath !== '/' ? findRecursiveMatch(remainingPath, fullMatchedPath) : undefined,
        };
      };
      
      return findRecursiveMatch(parsedUrl.pathname) ?? null;
  }

  /**
   * The core navigation logic that handles the entire lifecycle.
   * @internal
   */
  private async _navigateToURL(url: string, isPopState = false): Promise<boolean> {
      if(this.isNavigating) return false;
      this.isNavigating = true;
      const navAbortController = new AbortController();

      // 1. Match URL: Find the route configuration that matches the given URL.
      let newMatch = this.match(url);
      if(!newMatch) {
          if (this._fallbackRoute) {
              newMatch = { route: this._fallbackRoute, params: {}, pathname: url, search: '', hash: '' };
          } else {
              console.error(`[CombiRouter] No route found for "${url}" and no fallback is configured.`);
              this.isNavigating = false;
              return false;
          }
      }

      try {
          // 2. Guards: Run pre-navigation checks.
          if (newMatch.route.metadata.guards) {
              for (const guard of newMatch.route.metadata.guards) {
                  const result = await guard({ to: newMatch, from: this.currentMatch });
                  if(result === false) { this.isNavigating = false; return false; }
                  if(typeof result === 'string') { this.isNavigating = false; return this._navigateToURL(result); }
              }
          }

          // 3. Data Loading: Fetch data for the entire match tree in parallel.
          this.isFetching = true;
          await this._loadDataForMatchTree(newMatch, navAbortController.signal);
          this.isFetching = false;
          
          // 4. DOM Update: Use View Transitions API if available for smooth animations.
          const updateDOM = () => { this.currentMatch = newMatch; this._notifyListeners(); };
          if (typeof (document as any).startViewTransition === 'function') {
            await (document as any).startViewTransition(updateDOM).ready;
          } else {
            updateDOM();
          }

          // 5. History: Update browser history after a successful navigation.
          if (typeof window !== 'undefined' && !isPopState) {
              window.history.pushState({ url }, '', this._options.hashMode ? `#${url}` : url);
          }
          this.isNavigating = false;
          return true;
      
      } catch (error) {
          if (error instanceof SuspensePromise) {
              await error; this.isNavigating = false; return this._navigateToURL(url, isPopState);
          }
          navAbortController.abort();
          this.isNavigating = false;
          this.isFetching = false;
          this._onError({ error, to: newMatch, from: this.currentMatch });
          console.error("[CombiRouter] Navigation error:", error);
          return false;
      }
  }

  private _processParams(result: Success<{ path: object; query: any[] }>, url: URL) {
    const pathParams = result.value.path;
    const queryParams: Record<string, any> = {};
    for (const q of result.value.query) {
      const value = url.searchParams.get(q.name);
      const valueToParse = value === null ? undefined : value;
      const validation = q.schema.safeParse(valueToParse);
      if (validation.success) {
        queryParams[q.name] = validation.data;
      } else {
        throw new Error(`Query param validation failed for "${q.name}": ${validation.error.message}`);
      }
    }
    return { pathParams, queryParams };
  }

  private async _loadDataForMatchTree(match: RouteMatch, signal: AbortSignal): Promise<void> {
    const loaders: Promise<void>[] = [];
    let current: RouteMatch | undefined = match;
    while(current) {
        if(current.route.metadata.loader) {
            const finalCurrent = current;
            loaders.push(this._loadDataForRoute(finalCurrent.route, finalCurrent, signal).then(data => { finalCurrent.data = data; }));
        }
        current = current.child;
    }
    await Promise.all(loaders);
  }

  private async _loadDataForRoute(route: Route<any>, matchContext: { params: any; search?: string }, signal: AbortSignal): Promise<any> {
    const cacheConfig = route.metadata.cache;
    if (cacheConfig) {
      const cacheKey = cacheConfig.key ? cacheConfig.key(matchContext.params) : this.build(route, matchContext.params);
      const cached = cacheKey ? this._dataCache.get(cacheKey) : undefined;
      if (cached && cached.expires > Date.now()) return cached.data;
    }
    const loaderContext: LoaderContext = { params: matchContext.params, searchParams: new URLSearchParams(matchContext.search || ''), signal };
    return await route.metadata.loader!(loaderContext);
  }

  private _notifyListeners() {
      for (const listener of this._listeners) { listener(this.currentMatch); }
  }
}

export function createRouter(routes: Route<any>[], options: RouterOptions = {}): CombiRouter {
  return new CombiRouter(routes, options);
}

// =================================================================
// -------------------- PARSING INTERNALS --------------------------
// =================================================================

/** @internal */
function buildRouteParser(matchers: readonly RouteMatcher[]): Parser<any> {
    const pathMatchers = matchers.filter(m => m.type !== 'query').map(m => m.parser);
    const queryMatchers = matchers.filter(m => m.type === 'query').map(m => m.parser);

    const pathParser = sequence(pathMatchers).map(results => Object.assign({}, ...results));
    const queryParser = sequence(queryMatchers).map(results => Object.assign({}, ...results));
    
    return pathParser.chain(path => 
        queryParser.map(query => ({ path, query }))
    );
}

// =================================================================
// --------------------- TYPE UTILITIES ----------------------------
// =================================================================

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
type InferMatcherParam<T extends RouteMatcher> = T extends { paramName: infer N; schema: z.ZodType<infer S> }
  ? N extends string ? { [K in N]: S } : {}
  : T extends { type: 'optionalPath', paramName: infer N }
  ? N extends string ? { [K in N]?: boolean } : {}
  : {};
type InferMatcherParams<T extends RouteMatcher[]> = UnionToIntersection<{ [K in keyof T]: T[K] extends RouteMatcher ? InferMatcherParam<T[K]> : never }[number]>;
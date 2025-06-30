// =================================================================
//
//      Combi-Router: A Composable, Type-Safe Router
//      Built on @doeixd/combi-parse
//
//      A production-ready router with nested routes, framework integration,
//      SSR support, testing utilities, plugins, and advanced features.
//
// =================================================================

import { 
  Parser, 
  str, 
  regex, 
  sequence, 
  choice, 
  sepBy, 
  between, 
  succeed, 
  fail,
  optional as optionalParser,
  many,
  eof
} from '@doeixd/combi-parse';
import { z } from 'zod';

// =================================================================
// Core Types
// =================================================================

/**
 * Represents a successful route match with the route name and extracted parameters.
 */
export interface RouteMatch<TName extends string = string, TParams = any> {
  readonly name: TName;
  readonly params: TParams;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

/**
 * Enhanced route match with metadata and route reference.
 */
export interface EnhancedRouteMatch<TName extends string = string, TParams = any> extends RouteMatch<TName, TParams> {
  route: Route<TParams>;
  metadata: RouteMetadata;
  data?: any;
  component?: any;
  children?: EnhancedRouteMatch[];
  parent?: EnhancedRouteMatch;
}

/**
 * Internal representation of a route matcher.
 */
export interface RouteMatcher {
  readonly type: string;
  readonly parser: Parser<any>;
  readonly paramName?: string;
  readonly schema?: z.ZodType<any>;
  readonly optional?: boolean;
}

// =================================================================
// Enhanced Route System with Nesting
// =================================================================

// =================================================================
// Enhanced Route System with Reference-Based Navigation
// =================================================================

/**
 * A route definition that can be extended, composed, and nested.
 * Each route has a unique identifier for reference-based navigation.
 */
export class Route<TParams = {}> {
  private static _nextId = 1;
  public readonly id: number = Route._nextId++;
  public readonly name?: string;

  constructor(
    public readonly matchers: RouteMatcher[],
    public readonly metadata: RouteMetadata = {},
    public readonly children: Route<any>[] = [],
    public readonly _phantomParams?: TParams,
    name?: string
  ) {
    this.name = name;
  }

  /**
   * The internal parser for this route, built from its matchers.
   */
  get parser(): Parser<TParams> {
    return buildRouteParser(this.matchers);
  }

  /**
   * Add child routes to this route.
   */
  nest(...childRoutes: Route<any>[]): Route<TParams> {
    return new Route(this.matchers, this.metadata, [...this.children, ...childRoutes], this._phantomParams, this.name);
  }

  /**
   * Get all descendant routes (children, grandchildren, etc.).
   */
  getAllDescendants(): Route<any>[] {
    const descendants: Route<any>[] = [];
    
    function collectDescendants(route: Route<any>) {
      descendants.push(...route.children);
      route.children.forEach(collectDescendants);
    }
    
    collectDescendants(this);
    return descendants;
  }

  /**
   * Create a named version of this route for debugging.
   */
  named(name: string): Route<TParams> {
    return new Route(this.matchers, this.metadata, this.children, this._phantomParams, name);
  }
}

// =================================================================
// Enhanced Router Configuration
// =================================================================

export interface RouterConfig<TRoutes extends Record<string, Route<any>> | Route<any>[]> {
  routes?: TRoutes;
  baseURL?: string;
  hashMode?: boolean;
  i18n?: I18nConfig;
  compilation?: RouteCompilationOptions;
  ssr?: boolean;
  plugins?: RouterPlugin[];
  middleware?: RouteMiddleware[];
  store?: any;
  
  // Advanced features (keeping all the existing advanced config)
  transitions?: {
    enter?: string | ((from: string, to: string) => string);
    exit?: string | ((from: string, to: string) => string);
    loading?: string;
    duration?: number;
  };
  cacheConfig?: {
    strategy?: 'lru' | 'lfu' | 'ttl';
    maxSize?: number;
    ttl?: number;
    compression?: boolean;
  };
  security?: {
    csp?: Record<string, string[]>;
    csrf?: { token: string | 'auto' };
    rateLimit?: { rpm: number };
    inputSanitization?: boolean;
    allowedOrigins?: string[];
  };
  devTools?: {
    showRouteTree?: boolean;
    trackPerformance?: boolean;
    logNavigations?: boolean;
    visualizer?: boolean;
    routeDebugging?: boolean;
  };
  a11y?: {
    focusManagement?: boolean | 'auto' | 'manual';
    announceRouteChanges?: boolean;
    skipLinks?: string[];
    reducedMotion?: 'respect' | 'ignore';
    landmarks?: boolean;
  };
  preloading?: {
    strategy?: 'immediate' | 'viewport' | 'hover' | 'idle';
    priority?: 'high' | 'normal' | 'low';
    routes?: Array<string>;
    prefetchData?: boolean;
    prefetchChunks?: boolean;
  };
  analytics?: {
    provider?: 'google-analytics' | 'plausible' | 'mixpanel' | 'custom';
    trackPageViews?: boolean;
    trackNavigationTiming?: boolean;
    trackErrorEvents?: boolean;
    customEvents?: string[];
    customHandler?: (event: any) => void;
  };
}

// =================================================================
// Enhanced Router with Reference-Based Navigation
// =================================================================

export class CombiRouter<TRoutes extends Record<string, Route<any>> | Route<any>[]> {
  private globalBeforeLoadHooks: BeforeLoadHook[] = [];
  private globalBeforeLeaveHooks: BeforeLeaveHook[] = [];
  private routeBeforeLoadHooks = new Map<number, BeforeLoadHook[]>();
  private routeBeforeLeaveHooks = new Map<number, BeforeLeaveHook[]>();
  private redirectHooks: RedirectHook[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private _currentMatch: EnhancedRouteMatch | null = null;
  private _isNavigating = false;
  private history: string[] = [];
  private historyIndex = -1;
  private compiledRoutes: CompiledRoute[] = [];
  private routeCache = new Map<string, EnhancedRouteMatch>();
  private plugins: RouterPlugin[] = [];
  private aliases = new Map<string, string>();
  private redirects = new Map<string, string>();
  private errorRoutes: ErrorRouteConfig = {};
  private listeners?: Set<(match: EnhancedRouteMatch | null) => void>;
  private performanceMetrics = new Map<string, number>();
  
  // Route mapping for reference-based navigation
  private routeMap = new Map<number, Route<any>>();
  private namedRoutes = new Map<string, Route<any>>();
  private routeArray: Route<any>[] = [];

  constructor(routesOrConfig: TRoutes | RouterConfig<TRoutes>, config?: RouterConfig<TRoutes>) {
    // Handle different constructor signatures
    if (Array.isArray(routesOrConfig) || this.isRouteObject(routesOrConfig)) {
      // First param is routes, second is config
      this.config = { routes: routesOrConfig, ...config } as RouterConfig<TRoutes>;
    } else {
      // First param is full config
      this.config = routesOrConfig as RouterConfig<TRoutes>;
    }

    this.setupRoutes();
    this.initializeRouter();
  }

  private isRouteObject(obj: any): obj is Record<string, Route<any>> {
    return obj && typeof obj === 'object' && !Array.isArray(obj) && 
           Object.values(obj).some(val => val instanceof Route);
  }

  private setupRoutes(): void {
    const routes = this.config.routes;
    if (!routes) return;

    if (Array.isArray(routes)) {
      // Array of routes
      this.routeArray = routes;
      routes.forEach(route => {
        this.routeMap.set(route.id, route);
        if (route.name) {
          this.namedRoutes.set(route.name, route);
        }
      });
    } else {
      // Named routes object
      Object.entries(routes).forEach(([name, route]) => {
        this.routeMap.set(route.id, route);
        this.namedRoutes.set(name, route);
        this.routeArray.push(route);
      });
    }
  }

  private initializeRouter(): void {
    // Install plugins
    if (this.config.plugins) {
      this.config.plugins.forEach(plugin => this.use(plugin));
    }

    // Set up error routes
    this.setupErrorRoutes();

    // Compile routes for performance
    if (this.config.compilation?.precompile !== false) {
      this.compile();
    }

    // Initialize with current URL if in browser
    if (typeof window !== 'undefined') {
      this.syncWithBrowser();
      this.setupBrowserListeners();
      this.setupErrorHandlers();
    }
  }

  /**
   * Current route match, if any.
   */
  get currentMatch(): EnhancedRouteMatch | null {
    return this._currentMatch;
  }

  /**
   * Whether the router is currently navigating.
   */
  get isNavigating(): boolean {
    return this._isNavigating;
  }

  /**
   * Get all routes as an array.
   */
  get routes(): Route<any>[] {
    return [...this.routeArray];
  }

  // =================================================================
  // Reference-Based Navigation (Primary API)
  // =================================================================

  /**
   * Navigate to a route using route reference (primary API).
   */
  async navigate<T>(
    route: Route<T>, 
    params: InferParams<Route<T>>, 
    options?: NavigationOptions
  ): Promise<boolean>;

  /**
   * Navigate to a route using route name (backward compatibility).
   */
  async navigate<K extends keyof TRoutes>(
    routeName: K, 
    params: TRoutes extends Record<string, Route<any>> ? InferParams<TRoutes[K]> : never,
    options?: NavigationOptions
  ): Promise<boolean>;

  async navigate(
    routeOrName: any, 
    params: any = {}, 
    options: NavigationOptions = {}
  ): Promise<boolean> {
    if (routeOrName instanceof Route) {
      return this.navigateByRoute(routeOrName, params, options);
    } else {
      return this.navigateByName(routeOrName, params, options);
    }
  }

  private async navigateByRoute<T>(
    route: Route<T>,
    params: InferParams<Route<T>>,
    options: NavigationOptions = {}
  ): Promise<boolean> {
    const url = this.buildFromRoute(route, params);
    return this.navigateToURL(url, options);
  }

  private async navigateByName(
    routeName: string,
    params: any = {},
    options: NavigationOptions = {}
  ): Promise<boolean> {
    const route = this.namedRoutes.get(routeName);
    if (!route) {
      console.error(`Route '${routeName}' not found`);
      return false;
    }
    return this.navigateByRoute(route, params, options);
  }

  /**
   * Build URL from route reference (primary API).
   */
  build<T>(route: Route<T>, params: InferParams<Route<T>>): string;

  /**
   * Build URL from route name (backward compatibility).
   */
  build<K extends keyof TRoutes>(
    routeName: K,
    params: TRoutes extends Record<string, Route<any>> ? InferParams<TRoutes[K]> : never
  ): string;

  build(routeOrName: any, params: any = {}): string {
    if (routeOrName instanceof Route) {
      return this.buildFromRoute(routeOrName, params);
    } else {
      return this.buildFromName(routeOrName, params);
    }
  }

  private buildFromRoute<T>(route: Route<T>, params: InferParams<Route<T>>): string {
    return this.generateURL(route, params);
  }

  private buildFromName(routeName: string, params: any = {}): string {
    const route = this.namedRoutes.get(routeName);
    if (!route) {
      throw new Error(`Route '${routeName}' not found`);
    }
    return this.buildFromRoute(route, params);
  }

  // =================================================================
  // Enhanced Lifecycle Hooks with Route References
  // =================================================================

  /**
   * Add global beforeLoad hook.
   */
  beforeLoad(hook: BeforeLoadHook): () => void;
  
  /**
   * Add beforeLoad hook for specific route reference.
   */
  beforeLoad<T>(route: Route<T>, hook: BeforeLoadHook<InferParams<Route<T>>>): () => void;
  
  /**
   * Add beforeLoad hook for named route (backward compatibility).
   */
  beforeLoad<K extends keyof TRoutes>(
    routeName: K,
    hook: TRoutes extends Record<string, Route<any>> ? BeforeLoadHook<InferParams<TRoutes[K]>> : never
  ): () => void;

  beforeLoad(routeOrHook: any, hook?: any): () => void {
    if (typeof routeOrHook === 'function') {
      // Global hook
      this.globalBeforeLoadHooks.push(routeOrHook);
      return () => {
        const index = this.globalBeforeLoadHooks.indexOf(routeOrHook);
        if (index > -1) this.globalBeforeLoadHooks.splice(index, 1);
      };
    } else if (routeOrHook instanceof Route) {
      // Route reference
      const routeId = routeOrHook.id;
      if (!this.routeBeforeLoadHooks.has(routeId)) {
        this.routeBeforeLoadHooks.set(routeId, []);
      }
      this.routeBeforeLoadHooks.get(routeId)!.push(hook);
      
      return () => {
        const hooks = this.routeBeforeLoadHooks.get(routeId);
        if (hooks) {
          const index = hooks.indexOf(hook);
          if (index > -1) hooks.splice(index, 1);
        }
      };
    } else {
      // Named route (backward compatibility)
      const route = this.namedRoutes.get(routeOrHook);
      if (!route) {
        throw new Error(`Route '${routeOrHook}' not found`);
      }
      return this.beforeLoad(route, hook);
    }
  }

  /**
   * Add global beforeLeave hook.
   */
  beforeLeave(hook: BeforeLeaveHook): () => void;
  
  /**
   * Add beforeLeave hook for specific route reference.
   */
  beforeLeave<T>(route: Route<T>, hook: BeforeLeaveHook<InferParams<Route<T>>>): () => void;
  
  /**
   * Add beforeLeave hook for named route (backward compatibility).
   */
  beforeLeave<K extends keyof TRoutes>(
    routeName: K,
    hook: TRoutes extends Record<string, Route<any>> ? BeforeLeaveHook<InferParams<TRoutes[K]>> : never
  ): () => void;

  beforeLeave(routeOrHook: any, hook?: any): () => void {
    if (typeof routeOrHook === 'function') {
      // Global hook
      this.globalBeforeLeaveHooks.push(routeOrHook);
      return () => {
        const index = this.globalBeforeLeaveHooks.indexOf(routeOrHook);
        if (index > -1) this.globalBeforeLeaveHooks.splice(index, 1);
      };
    } else if (routeOrHook instanceof Route) {
      // Route reference
      const routeId = routeOrHook.id;
      if (!this.routeBeforeLeaveHooks.has(routeId)) {
        this.routeBeforeLeaveHooks.set(routeId, []);
      }
      this.routeBeforeLeaveHooks.get(routeId)!.push(hook);
      
      return () => {
        const hooks = this.routeBeforeLeaveHooks.get(routeId);
        if (hooks) {
          const index = hooks.indexOf(hook);
          if (index > -1) hooks.splice(index, 1);
        }
      };
    } else {
      // Named route (backward compatibility)
      const route = this.namedRoutes.get(routeOrHook);
      if (!route) {
        throw new Error(`Route '${routeOrHook}' not found`);
      }
      return this.beforeLeave(route, hook);
    }
  }

  onRedirect(hook: RedirectHook): () => void {
    this.redirectHooks.push(hook);
    return () => {
      const index = this.redirectHooks.indexOf(hook);
      if (index > -1) this.redirectHooks.splice(index, 1);
    };
  }

  // =================================================================
  // Enhanced Framework Integration
  // =================================================================

  /**
   * Create React integration with reference-based navigation.
   */
  createReactIntegration() {
    const React = this.getReact();
    if (!React) {
      throw new Error('React is not available. Install react to use React integration.');
    }

    const RouterContext = React.createContext<CombiRouter<TRoutes> | null>(null);

    // Router Provider Component
    const RouterProvider = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(RouterContext.Provider, { value: this }, children);
    };

    // Hook to access router
    const useRouter = () => {
      const router = React.useContext(RouterContext);
      if (!router) {
        throw new Error('useRouter must be used within a RouterProvider');
      }
      return router;
    };

    // Hook to access current route
    const useCurrentRoute = () => {
      const router = useRouter();
      const [match, setMatch] = React.useState(router.currentMatch);

      React.useEffect(() => {
        const unsubscribe = router.subscribe((newMatch) => {
          setMatch(newMatch);
        });
        return unsubscribe;
      }, [router]);

      return match;
    };

    // Hook to access route parameters
    const useParams = <T = any>(): T => {
      const match = useCurrentRoute();
      return match?.params as T || {} as T;
    };

    // Hook to access search parameters
    const useSearchParams = () => {
      const match = useCurrentRoute();
      return React.useMemo(() => 
        new URLSearchParams(match?.search || ''), 
        [match?.search]
      );
    };

    // Enhanced Link Component with route references
    const Link = React.forwardRef<
      HTMLAnchorElement,
      {
        to: Route<any>;
        params?: any;
        children: React.ReactNode;
        className?: string;
        activeClassName?: string;
        replace?: boolean;
        onClick?: (e: React.MouseEvent) => void;
      } | {
        to: keyof TRoutes;
        params?: any;
        children: React.ReactNode;
        className?: string;
        activeClassName?: string;
        replace?: boolean;
        onClick?: (e: React.MouseEvent) => void;
      }
    >(({ to, params = {}, children, className, activeClassName, replace, onClick, ...props }, ref) => {
      const router = useRouter();
      const currentMatch = useCurrentRoute();
      
      const href = router.build(to as any, params);
      const isActive = currentMatch?.route === to || 
        (typeof to === 'string' && currentMatch?.route === router.namedRoutes.get(to));
      
      const handleClick = React.useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (onClick) onClick(e);
        
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) {
          return;
        }
        
        e.preventDefault();
        router.navigate(to as any, params, { replace });
      }, [router, to, params, replace, onClick]);

      const finalClassName = [
        className,
        isActive && activeClassName
      ].filter(Boolean).join(' ');

      return React.createElement('a', {
        ref,
        href,
        className: finalClassName,
        onClick: handleClick,
        ...props
      }, children);
    });

    // Navigate hook with route references
    const useNavigate = () => {
      const router = useRouter();
      return React.useCallback((to: Route<any> | keyof TRoutes, params?: any, options?: NavigationOptions) => {
        return router.navigate(to as any, params, options);
      }, [router]);
    };

    // Outlet Component for nested routes (unchanged)
    const Outlet = ({ name = 'default' }: { name?: string } = {}) => {
      const match = useCurrentRoute();
      const router = useRouter();
      
      if (!match?.children?.length) {
        return null;
      }

      const childMatch = match.children.find(child => 
        child.metadata.outlet === name || (!child.metadata.outlet && name === 'default')
      );

      if (!childMatch) {
        return null;
      }

      return router.renderComponent(childMatch);
    };

    return {
      RouterProvider,
      useRouter,
      useCurrentRoute,
      useParams,
      useSearchParams,
      useNavigate,
      Link,
      Outlet
    };
  }

/**
 * Metadata that can be attached to routes for SEO, data loading, layouts, etc.
 */
export interface RouteMetadata {
  title?: string | ((params: any, data?: any) => string);
  description?: string | ((params: any, data?: any) => string);
  breadcrumbs?: Array<string | ((params: any, data?: any) => string)>;
  loader?: RouteLoader<any>;
  component?: RouteComponent;
  layout?: RouteLayout;
  lazy?: RouteLazy;
  guards?: RouteGuard[];
  errorBoundary?: RouteErrorBoundary;
  preload?: PreloadStrategy;
  cache?: CacheConfig;
  seo?: SEOConfig;
  outlet?: string;
  middleware?: RouteMiddleware[];
  plugins?: RoutePlugin[];
  store?: StoreConfig;
  parallel?: boolean;
  prefetch?: string[];
  locale?: string | string[];
  alias?: string[];
  redirect?: string;
  [key: string]: any;
}

// =================================================================
// Advanced Type Definitions
// =================================================================

export type RouteLoader<TData = any> = (context: LoaderContext) => Promise<TData> | TData;

export interface LoaderContext {
  params: Record<string, any>;
  searchParams: URLSearchParams;
  url: string;
  signal?: AbortSignal;
  request?: Request;
  parent?: LoaderContext;
  store?: any;
}

export interface RouteComponent {
  type: 'function' | 'class' | 'element';
  component: any;
  props?: Record<string, any>;
}

export interface RouteLayout {
  component: any;
  props?: Record<string, any>;
  outlet?: string;
  nested?: boolean;
}

export interface RouteLazy {
  import: () => Promise<any>;
  preload?: PreloadStrategy;
  fallback?: RouteComponent;
  chunkName?: string;
}

export type RouteGuard = (context: GuardContext) => Promise<boolean | string> | boolean | string;

export interface GuardContext extends LoaderContext {
  from?: RouteMatch<string, any>;
  to: RouteMatch<string, any>;
}

export interface RouteErrorBoundary {
  component: any;
  fallback?: RouteComponent;
  onError?: (error: Error, context: LoaderContext) => void;
}

export type PreloadStrategy = 'hover' | 'visible' | 'immediate' | 'none' | 'viewport';

export interface CacheConfig {
  key?: string | ((params: any) => string);
  ttl?: number;
  staleWhileRevalidate?: boolean;
  invalidateOn?: string[];
  scope?: 'global' | 'session' | 'user';
}

export interface SEOConfig {
  title?: string | ((params: any, data?: any) => string);
  description?: string | ((params: any, data?: any) => string);
  keywords?: string[];
  canonical?: string | ((params: any, data?: any) => string);
  ogImage?: string | ((params: any, data?: any) => string);
  jsonLd?: Record<string, any> | ((params: any, data?: any) => Record<string, any>);
  noindex?: boolean;
  nofollow?: boolean;
}

// =================================================================
// Plugin Architecture
// =================================================================

export interface RouterPlugin {
  name: string;
  version?: string;
  install(router: CombiRouter<any>, options?: any): void | Promise<void>;
  uninstall?(router: CombiRouter<any>): void | Promise<void>;
}

export interface RoutePlugin {
  name: string;
  process(route: Route<any>, context: LoaderContext): Promise<Route<any>> | Route<any>;
}

export interface RouteMiddleware {
  name: string;
  execute(context: LoaderContext, next: () => Promise<any>): Promise<any>;
}

// =================================================================
// Store Integration
// =================================================================

export interface StoreConfig {
  connect?: string | string[];
  optimistic?: boolean;
  invalidateOn?: string[];
  selector?: (state: any, params: any) => any;
  actions?: Record<string, (params: any) => any>;
}

// =================================================================
// Internationalization
// =================================================================

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  strategy: 'prefix' | 'domain' | 'subdomain';
  fallback?: boolean;
}

// =================================================================
// Navigation Types
// =================================================================

export type NavigationResult = 'allow' | 'block' | 'redirect';

export interface NavigationContext<TParams = any> {
  from?: RouteMatch<string, any>;
  to: RouteMatch<string, TParams>;
  params: TParams;
  searchParams: URLSearchParams;
  url: string;
}

export interface BeforeLoadHook<TParams = any> {
  (context: NavigationContext<TParams>): NavigationResult | Promise<NavigationResult> | void;
}

export interface BeforeLeaveHook<TParams = any> {
  (context: NavigationContext<TParams>): NavigationResult | Promise<NavigationResult> | void;
}

export interface RedirectHook {
  (from: string, to: string): void;
}

export interface NavigationOptions {
  replace?: boolean;
  state?: any;
  scroll?: boolean;
  skipLoader?: boolean;
  skipLazyLoad?: boolean;
  signal?: AbortSignal;
}

// =================================================================
// Compiled Route System for Performance
// =================================================================

export interface CompiledRoute {
  matcher: (path: string) => RouteMatch | null;
  priority: number;
  pattern: string;
  route: Route<any>;
}

export interface RouteCompilationOptions {
  enableCaching?: boolean;
  cacheSize?: number;
  optimization?: 'speed' | 'memory' | 'balanced';
  precompile?: string[];
}

// =================================================================
// SSR Types
// =================================================================

export interface SSRContext {
  url: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  userAgent?: string;
  locale?: string;
  isBot?: boolean;
}

export interface SSRResult {
  html: string;
  head: string;
  data: any;
  statusCode: number;
  redirectUrl?: string;
}

// =================================================================
// Testing Types
// =================================================================

export interface MockRouterOptions {
  initialRoute?: string;
  initialParams?: Record<string, any>;
  mockLoaders?: Record<string, any>;
  mockGuards?: Record<string, boolean | string>;
}

export interface RouterTestContext {
  router: CombiRouter<any>;
  navigate: (route: string, params?: any) => Promise<void>;
  expectRoute: (route: string, params?: any) => void;
  expectRedirect: (from: string, to: string) => void;
}

/**
 * Infer the parameter types from a route.
 */
export type InferParams<T> = T extends Route<infer P> ? P : never;

// =================================================================
// URL Parsing Utilities
// =================================================================

/**
 * Parse a URL into its components for route matching.
 */
interface ParsedURL {
  protocol?: string;
  subdomain?: string;
  domain?: string;
  pathname: string;
  search: string;
  hash: string;
}

function parseURL(input: string | URL): ParsedURL {
  let url: URL;
  
  if (typeof input === 'string') {
    // Handle relative URLs
    if (input.startsWith('/')) {
      url = new URL(input, 'http://localhost');
    } else if (!input.includes('://')) {
      url = new URL('http://' + input);
    } else {
      url = new URL(input);
    }
  } else {
    url = input;
  }

  const hostParts = url.hostname.split('.');
  let subdomain: string | undefined;
  let domain: string | undefined;

  if (hostParts.length > 2) {
    subdomain = hostParts[0];
    domain = hostParts.slice(1).join('.');
  } else if (hostParts.length === 2) {
    domain = url.hostname;
  }

  return {
    protocol: url.protocol.replace(':', ''),
    subdomain,
    domain,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash
  };
}

// =================================================================
// Route Matchers
// =================================================================

/**
 * Matches a static path segment.
 */
export function path(segment: string): RouteMatcher {
  return {
    type: 'path',
    parser: str('/').keepRight(str(segment))
  };
}

/**
 * Matches a dynamic path parameter with validation.
 */
export function param<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'param',
    paramName: name,
    schema,
    parser: str('/').keepRight(regex(/[^\/\?\#]+/)).tryMap(value => {
      const result = schema.safeParse(value);
      if (!result.success) {
        return fail(`valid ${name} (${result.error.message})`).run({ input: '', index: 0 });
      }
      return succeed({ [name]: result.data }).run({ input: '', index: 0 });
    })
  };
}

// Add a namespace for path variations
path.param = param;

/**
 * Matches remaining path segments as an array.
 */
function pathRest<T = string[]>(name: string): RouteMatcher {
  return {
    type: 'pathRest',
    paramName: name,
    parser: many(str('/').keepRight(regex(/[^\/\?\#]+/))).map(segments => ({ [name]: segments }))
  };
}

path.rest = pathRest;

/**
 * Matches a required query parameter.
 */
export function query<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'query',
    paramName: name,
    schema,
    parser: sequence([
      str(name),
      str('='),
      regex(/[^&#]*/)
    ]).tryMap(([, , value]) => {
      const result = schema.safeParse(value);
      if (!result.success) {
        return fail(`valid ${name} query parameter (${result.error.message})`).run({ input: '', index: 0 });
      }
      return succeed({ [name]: result.data }).run({ input: '', index: 0 });
    })
  };
}

/**
 * Matches an optional query parameter.
 */
function optionalQuery<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'query',
    paramName: name,
    schema,
    optional: true,
    parser: optionalParser(query(name, schema).parser).map(result => result || {})
  };
}

query.optional = optionalQuery;

/**
 * Matches a static subdomain.
 */
export function subdomain(name: string): RouteMatcher {
  return {
    type: 'subdomain',
    parser: str(name)
  };
}

/**
 * Matches a dynamic subdomain parameter.
 */
function subdomainParam<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'subdomainParam',
    paramName: name,
    schema,
    parser: regex(/[^.]+/).tryMap(value => {
      const result = schema.safeParse(value);
      if (!result.success) {
        return fail(`valid ${name} subdomain (${result.error.message})`).run({ input: '', index: 0 });
      }
      return succeed({ [name]: result.data }).run({ input: '', index: 0 });
    })
  };
}

subdomain.param = subdomainParam;

/**
 * Matches a URL hash fragment.
 */
export function hash<T>(schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'hash',
    schema,
    parser: str('#').keepRight(regex(/.*$/)).tryMap(value => {
      const result = schema.safeParse(value);
      if (!result.success) {
        return fail(`valid hash (${result.error.message})`).run({ input: '', index: 0 });
      }
      return succeed({ hash: result.data }).run({ input: '', index: 0 });
    })
  };
}

/**
 * Matches the end of the path (no more segments).
 */
export const end: RouteMatcher = {
  type: 'end',
  parser: choice([eof, str('?'), str('#')]).map(() => ({}))
};

/**
 * Middleware matcher for request processing.
 */
export function middleware(handler: (req: any) => any): RouteMatcher {
  return {
    type: 'middleware',
    parser: succeed({}).map(() => ({ middleware: handler }))
  };
}

/**
 * Header requirement matcher.
 */
export function header<T>(name: string, schema: z.ZodType<T>): RouteMatcher {
  return {
    type: 'header',
    paramName: name,
    schema,
    parser: succeed({}).map(() => ({ [`header_${name}`]: true })) // Placeholder for header validation
  };
}

// =================================================================
// Route Parser Builder
// =================================================================

function buildRouteParser<T>(matchers: RouteMatcher[]): Parser<T> {
  // Separate matchers by type for proper parsing order
  const subdomainMatchers = matchers.filter(m => m.type === 'subdomain' || m.type === 'subdomainParam');
  const pathMatchers = matchers.filter(m => m.type === 'path' || m.type === 'param' || m.type === 'pathRest' || m.type === 'end');
  const queryMatchers = matchers.filter(m => m.type === 'query');
  const hashMatchers = matchers.filter(m => m.type === 'hash');
  const otherMatchers = matchers.filter(m => !['subdomain', 'subdomainParam', 'path', 'param', 'pathRest', 'end', 'query', 'hash'].includes(m.type));

  // Build parser for each section
  const subdomainParser = subdomainMatchers.length > 0 
    ? sequence(subdomainMatchers.map(m => m.parser))
    : succeed([]);

  const pathParser = pathMatchers.length > 0
    ? sequence(pathMatchers.map(m => m.parser))
    : succeed([]);

  const queryParser = queryMatchers.length > 0
    ? str('?').keepRight(sepBy(
        choice(queryMatchers.map(m => m.parser)),
        str('&')
      ))
    : succeed([]);

  const hashParser = hashMatchers.length > 0
    ? choice(hashMatchers.map(m => m.parser))
    : succeed({});

  const otherParser = otherMatchers.length > 0
    ? sequence(otherMatchers.map(m => m.parser))
    : succeed([]);

  // Combine all parsers and merge results
  return sequence([
    subdomainParser,
    pathParser, 
    queryParser,
    hashParser,
    otherParser
  ]).map(([subdomainResults, pathResults, queryResults, hashResult, otherResults]) => {
    const params: any = {};
    
    // Merge all parameter objects
    [...subdomainResults, ...pathResults, ...queryResults, hashResult, ...otherResults]
      .forEach(result => {
        if (result && typeof result === 'object') {
          Object.assign(params, result);
        }
      });

    return params as T;
  });
}

// =================================================================
// Route Building Functions
// =================================================================

/**
 * Creates a new route from a list of matchers.
 */
export function route<T extends RouteMatcher[]>(...matchers: T): Route<InferMatcherParams<T>> {
  return new Route(matchers, {});
}

/**
 * Extends an existing route with additional matchers.
 */
export function extend<TBase, TExtension extends RouteMatcher[]>(
  baseRoute: Route<TBase>,
  ...additionalMatchers: TExtension
): Route<TBase & InferMatcherParams<TExtension>> {
  return new Route([...baseRoute.matchers, ...additionalMatchers], baseRoute.metadata);
}

// =================================================================
// Higher-Order Route Enhancers (Functional Composition)
// =================================================================

/**
 * Adds metadata to a route. Returns a new route with the metadata attached.
 */
export function meta<TParams>(metadata: Partial<RouteMetadata>) {
  return (route: Route<TParams>): Route<TParams> => {
    return new Route(route.matchers, { ...route.metadata, ...metadata }, route._phantomParams);
  };
}

/**
 * Adds a data loader to a route. The loader runs before the route component is rendered.
 */
export function loader<TParams, TData>(
  loaderFn: RouteLoader<TData>
) {
  return (route: Route<TParams>): Route<TParams> => {
    return new Route(
      route.matchers, 
      { ...route.metadata, loader: loaderFn }, 
      route._phantomParams
    );
  };
}

/**
 * Wraps a route with a layout component.
 */
export function layout<TParams>(
  layoutComponent: any,
  props?: Record<string, any>,
  outlet = 'default'
) {
  return (route: Route<TParams>): Route<TParams> => {
    const layoutConfig: RouteLayout = {
      component: layoutComponent,
      props,
      outlet
    };
    return new Route(
      route.matchers,
      { ...route.metadata, layout: layoutConfig },
      route._phantomParams
    );
  };
}

/**
 * Makes a route lazy-loaded with code splitting.
 */
export function lazy<TParams>(
  importFn: () => Promise<any>,
  options: { preload?: PreloadStrategy; fallback?: RouteComponent } = {}
) {
  return (route: Route<TParams>): Route<TParams> => {
    const lazyConfig: RouteLazy = {
      import: importFn,
      preload: options.preload || 'none',
      fallback: options.fallback
    };
    return new Route(
      route.matchers,
      { ...route.metadata, lazy: lazyConfig },
      route._phantomParams
    );
  };
}

/**
 * Adds route guards that run before navigation.
 */
export function guard<TParams>(...guards: RouteGuard[]) {
  return (route: Route<TParams>): Route<TParams> => {
    const existingGuards = route.metadata.guards || [];
    return new Route(
      route.matchers,
      { ...route.metadata, guards: [...existingGuards, ...guards] },
      route._phantomParams
    );
  };
}

/**
 * Adds an error boundary to a route.
 */
export function errorBoundary<TParams>(
  boundaryComponent: any,
  fallback?: RouteComponent
) {
  return (route: Route<TParams>): Route<TParams> => {
    const errorBoundaryConfig: RouteErrorBoundary = {
      component: boundaryComponent,
      fallback
    };
    return new Route(
      route.matchers,
      { ...route.metadata, errorBoundary: errorBoundaryConfig },
      route._phantomParams
    );
  };
}

/**
 * Configures caching for a route's data.
 */
export function cache<TParams>(config: CacheConfig) {
  return (route: Route<TParams>): Route<TParams> => {
    return new Route(
      route.matchers,
      { ...route.metadata, cache: config },
      route._phantomParams
    );
  };
}

/**
 * Adds SEO configuration to a route.
 */
export function seo<TParams>(config: SEOConfig) {
  return (route: Route<TParams>): Route<TParams> => {
    return new Route(
      route.matchers,
      { ...route.metadata, seo: config },
      route._phantomParams
    );
  };
}

/**
 * Sets preload strategy for a route.
 */
export function preload<TParams>(strategy: PreloadStrategy) {
  return (route: Route<TParams>): Route<TParams> => {
    return new Route(
      route.matchers,
      { ...route.metadata, preload: strategy },
      route._phantomParams
    );
  };
}

// =================================================================
// Composition Utilities
// =================================================================

/**
 * Functional composition utility - applies functions from right to left.
 */
export function pipe<T>(...fns: Array<(arg: T) => T>) {
  return (initial: T): T => fns.reduce((acc, fn) => fn(acc), initial);
}

/**
 * Creates reusable route enhancer combinations.
 */
export function withAuth<TParams>(
  redirectTo = '/login'
): (route: Route<TParams>) => Route<TParams> {
  return pipe(
    meta({ requiresAuth: true }),
    guard(async (context) => {
      const isAuthenticated = await checkAuth(context);
      return isAuthenticated || redirectTo;
    })
  );
}

/**
 * Creates an admin-protected route enhancer.
 */
export function withAdmin<TParams>(
  redirectTo = '/unauthorized'
): (route: Route<TParams>) => Route<TParams> {
  return pipe(
    withAuth(redirectTo),
    guard(async (context) => {
      const isAdmin = await checkAdminRole(context);
      return isAdmin || redirectTo;
    }),
    meta({ requiresAdmin: true })
  );
}

/**
 * Creates a route enhancer with common API patterns.
 */
export function withApiData<TParams, TData>(
  fetchFn: (params: TParams) => Promise<TData>,
  cacheOptions?: CacheConfig
): (route: Route<TParams>) => Route<TParams> {
  const enhancers = [
    loader(async (context) => fetchFn(context.params as TParams)),
    errorBoundary(ApiErrorBoundary)
  ];

  if (cacheOptions) {
    enhancers.push(cache(cacheOptions));
  }

  return pipe(...enhancers);
}

// Placeholder functions for examples
async function checkAuth(context: GuardContext): Promise<boolean> {
  // Implementation would check authentication status
  return true;
}

async function checkAdminRole(context: GuardContext): Promise<boolean> {
  // Implementation would check admin role
  return true;
}

const ApiErrorBoundary = () => null; // Placeholder component

/**
 * Type utility to infer parameter types from matchers.
 */
type InferMatcherParams<T extends RouteMatcher[]> = T extends readonly [] 
  ? {}
  : UnionToIntersection<{
      [K in keyof T]: T[K] extends RouteMatcher ? InferMatcherParam<T[K]> : never;
    }[number]>;

type InferMatcherParam<T extends RouteMatcher> = 
  T extends { paramName: infer N; schema: z.ZodType<infer S> } 
    ? N extends string 
      ? { [K in N]: S }
      : {}
    : {};

// Utility type to convert union to intersection  
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// =================================================================
// Lifecycle and Navigation Types
// =================================================================

export type NavigationResult = 'allow' | 'block' | 'redirect';

export interface NavigationContext<TParams = any> {
  from?: RouteMatch<string, any>;
  to: RouteMatch<string, TParams>;
  params: TParams;
  searchParams: URLSearchParams;
  url: string;
}

export interface BeforeLoadHook<TParams = any> {
  (context: NavigationContext<TParams>): NavigationResult | Promise<NavigationResult> | void;
}

export interface BeforeLeaveHook<TParams = any> {
  (context: NavigationContext<TParams>): NavigationResult | Promise<NavigationResult> | void;
}

export interface RedirectHook {
  (from: string, to: string): void;
}

/**
 * Enhanced route match with metadata and route reference.
 */
export interface EnhancedRouteMatch<TName extends string = string, TParams = any> extends RouteMatch<TName, TParams> {
  route: Route<TParams>;
  metadata: RouteMetadata;
  data?: any;
  component?: any;
}

export interface NavigationOptions {
  replace?: boolean;
  state?: any;
  scroll?: boolean;
  skipLoader?: boolean;
  skipLazyLoad?: boolean;
  signal?: AbortSignal;
}

// =================================================================
// Router Implementation
// =================================================================

export interface RouterConfig<TRoutes extends Record<string, Route<any>>> {
  routes: TRoutes;
  baseURL?: string;
  hashMode?: boolean;
}

export class CombiRouter<TRoutes extends Record<string, Route<any>>> {
  private globalBeforeLoadHooks: BeforeLoadHook[] = [];
  private globalBeforeLeaveHooks: BeforeLeaveHook[] = [];
  private routeBeforeLoadHooks = new Map<string, BeforeLoadHook[]>();
  private routeBeforeLeaveHooks = new Map<string, BeforeLeaveHook[]>();
  private redirectHooks: RedirectHook[] = [];
  private _currentMatch: RouteMatch<keyof TRoutes & string, any> | null = null;
  private _isNavigating = false;
  private history: string[] = [];
  private historyIndex = -1;

  constructor(private config: RouterConfig<TRoutes>) {
    // Initialize with current URL if in browser
    if (typeof window !== 'undefined') {
      this.syncWithBrowser();
      this.setupBrowserListeners();
    }
  }

  /**
   * Current route match, if any.
   */
  get currentMatch(): RouteMatch<keyof TRoutes & string, any> | null {
    return this._currentMatch;
  }

  /**
   * Whether the router is currently navigating.
   */
  get isNavigating(): boolean {
    return this._isNavigating;
  }

  /**
   * Match a URL against all routes and return the first match with metadata.
   */
  match(input: string | URL): EnhancedRouteMatch<keyof TRoutes & string, any> | null {
    const parsed = parseURL(input);
    const fullInput = this.buildFullInput(parsed);

    for (const [name, route] of Object.entries(this.config.routes)) {
      try {
        const params = route.parser.parse(fullInput, { consumeAll: false });
        return {
          name: name as keyof TRoutes & string,
          params,
          pathname: parsed.pathname,
          search: parsed.search,
          hash: parsed.hash,
          route,
          metadata: route.metadata
        };
      } catch (error) {
        // This route didn't match, try the next one
        continue;
      }
    }

    return null;
  }

  /**
   * Load data for a route using its loader.
   */
  async loadRouteData<TName extends keyof TRoutes>(
    match: EnhancedRouteMatch<TName & string, any>,
    signal?: AbortSignal
  ): Promise<any> {
    const { loader } = match.metadata;
    if (!loader) return null;

    const context: LoaderContext = {
      params: match.params,
      searchParams: new URLSearchParams(match.search),
      url: this.build(match.name, match.params),
      signal
    };

    try {
      return await loader(context);
    } catch (error) {
      console.error(`Loader error for route ${String(match.name)}:`, error);
      throw error;
    }
  }

  /**
   * Run route guards and return the result.
   */
  async runRouteGuards(
    match: EnhancedRouteMatch<keyof TRoutes & string, any>,
    from?: RouteMatch<string, any>
  ): Promise<boolean | string> {
    const { guards } = match.metadata;
    if (!guards || guards.length === 0) return true;

    const context: GuardContext = {
      params: match.params,
      searchParams: new URLSearchParams(match.search),
      url: this.build(match.name, match.params),
      from,
      to: match
    };

    for (const guard of guards) {
      const result = await guard(context);
      if (result !== true) {
        return result; // false or redirect URL
      }
    }

    return true;
  }

  /**
   * Load lazy route component.
   */
  async loadLazyRoute(match: EnhancedRouteMatch<keyof TRoutes & string, any>): Promise<any> {
    const { lazy } = match.metadata;
    if (!lazy) return null;

    try {
      const module = await lazy.import();
      return module.default || module;
    } catch (error) {
      console.error(`Failed to load lazy route ${String(match.name)}:`, error);
      return lazy.fallback?.component || null;
    }
  }

  /**
   * Enhanced navigation with full lifecycle support.
   */
  async navigateToURL(url: string, options: NavigationOptions = {}): Promise<boolean> {
    if (this._isNavigating) {
      console.warn('Navigation already in progress');
      return false;
    }

    const newMatch = this.match(url) as EnhancedRouteMatch<keyof TRoutes & string, any> | null;
    if (!newMatch) {
      console.warn(`No route matched for URL: ${url}`);
      return false;
    }

    this._isNavigating = true;

    try {
      // Create navigation context
      const context: NavigationContext = {
        from: this._currentMatch,
        to: newMatch,
        params: newMatch.params,
        searchParams: new URLSearchParams(newMatch.search),
        url
      };

      // Run beforeLeave hooks for current route
      if (this._currentMatch) {
        const leaveResult = await this.runBeforeLeaveHooks(this._currentMatch, context);
        if (leaveResult === 'block') {
          return false;
        }
        if (leaveResult === 'redirect') {
          return true;
        }
      }

      // Run route guards
      const guardResult = await this.runRouteGuards(newMatch, this._currentMatch);
      if (guardResult !== true) {
        if (typeof guardResult === 'string') {
          // Redirect to guard result
          return this.navigateToURL(guardResult, { ...options, replace: true });
        }
        return false; // Blocked
      }

      // Run beforeLoad hooks
      const loadResult = await this.runBeforeLoadHooks(newMatch, context);
      if (loadResult === 'block') {
        return false;
      }
      if (loadResult === 'redirect') {
        return true;
      }

      // Load route data if needed
      if (newMatch.metadata.loader && !options.skipLoader) {
        try {
          const data = await this.loadRouteData(newMatch, options.signal);
          // Store loaded data in match
          (newMatch as any).data = data;
        } catch (error) {
          console.error('Failed to load route data:', error);
          // Could redirect to error page or let the route handle it
        }
      }

      // Load lazy component if needed
      if (newMatch.metadata.lazy && !options.skipLazyLoad) {
        const component = await this.loadLazyRoute(newMatch);
        if (component) {
          (newMatch as any).component = component;
        }
      }

      // Navigation approved, update state
      this._currentMatch = newMatch as any;
      
      // Update browser URL if in browser environment
      if (typeof window !== 'undefined') {
        if (options.replace) {
          window.history.replaceState(options.state || {}, '', url);
        } else {
          window.history.pushState(options.state || {}, '', url);
          this.history.push(url);
          this.historyIndex = this.history.length - 1;
        }

        // Handle scrolling
        if (options.scroll !== false) {
          window.scrollTo(0, 0);
        }

        // Update document title if specified
        this.updateDocumentTitle(newMatch);
      }

      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      return false;
    } finally {
      this._isNavigating = false;
    }
  }

  /**
   * Update document title based on route metadata.
   */
  private updateDocumentTitle(match: EnhancedRouteMatch<keyof TRoutes & string, any>): void {
    if (typeof document === 'undefined') return;

    const { title } = match.metadata;
    if (title) {
      const titleText = typeof title === 'function' ? title(match.params) : title;
      document.title = titleText;
    }

    // Also handle SEO metadata
    const { seo } = match.metadata;
    if (seo) {
      this.updateSEOMetadata(seo, match.params);
    }
  }

  /**
   * Update SEO metadata in document head.
   */
  private updateSEOMetadata(seo: SEOConfig, params: any): void {
    if (typeof document === 'undefined') return;

    // Update meta description
    if (seo.description) {
      const description = typeof seo.description === 'function' ? seo.description(params) : seo.description;
      this.updateMetaTag('description', description);
    }

    // Update keywords
    if (seo.keywords) {
      this.updateMetaTag('keywords', seo.keywords.join(', '));
    }

    // Update canonical URL
    if (seo.canonical) {
      const canonical = typeof seo.canonical === 'function' ? seo.canonical(params) : seo.canonical;
      this.updateLinkTag('canonical', canonical);
    }

    // Update Open Graph image
    if (seo.ogImage) {
      const ogImage = typeof seo.ogImage === 'function' ? seo.ogImage(params) : seo.ogImage;
      this.updateMetaTag('og:image', ogImage, 'property');
    }
  }

  private updateMetaTag(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
    let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, name);
      document.head.appendChild(element);
    }
    element.content = content;
  }

  private updateLinkTag(rel: string, href: string): void {
    let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
    if (!element) {
      element = document.createElement('link');
      element.rel = rel;
      document.head.appendChild(element);
    }
    element.href = href;
  }
    const parsed = parseURL(input);
    const fullInput = this.buildFullInput(parsed);

    for (const [name, route] of Object.entries(this.config.routes)) {
      try {
        const params = route.parser.parse(fullInput, { consumeAll: false });
        return {
          name: name as keyof TRoutes & string,
          params,
          pathname: parsed.pathname,
          search: parsed.search,
          hash: parsed.hash
        };
      } catch (error) {
        // This route didn't match, try the next one
        continue;
      }
    }

    return null;
  }

  /**
   * Generate a URL for a specific route with type-safe parameters.
   */
  build<TName extends keyof TRoutes>(
    routeName: TName,
    params: InferParams<TRoutes[TName]>
  ): string {
    const route = this.config.routes[routeName];
    if (!route) {
      throw new Error(`Route '${String(routeName)}' not found`);
    }

    return this.generateURL(route, params);
  }

  /**
   * Get route information and hierarchy.
   */
  tree(): string {
    const lines: string[] = [];
    
    for (const [name, route] of Object.entries(this.config.routes)) {
      const pattern = this.routeToPattern(route);
      lines.push(`├─ ${name}: ${pattern}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if one route is an ancestor of another.
   */
  isAncestor(ancestor: Route<any>, descendant: Route<any>): boolean {
    if (ancestor.matchers.length >= descendant.matchers.length) {
      return false;
    }

    return ancestor.matchers.every((matcher, index) => 
      this.matchersEqual(matcher, descendant.matchers[index])
    );
  }

  /**
   * Get all routes that extend from a base route.
   */
  getChildren(baseRoute: Route<any>): Array<[string, Route<any>]> {
    return Object.entries(this.config.routes).filter(([, route]) => 
      this.isAncestor(baseRoute, route)
    );
  }

  /**
   * Get parameter names for a route.
   */
  getParams(route: Route<any>): string[] {
    return route.matchers
      .filter(m => m.paramName)
      .map(m => m.paramName!);
  }

  // Private helper methods

  private buildFullInput(parsed: ParsedURL): string {
    let input = '';
    
    if (parsed.subdomain) {
      input += parsed.subdomain;
    }
    
    input += parsed.pathname;
    
    if (parsed.search) {
      input += parsed.search;
    }
    
    if (parsed.hash) {
      input += parsed.hash;
    }

    return input;
  }

  private generateURL(route: Route<any>, params: any): string {
    let url = '';
    let hasSubdomain = false;
    
    for (const matcher of route.matchers) {
      switch (matcher.type) {
        case 'subdomain':
          url = (matcher.parser as any).run({ input: '', index: 0 }).value + '.' + url;
          hasSubdomain = true;
          break;
        case 'subdomainParam':
          if (matcher.paramName && params[matcher.paramName] !== undefined) {
            url = params[matcher.paramName] + '.' + url;
            hasSubdomain = true;
          }
          break;
        case 'path':
          url += '/' + (matcher.parser as any).run({ input: '', index: 0 }).value;
          break;
        case 'param':
          if (matcher.paramName && params[matcher.paramName] !== undefined) {
            url += '/' + encodeURIComponent(String(params[matcher.paramName]));
          }
          break;
        case 'query':
          // Handle query parameters in a separate pass
          break;
      }
    }

    // Add query parameters
    const queryParams: string[] = [];
    for (const matcher of route.matchers) {
      if (matcher.type === 'query' && matcher.paramName) {
        const value = params[matcher.paramName];
        if (value !== undefined) {
          queryParams.push(`${matcher.paramName}=${encodeURIComponent(String(value))}`);
        }
      }
    }

    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    // Add hash
    if (params.hash !== undefined) {
      url += '#' + encodeURIComponent(String(params.hash));
    }

    return url;
  }

  private routeToPattern(route: Route<any>): string {
    let pattern = '';
    
    for (const matcher of route.matchers) {
      switch (matcher.type) {
        case 'subdomain':
          pattern = (matcher.parser as any).run({ input: '', index: 0 }).value + '.' + pattern;
          break;
        case 'subdomainParam':
          pattern = `:${matcher.paramName}.` + pattern;
          break;
        case 'path':
          pattern += '/' + (matcher.parser as any).run({ input: '', index: 0 }).value;
          break;
        case 'param':
          pattern += `/:${matcher.paramName}`;
          break;
        case 'query':
          pattern += pattern.includes('?') ? '&' : '?';
          pattern += `${matcher.paramName}=:${matcher.paramName}`;
          break;
      }
    }

    return pattern || '/';
  }

  private matchersEqual(a: RouteMatcher, b: RouteMatcher): boolean {
    return a.type === b.type && a.paramName === b.paramName;
  }

  // =================================================================
  // Lifecycle Hooks
  // =================================================================

  /**
   * Register a global beforeLoad hook that runs before any route loads.
   */
  beforeLoad(hook: BeforeLoadHook): () => void;
  /**
   * Register a beforeLoad hook for a specific route.
   */
  beforeLoad<TName extends keyof TRoutes>(
    routeRef: Route<any> | TName, 
    hook: BeforeLoadHook<InferParams<TRoutes[TName]>>
  ): () => void;
  beforeLoad<TName extends keyof TRoutes>(
    routeRefOrHook: Route<any> | TName | BeforeLoadHook,
    hook?: BeforeLoadHook<InferParams<TRoutes[TName]>>
  ): () => void {
    if (typeof routeRefOrHook === 'function') {
      // Global hook
      this.globalBeforeLoadHooks.push(routeRefOrHook as BeforeLoadHook);
      return () => {
        const index = this.globalBeforeLoadHooks.indexOf(routeRefOrHook as BeforeLoadHook);
        if (index > -1) this.globalBeforeLoadHooks.splice(index, 1);
      };
    } else {
      // Route-specific hook
      if (!hook) throw new Error('Hook function required for route-specific beforeLoad');
      
      const routeName = this.getRouteName(routeRefOrHook);
      if (!this.routeBeforeLoadHooks.has(routeName)) {
        this.routeBeforeLoadHooks.set(routeName, []);
      }
      this.routeBeforeLoadHooks.get(routeName)!.push(hook);
      
      return () => {
        const hooks = this.routeBeforeLoadHooks.get(routeName);
        if (hooks) {
          const index = hooks.indexOf(hook);
          if (index > -1) hooks.splice(index, 1);
        }
      };
    }
  }

  /**
   * Register a global beforeLeave hook that runs before leaving any route.
   */
  beforeLeave(hook: BeforeLeaveHook): () => void;
  /**
   * Register a beforeLeave hook for a specific route.
   */
  beforeLeave<TName extends keyof TRoutes>(
    routeRef: Route<any> | TName,
    hook: BeforeLeaveHook<InferParams<TRoutes[TName]>>
  ): () => void;
  beforeLeave<TName extends keyof TRoutes>(
    routeRefOrHook: Route<any> | TName | BeforeLeaveHook,
    hook?: BeforeLeaveHook<InferParams<TRoutes[TName]>>
  ): () => void {
    if (typeof routeRefOrHook === 'function') {
      // Global hook
      this.globalBeforeLeaveHooks.push(routeRefOrHook as BeforeLeaveHook);
      return () => {
        const index = this.globalBeforeLeaveHooks.indexOf(routeRefOrHook as BeforeLeaveHook);
        if (index > -1) this.globalBeforeLeaveHooks.splice(index, 1);
      };
    } else {
      // Route-specific hook
      if (!hook) throw new Error('Hook function required for route-specific beforeLeave');
      
      const routeName = this.getRouteName(routeRefOrHook);
      if (!this.routeBeforeLeaveHooks.has(routeName)) {
        this.routeBeforeLeaveHooks.set(routeName, []);
      }
      this.routeBeforeLeaveHooks.get(routeName)!.push(hook);
      
      return () => {
        const hooks = this.routeBeforeLeaveHooks.get(routeName);
        if (hooks) {
          const index = hooks.indexOf(hook);
          if (index > -1) hooks.splice(index, 1);
        }
      };
    }
  }

  /**
   * Register a hook that runs when a redirect occurs.
   */
  onRedirect(hook: RedirectHook): () => void {
    this.redirectHooks.push(hook);
    return () => {
      const index = this.redirectHooks.indexOf(hook);
      if (index > -1) this.redirectHooks.splice(index, 1);
    };
  }

  // =================================================================
  // Navigation Methods
  // =================================================================

  /**
   * Navigate to a route with type-safe parameters.
   */
  async navigate<TName extends keyof TRoutes>(
    routeName: TName,
    params: InferParams<TRoutes[TName]>,
    options: NavigationOptions = {}
  ): Promise<boolean> {
    const url = this.build(routeName, params);
    return this.navigateToURL(url, options);
  }

  /**
   * Navigate to a URL string.
   */
  async navigateToURL(url: string, options: NavigationOptions = {}): Promise<boolean> {
    if (this._isNavigating) {
      console.warn('Navigation already in progress');
      return false;
    }

    const newMatch = this.match(url);
    if (!newMatch) {
      console.warn(`No route matched for URL: ${url}`);
      return false;
    }

    this._isNavigating = true;

    try {
      // Create navigation context
      const context: NavigationContext = {
        from: this._currentMatch,
        to: newMatch,
        params: newMatch.params,
        searchParams: new URLSearchParams(newMatch.search),
        url
      };

      // Run beforeLeave hooks for current route
      if (this._currentMatch) {
        const leaveResult = await this.runBeforeLeaveHooks(this._currentMatch, context);
        if (leaveResult === 'block') {
          return false;
        }
        if (leaveResult === 'redirect') {
          return true; // Redirect hook should handle the actual redirect
        }
      }

      // Run beforeLoad hooks for new route
      const loadResult = await this.runBeforeLoadHooks(newMatch, context);
      if (loadResult === 'block') {
        return false;
      }
      if (loadResult === 'redirect') {
        return true; // Redirect hook should handle the actual redirect
      }

      // Navigation approved, update state
      this._currentMatch = newMatch;
      
      // Update browser URL if in browser environment
      if (typeof window !== 'undefined') {
        if (options.replace) {
          window.history.replaceState(options.state || {}, '', url);
        } else {
          window.history.pushState(options.state || {}, '', url);
          this.history.push(url);
          this.historyIndex = this.history.length - 1;
        }

        // Handle scrolling
        if (options.scroll !== false) {
          window.scrollTo(0, 0);
        }
      }

      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      return false;
    } finally {
      this._isNavigating = false;
    }
  }

  /**
   * Go back in history.
   */
  async goBack(): Promise<boolean> {
    if (typeof window !== 'undefined') {
      window.history.back();
      return true;
    }
    
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const url = this.history[this.historyIndex];
      return this.navigateToURL(url, { replace: true });
    }
    
    return false;
  }

  /**
   * Go forward in history.
   */
  async goForward(): Promise<boolean> {
    if (typeof window !== 'undefined') {
      window.history.forward();
      return true;
    }
    
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const url = this.history[this.historyIndex];
      return this.navigateToURL(url, { replace: true });
    }
    
    return false;
  }

  /**
   * Redirect to another route, triggering redirect hooks.
   */
  async redirect<TName extends keyof TRoutes>(
    routeName: TName,
    params: InferParams<TRoutes[TName]>,
    options: NavigationOptions = {}
  ): Promise<boolean> {
    const fromUrl = this._currentMatch ? this.build(this._currentMatch.name, this._currentMatch.params) : '';
    const toUrl = this.build(routeName, params);
    
    // Trigger redirect hooks
    this.redirectHooks.forEach(hook => hook(fromUrl, toUrl));
    
    return this.navigate(routeName, params, { ...options, replace: true });
  }

  /**
   * Refresh the current route.
   */
  async refresh(): Promise<boolean> {
    if (!this._currentMatch) return false;
    
    const currentUrl = this.build(this._currentMatch.name, this._currentMatch.params);
    return this.navigateToURL(currentUrl, { replace: true });
  }

  // =================================================================
  // Private Helper Methods
  // =================================================================

  private async runBeforeLoadHooks(
    match: RouteMatch<keyof TRoutes & string, any>,
    context: NavigationContext
  ): Promise<NavigationResult> {
    // Run global hooks first
    for (const hook of this.globalBeforeLoadHooks) {
      const result = await hook(context);
      if (result === 'block' || result === 'redirect') {
        return result;
      }
    }

    // Run route-specific hooks
    const routeHooks = this.routeBeforeLoadHooks.get(match.name) || [];
    for (const hook of routeHooks) {
      const result = await hook(context);
      if (result === 'block' || result === 'redirect') {
        return result;
      }
    }

    return 'allow';
  }

  private async runBeforeLeaveHooks(
    match: RouteMatch<keyof TRoutes & string, any>,
    context: NavigationContext
  ): Promise<NavigationResult> {
    // Run route-specific hooks first
    const routeHooks = this.routeBeforeLeaveHooks.get(match.name) || [];
    for (const hook of routeHooks) {
      const result = await hook(context);
      if (result === 'block' || result === 'redirect') {
        return result;
      }
    }

    // Run global hooks
    for (const hook of this.globalBeforeLeaveHooks) {
      const result = await hook(context);
      if (result === 'block' || result === 'redirect') {
        return result;
      }
    }

    return 'allow';
  }

  private getRouteName(routeRef: Route<any> | string): string {
    if (typeof routeRef === 'string') {
      return routeRef;
    }

    // Find route name by reference
    for (const [name, route] of Object.entries(this.config.routes)) {
      if (route === routeRef) {
        return name;
      }
    }

    throw new Error('Route reference not found in router configuration');
  }

  private syncWithBrowser(): void {
    if (typeof window === 'undefined') return;
    
    const currentUrl = this.config.hashMode 
      ? window.location.hash.slice(1) || '/'
      : window.location.pathname + window.location.search + window.location.hash;
    
    const match = this.match(currentUrl);
    if (match) {
      this._currentMatch = match;
      this.history = [currentUrl];
      this.historyIndex = 0;
    }
  }

  private setupBrowserListeners(): void {
    if (typeof window === 'undefined') return;

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      const currentUrl = this.config.hashMode 
        ? window.location.hash.slice(1) || '/'
        : window.location.pathname + window.location.search + window.location.hash;
      
      this.navigateToURL(currentUrl, { replace: true, state: event.state });
    });

    // Handle hash changes if in hash mode
    if (this.config.hashMode) {
      window.addEventListener('hashchange', () => {
        const currentUrl = window.location.hash.slice(1) || '/';
        this.navigateToURL(currentUrl, { replace: true });
      });
    }
  }
}

/**
 * Create a router from a map of named routes.
 */
export function createRouter<TRoutes extends Record<string, Route<any>>>(
  routes: TRoutes,
  options: { baseURL?: string; hashMode?: boolean } = {}
): CombiRouter<TRoutes> {
  return new CombiRouter({ routes, ...options });
}

// =================================================================
// Route Variants and Advanced Composition
// =================================================================

/**
 * Create multiple variants of the same logical route.
 */
export function variants<T extends Record<string, Route<any>>>(
  routeVariants: T
): Route<{ variant: keyof T } & InferParams<T[keyof T]>> {
  // Use first variant as base, combine metadata from all variants
  const firstRoute = Object.values(routeVariants)[0];
  const combinedMetadata = Object.values(routeVariants).reduce(
    (acc, route) => ({ ...acc, ...route.metadata }),
    {}
  );
  
  return new Route(firstRoute.matchers, { ...combinedMetadata, variants: routeVariants }) as any;
}

/**
 * Combine multiple route fragments into one.
 */
export function combine<T extends Route<any>[]>(...routes: T): Route<UnionToIntersection<InferParams<T[number]>>> {
  const allMatchers = routes.flatMap(route => route.matchers);
  const combinedMetadata = routes.reduce(
    (acc, route) => ({ ...acc, ...route.metadata }),
    {}
  );
  
  return new Route(allMatchers, combinedMetadata) as any;
}

// =================================================================
// Template Literal Support
// =================================================================

/**
 * Create route matchers from a template string.
 */
export function template<T extends Record<string, z.ZodType<any>>>(
  pathTemplate: string,
  schemas: T
): RouteMatcher[] {
  const segments = pathTemplate.split('/').filter(Boolean);
  const matchers: RouteMatcher[] = [];

  for (const segment of segments) {
    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      const schema = schemas[paramName];
      if (!schema) {
        throw new Error(`No schema provided for parameter '${paramName}'`);
      }
      matchers.push(param(paramName, schema));
    } else {
      matchers.push(path(segment));
    }
  }

  return matchers;
}

// =================================================================
// Exports
// =================================================================

export {
  // Core types
  type RouteMatch,
  type EnhancedRouteMatch,
  type InferParams,
  Route,

  // Metadata types
  type RouteMetadata,
  type RouteLoader,
  type LoaderContext,
  type RouteComponent,
  type RouteLayout,
  type RouteLazy,
  type RouteGuard,
  type GuardContext,
  type RouteErrorBoundary,
  type PreloadStrategy,
  type CacheConfig,
  type SEOConfig,

  // Lifecycle types
  type NavigationResult,
  type NavigationContext,
  type BeforeLoadHook,
  type BeforeLeaveHook,
  type RedirectHook,
  type NavigationOptions,

  // Route building
  route,
  extend,
  combine,
  variants,
  template,

  // Higher-order route enhancers
  meta,
  loader,
  layout,
  lazy,
  guard,
  errorBoundary,
  cache,
  seo,
  preload,

  // Composition utilities
  pipe,
  withAuth,
  withAdmin,
  withApiData,

  // Matchers
  path,
  param,
  query,
  subdomain,
  hash,
  end,
  middleware,
  header,

  // Router
  CombiRouter,
  createRouter,

  // Utilities
  parseURL
};

// Default export
export default {
  route,
  extend,
  path,
  param,
  query,
  subdomain,
  hash,
  end,
  createRouter,
  template,
  variants,
  combine
};

// =================================================================
// Usage Example with Higher-Order Functions
// =================================================================

/*
// Complete functional composition example:

import { 
  route, extend, path, param, query, createRouter,
  meta, loader, layout, lazy, guard, cache, seo, pipe,
  withAuth, withApiData
} from 'combi-router';
import { z } from 'zod';

// Define base routes
const dashboardRoute = route(path('dashboard'));
const usersRoute = extend(dashboardRoute, path('users'));
const userRoute = extend(usersRoute, param('userId', z.number()));

// Functional composition with higher-order functions
const enhancedUserRoute = pipe(
  userRoute,
  meta({
    title: (params) => `User ${params.userId}`,
    description: 'User profile page'
  }),
  loader(async ({ params }) => {
    const user = await fetchUser(params.userId);
    return { user };
  }),
  layout(MainLayout, { showSidebar: true }),
  guard(async (context) => {
    const canViewUser = await checkUserPermission(context.params.userId);
    return canViewUser || '/unauthorized';
  }),
  cache({
    key: (params) => `user-${params.userId}`,
    ttl: 5 * 60 * 1000 // 5 minutes
  }),
  seo({
    title: (params) => `${params.user?.name || 'User'} - MyApp`,
    description: (params) => `Profile page for ${params.user?.name}`,
    canonical: (params) => `/users/${params.userId}`
  })
);

// Lazy-loaded admin route
const adminRoute = pipe(
  route(path('admin')),
  withAuth('/login'),
  guard(async (context) => {
    const isAdmin = await checkAdminRole(context);
    return isAdmin || '/unauthorized';
  }),
  lazy(() => import('./AdminPanel'), {
    preload: 'hover',
    fallback: { type: 'function', component: () => 'Loading admin...' }
  }),
  layout(AdminLayout),
  meta({ title: 'Admin Panel', requiresAdmin: true })
);

// API-driven route with caching
const productsRoute = pipe(
  route(path('products')),
  withApiData(
    async () => fetchProducts(),
    { ttl: 10 * 60 * 1000, staleWhileRevalidate: true }
  ),
  layout(ShopLayout),
  meta({
    title: 'Products',
    description: 'Browse our product catalog'
  })
);

// Create router with enhanced routes
const router = createRouter({
  DASHBOARD: dashboardRoute,
  USERS: usersRoute,
  USER: enhancedUserRoute,
  ADMIN: adminRoute,
  PRODUCTS: productsRoute
});

// Navigation with full lifecycle support
await router.navigate('USER', { userId: 123 });

// Access enhanced match data
const match = router.currentMatch;
if (match) {
  console.log('Route metadata:', match.metadata);
  console.log('Loaded data:', match.data);
  console.log('Layout component:', match.metadata.layout?.component);
}

// Reusable route enhancers
const withBreadcrumbs = (breadcrumbs: string[]) => 
  meta({ breadcrumbs });

const withErrorBoundary = (component: any) =>
  errorBoundary(component);

const blogPostRoute = pipe(
  route(path('blog'), param('slug', z.string())),
  withApiData(async ({ slug }) => fetchBlogPost(slug)),
  withBreadcrumbs(['Home', 'Blog', (params) => params.post?.title]),
  withErrorBoundary(BlogErrorBoundary),
  layout(BlogLayout),
  seo({
    title: (params) => params.post?.title,
    description: (params) => params.post?.excerpt,
    ogImage: (params) => params.post?.featuredImage
  })
);

// Function composition creates clean, reusable patterns
const createResourceRoute = (resource: string) => pipe(
  route(path(resource)),
  withAuth(),
  withApiData(async () => fetchResource(resource)),
  layout(ResourceLayout),
  meta({ title: resource.charAt(0).toUpperCase() + resource.slice(1) })
);

const ordersRoute = createResourceRoute('orders');
const invoicesRoute = createResourceRoute('invoices');
*/
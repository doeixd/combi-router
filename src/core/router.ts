// =================================================================
//
//      Combi-Router: CombiRouter Class and Navigation Logic
//
//      This module contains the main router class that manages state,
//      navigation, and lifecycle events.
//
// =================================================================

import type { Success } from "@doeixd/combi-parse";
import type {
  RouterOptions,
  RouteMatch,
  LoaderContext,
  ErrorContext,
  NavigationResult,
  NavigationError,
  NavigationErrorType,
  NavigationController,
  TransitionContext,
} from "./types";
import { Route } from "./route";
import { validateSafely } from "./validation";

// Import production features
import {
  ScrollRestorationManager,
  defaultScrollRestorationConfig,
} from "../features/scroll-restoration";
import {
  CodeSplittingManager,
  defaultCodeSplittingConfig,
} from "../features/code-splitting";
import {
  TransitionManager,
  defaultTransitionConfig,
} from "../features/transitions";
import {
  PerformanceManager,
  defaultPerformanceConfig,
} from "../features/performance";

// =================================================================
// -------------------- THE ROUTER CLASS --------------------------
// =================================================================

type Listener = (match: RouteMatch<any> | null) => void;

// Lifecycle hook types
type LifecycleHookType =
  | "onNavigationStart"
  | "onBeforeNavigationComplete"
  | "onNavigationComplete"
  | "onNavigationError";
type NavigationStartHook = (context: any) => Promise<void> | void;
type BeforeNavigationCompleteHook = (
  match: RouteMatch<any>,
  isPopState: boolean,
) => Promise<RouteMatch<any>> | RouteMatch<any>;
type NavigationCompleteHook = (
  match: RouteMatch<any>,
  isPopState: boolean,
) => Promise<void> | void;
type NavigationErrorHook = (error: any, context: any) => Promise<void> | void;

type LifecycleHook =
  | NavigationStartHook
  | BeforeNavigationCompleteHook
  | NavigationCompleteHook
  | NavigationErrorHook;

/**
 * The main router class that manages state, navigation, and lifecycle events.
 * It is instantiated via the `createRouter` factory function.
 */
export class CombiRouter {
  public currentMatch: RouteMatch<any> | null = null;
  public isNavigating = false;
  public isFetching = false;
  public isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  private readonly _allRoutes: Route<any>[];
  private readonly _options: RouterOptions;
  private readonly _dataCache = new Map<
    string,
    { data: any; expires: number }
  >();
  private readonly _listeners = new Set<Listener>();
  private readonly _lifecycleHooks = new Map<
    LifecycleHookType,
    Set<LifecycleHook>
  >();
  private _fallbackRoute: Route<any> | null = null;
  private _onError: (context: ErrorContext) => void = () => {};
  private _currentNavigation: NavigationController | null = null;
  private _devMode: any = null; // Development mode instance

  // Production feature managers
  private _scrollRestoration?: ScrollRestorationManager;
  private _codeSplitting?: CodeSplittingManager;
  private _transitions?: TransitionManager;
  private _performance?: PerformanceManager;

  constructor(routes: Route<any>[], options: RouterOptions) {
    this._allRoutes = [...routes];
    this._options = options;

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", (event) => {
        const url =
          event.state?.url || window.location.pathname + window.location.search;
        this._navigateToURL(url, true).catch((error) => {
          console.error("[CombiRouter] Popstate navigation failed:", error);
        });
      });
      window.addEventListener("online", () => (this.isOnline = true));
      window.addEventListener("offline", () => (this.isOnline = false));

      // Handle bfcache restoration
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
          // Page was restored from bfcache, re-run navigation to current URL
          const currentUrl =
            window.location.pathname +
            window.location.search +
            window.location.hash;
          this._navigateToURL(currentUrl, true).catch((error) => {
            console.error("[CombiRouter] Bfcache navigation failed:", error);
          });
        }
      });
    }

    // Initialize development mode if enabled
    this._initDevMode();

    // Initialize production features
    this._initProductionFeatures();
  }

  get routes(): readonly Route<any>[] {
    return this._allRoutes;
  }
  public getRouteTree(): string {
    return this._allRoutes
      .map(
        (route) =>
          this.build(route, {})?.split("?")[0] ||
          `[Dynamic: ${route.name || route.id}]`,
      )
      .sort()
      .join("\n");
  }
  public subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    listener(this.currentMatch);
    return () => this._listeners.delete(listener);
  }
  public fallback(route: Route<any>) {
    this._fallbackRoute = route;
  }
  public onError(handler: (context: ErrorContext) => void) {
    this._onError = handler;
  }

  /** Get the current navigation controller if navigation is in progress */
  get currentNavigation(): NavigationController | null {
    return this._currentNavigation;
  }

  /**
   * Cancel the current navigation if one is in progress
   * @returns true if a navigation was cancelled, false if none was in progress
   */
  public cancelNavigation(): boolean {
    if (this._currentNavigation && !this._currentNavigation.cancelled) {
      this._currentNavigation.cancel();
      return true;
    }
    return false;
  }

  /**
   * Dynamically adds a new route to the router.
   * @param route The route to add.
   * @returns True if successfully added, false if route already exists.
   */
  public addRoute(route: Route<any>): boolean {
    if (this._allRoutes.some((r) => r.id === route.id)) {
      return false; // Route already exists
    }
    this._allRoutes.push(route);
    return true;
  }

  /**
   * Dynamically removes a route from the router.
   * @param route The route to remove.
   * @returns True if successfully removed, false if route was not found.
   */
  public removeRoute(route: Route<any>): boolean {
    const index = this._allRoutes.findIndex((r) => r.id === route.id);
    if (index === -1) {
      return false; // Route not found
    }
    this._allRoutes.splice(index, 1);

    // If we're currently on this route, navigate to fallback or root
    if (
      this.currentMatch &&
      this._isRouteInMatchTree(this.currentMatch, route)
    ) {
      if (this._fallbackRoute) {
        this.navigate(this._fallbackRoute, {}).catch((error) => {
          console.error("[CombiRouter] Fallback navigation failed:", error);
        });
      } else {
        // Navigate to root or first available route
        const firstRoute = this._allRoutes[0];
        if (firstRoute) {
          this.navigate(firstRoute, {}).catch((error) => {
            console.error(
              "[CombiRouter] First route navigation failed:",
              error,
            );
          });
        }
      }
    }

    return true;
  }

  /**
   * Checks if a route is present in the current match tree.
   * @private
   */
  private _isRouteInMatchTree(
    match: RouteMatch<any>,
    route: Route<any>,
  ): boolean {
    let current: RouteMatch<any> | undefined = match;
    while (current) {
      if (current.route.id === route.id) {
        return true;
      }
      current = current.child;
    }
    return false;
  }

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
    let pathname = "";
    const query: string[] = [];
    for (const matcher of route.matchers) {
      const builtPart = matcher.build(params as any);
      if (
        builtPart === null &&
        !["optionalPath", "query", "end"].includes(matcher.type)
      )
        return null;
      if (matcher.type === "query") {
        if (builtPart) query.push(builtPart);
      } else {
        pathname += builtPart;
      }
    }
    return (pathname || "/") + (query.length > 0 ? `?${query.join("&")}` : "");
  }

  /**
   * Navigates to a route using its type-safe reference with full result information.
   * This is the primary and recommended method for navigation.
   * @param route The `Route` object to navigate to.
   * @param params The parameters for the route, matching its definition.
   * @returns A promise that resolves to a NavigationResult with detailed information.
   * @example
   * const result = await router.navigate(userRoute, { id: 456 });
   * if (result.success) {
   *   console.log('Navigation successful');
   * } else {
   *   console.error('Navigation failed:', result.error);
   * }
   */
  public async navigate<TParams>(
    route: Route<TParams>,
    params: TParams,
  ): Promise<NavigationResult> {
    // Cancel any existing navigation
    this.cancelNavigation();

    const url = this.build(route, params);
    if (url === null) {
      const error: NavigationError = {
        type: "validation-failed" as NavigationErrorType,
        message: "Failed to build URL. A required parameter may be missing.",
        route,
        params,
      };
      return { success: false, error };
    }

    // Create navigation controller
    const abortController = new AbortController();
    let cancelled = false;

    const promise = this._navigateToURL(url, false, abortController.signal);

    const controller: NavigationController = {
      route,
      params,
      promise,
      cancel: () => {
        cancelled = true;
        abortController.abort();
      },
      get cancelled() {
        return cancelled;
      },
    };

    this._currentNavigation = controller;

    try {
      const result = await promise;
      return result;
    } finally {
      if (this._currentNavigation === controller) {
        this._currentNavigation = null;
      }
    }
  }

  /**
   * Simple navigation method that returns a boolean for backward compatibility.
   * @param route The `Route` object to navigate to.
   * @param params The parameters for the route, matching its definition.
   * @returns A promise that resolves to `true` if navigation was successful.
   * @example
   * const success = await router.navigateSimple(userRoute, { id: 456 });
   */
  public async navigateSimple<TParams>(
    route: Route<TParams>,
    params: TParams,
  ): Promise<boolean> {
    const result = await this.navigate(route, params);
    return result.success;
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
  public async peek<TParams>(
    route: Route<TParams>,
    params: TParams,
  ): Promise<void> {
    if (route.metadata.lazy) await route.metadata.lazy.import();
    if (route.metadata.loader) {
      const url = this.build(route, params);
      if (!url) return;
      const cacheKey = route.metadata.cache?.key
        ? route.metadata.cache.key(params)
        : url;
      if (this._dataCache.has(cacheKey)) return;
      try {
        const data = await this._loadDataForRoute(
          route,
          { params } as any,
          new AbortController().signal,
        );
        if (route.metadata.cache && cacheKey) {
          this._dataCache.set(cacheKey, {
            data,
            expires: Date.now() + route.metadata.cache.ttl,
          });
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
    const parsedUrl = new URL(url, this._options.baseURL || "http://localhost");

    // Find all routes that can match the full URL
    const allMatches: {
      route: Route<any>;
      result: Success<any>;
      pathLength: number;
    }[] = [];

    for (const route of this._allRoutes) {
      const result = route.parser.run({ input: parsedUrl.pathname, index: 0 });
      if (result.type === "success") {
        const remainingPath = result.state.input.slice(result.state.index);

        // Consider both complete matches and partial matches (for parent routes)
        const isCompleteMatch =
          remainingPath === "" ||
          remainingPath.startsWith("?") ||
          remainingPath.startsWith("#");
        const isPartialMatch =
          remainingPath.length > 0 && remainingPath.startsWith("/");

        if (isCompleteMatch || isPartialMatch) {
          allMatches.push({ route, result, pathLength: result.state.index });
        }
      }
    }

    if (allMatches.length === 0) return null;

    // Sort matches by path length (shortest first = most parent-like)
    allMatches.sort((a, b) => a.pathLength - b.pathLength);

    // Take the shortest match as the parent
    const parentMatch = allMatches[0];
    const { pathParams: parentPathParams, queryParams } = this._processParams(
      parentMatch.result,
      parsedUrl,
    );
    const parentAllParams = { ...parentPathParams, ...queryParams };

    // Look for a child match among longer matches
    let childMatch: RouteMatch<any> | undefined = undefined;

    for (const match of allMatches.slice(1)) {
      // Check if this route could be a child (extends the parent path)
      if (match.pathLength > parentMatch.pathLength) {
        const { pathParams: childPathParams, queryParams: childQueryParams } =
          this._processParams(match.result, parsedUrl);
        const childAllParams = { ...childPathParams, ...childQueryParams };

        childMatch = {
          route: match.route,
          params: childAllParams,
          pathname: parsedUrl.pathname,
          search: parsedUrl.search,
          hash: parsedUrl.hash,
        };
        break; // Take the first child found
      }
    }

    const parentPathname =
      parsedUrl.pathname.substring(0, parentMatch.pathLength) || "/";

    return {
      route: parentMatch.route,
      params: parentAllParams,
      pathname: parentPathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash,
      child: childMatch,
    };
  }

  /**
   * The core navigation logic that handles the entire lifecycle.
   * @internal
   */
  private async _navigateToURL(
    url: string,
    isPopState = false,
    signal?: AbortSignal,
  ): Promise<NavigationResult> {
    if (this.isNavigating) {
      return {
        success: false,
        error: {
          type: "unknown" as NavigationErrorType,
          message: "Navigation already in progress",
        },
      };
    }

    this.isNavigating = true;
    const navAbortController = new AbortController();

    // Connect external signal to internal abort controller
    if (signal) {
      signal.addEventListener("abort", () => navAbortController.abort());
    }

    // Start performance timing
    this._performance?.startNavigationTiming();

    // 1. Match URL: Find the route configuration that matches the given URL.
    let newMatch = this.match(url);
    if (!newMatch) {
      if (this._fallbackRoute) {
        newMatch = {
          route: this._fallbackRoute,
          params: {},
          pathname: url,
          search: "",
          hash: "",
        };
      } else {
        this.isNavigating = false;
        return {
          success: false,
          error: {
            type: "route-not-found" as NavigationErrorType,
            message: `No route found for "${url}" and no fallback is configured.`,
          },
        };
      }
    }

    try {
      // Check for cancellation
      if (navAbortController.signal.aborted) {
        this.isNavigating = false;
        return {
          success: false,
          cancelled: true,
          error: {
            type: "cancelled" as NavigationErrorType,
            message: "Navigation was cancelled",
          },
        };
      }

      // Execute navigation start hooks
      await this._executeLifecycleHooks("onNavigationStart", {
        from: this.currentMatch,
        to: newMatch,
        isPopState,
      });

      // Notify scroll restoration of navigation start
      this._scrollRestoration?.onNavigationStart(this.currentMatch, newMatch);

      // 2. Guards: Run pre-navigation checks.
      if (newMatch.route.metadata.guards) {
        for (const guard of newMatch.route.metadata.guards) {
          const result = await guard({ to: newMatch, from: this.currentMatch });
          if (result === false) {
            this.isNavigating = false;
            return {
              success: false,
              error: {
                type: "guard-rejected" as NavigationErrorType,
                message: "Route guard rejected navigation",
                route: newMatch.route,
                params: newMatch.params,
              },
            };
          }
          if (typeof result === "string") {
            this.isNavigating = false;
            return this._navigateToURL(result, false, signal);
          }
        }
      }

      // 3. Data Loading: Execute before navigation complete hooks (includes loader execution)
      this.isFetching = true;
      try {
        newMatch = await this._executeLifecycleHooks(
          "onBeforeNavigationComplete",
          newMatch,
          isPopState,
        );
      } finally {
        this.isFetching = false;
      }

      // Check for cancellation after data loading
      if (navAbortController.signal.aborted) {
        this.isNavigating = false;
        return {
          success: false,
          cancelled: true,
          error: {
            type: "cancelled" as NavigationErrorType,
            message: "Navigation was cancelled during data loading",
          },
        };
      }

      // 4. Transitions: Execute page transitions
      if (this._transitions) {
        const transitionContext: TransitionContext = {
          from: this.currentMatch,
          to: newMatch,
          direction: this._transitions.getTransitionDirection(
            this.currentMatch,
            newMatch,
          ),
          isInitial: this.currentMatch === null,
        };

        await this._transitions.executeTransition(transitionContext);
      }

      // 5. DOM Update: Use View Transitions API if available for smooth animations.
      const updateDOM = () => {
        this.currentMatch = newMatch;
        this._notifyListeners();
      };
      if (
        typeof (document as any).startViewTransition === "function" &&
        !this._transitions
      ) {
        await (document as any).startViewTransition(updateDOM).ready;
      } else {
        updateDOM();
      }

      // 6. History: Update browser history after a successful navigation.
      if (typeof window !== "undefined" && !isPopState) {
        window.history.pushState(
          { url },
          "",
          this._options.hashMode ? `#${url}` : url,
        );
      }

      // 7. Complete navigation lifecycle
      await this._executeLifecycleHooks(
        "onNavigationComplete",
        newMatch,
        isPopState,
      );
      this._scrollRestoration?.onNavigationComplete(newMatch, isPopState);
      this._performance?.endNavigationTiming(newMatch.route);

      this.isNavigating = false;
      return { success: true, match: newMatch };
    } catch (error) {
      this.isNavigating = false;
      this.isFetching = false;

      if (navAbortController.signal.aborted) {
        return {
          success: false,
          cancelled: true,
          error: {
            type: "cancelled" as NavigationErrorType,
            message: "Navigation was cancelled",
          },
        };
      }

      navAbortController.abort();

      const navigationError: NavigationError = {
        type:
          (error as any)?.name === "AbortError"
            ? ("cancelled" as NavigationErrorType)
            : ("loader-failed" as NavigationErrorType),
        message: (error as any)?.message || "Navigation failed",
        originalError: error,
        route: newMatch?.route,
        params: newMatch?.params,
      };

      // Execute navigation error hooks
      await this._executeLifecycleHooks("onNavigationError", error, {
        to: newMatch,
        from: this.currentMatch,
      });

      this._onError({ error, to: newMatch, from: this.currentMatch });

      return { success: false, error: navigationError };
    }
  }

  private _processParams(
    result: Success<{ path: object; query: any[] }>,
    url: URL,
  ) {
    const pathParams = result.value.path;
    const queryParams: Record<string, any> = {};

    // Enhanced query parameter processing with better error handling
    for (const q of result.value.query) {
      const value = url.searchParams.get(q.name);
      // For query params, null from searchParams.get means the param is not present.
      // StandardSchema will typically expect `undefined` for optional values not present.
      const valueToParse = value === null ? undefined : value;

      // Use enhanced validation with better error context
      const validationResult = validateSafely(
        q.schema,
        valueToParse,
        `Query parameter "${q.name}"`,
      );

      if (!validationResult.success) {
        throw new Error(validationResult.error!);
      }

      // Only assign if the value is not undefined, to keep params clean for truly optional fields
      // that might not be present in the output if they were undefined.
      if (validationResult.value !== undefined) {
        queryParams[q.name] = validationResult.value;
      }
    }

    return { pathParams, queryParams };
  }

  // Unused method - kept for potential future use
  // @ts-ignore
  private async __loadDataForMatchTree(
    match: RouteMatch,
    signal: AbortSignal,
  ): Promise<void> {
    const loaders: Promise<void>[] = [];
    let current: RouteMatch | undefined = match;
    while (current) {
      if (current.route.metadata.loader) {
        const finalCurrent = current;
        loaders.push(
          this._loadDataForRoute(finalCurrent.route, finalCurrent, signal).then(
            (data) => {
              finalCurrent.data = data;
            },
          ),
        );
      }
      current = current.child;
    }
    await Promise.all(loaders);
  }

  private async _loadDataForRoute(
    route: Route<any>,
    matchContext: { params: any; search?: string },
    signal: AbortSignal,
  ): Promise<any> {
    // Load lazy component if needed
    if (route.metadata.lazy && this._codeSplitting) {
      await this._codeSplitting.loadChunk(String(route.id));
    }

    const cacheConfig = route.metadata.cache;
    if (cacheConfig) {
      const cacheKey = cacheConfig.key
        ? cacheConfig.key(matchContext.params)
        : this.build(route, matchContext.params);
      const cached = cacheKey ? this._dataCache.get(cacheKey) : undefined;
      if (cached && cached.expires > Date.now()) return cached.data;
    }
    const loaderContext: LoaderContext = {
      params: matchContext.params,
      searchParams: new URLSearchParams(matchContext.search || ""),
      signal,
    };
    return await route.metadata.loader!(loaderContext);
  }

  private _notifyListeners() {
    for (const listener of this._listeners) {
      listener(this.currentMatch);
    }
  }

  private _initProductionFeatures(): void {
    const features = this._options.features;
    if (!features) return;

    // Initialize scroll restoration
    if (features.scrollRestoration) {
      this._scrollRestoration = new ScrollRestorationManager({
        ...defaultScrollRestorationConfig,
        ...features.scrollRestoration,
      });
    }

    // Initialize code splitting
    if (features.codeSplitting) {
      this._codeSplitting = new CodeSplittingManager({
        ...defaultCodeSplittingConfig,
        ...features.codeSplitting,
      });

      // Register all routes with lazy loading
      this._allRoutes.forEach((route) => {
        if (route.metadata.lazy) {
          this._codeSplitting!.registerRoute(route);
        }
      });
    }

    // Initialize transitions
    if (features.transitions) {
      this._transitions = new TransitionManager({
        ...defaultTransitionConfig,
        ...features.transitions,
      });
    }

    // Initialize performance optimizations
    if (features.performance) {
      this._performance = new PerformanceManager({
        ...defaultPerformanceConfig,
        ...features.performance,
      });
    }
  }

  private _initDevMode(): void {
    // Only initialize dev mode in development environment
    if (process.env.NODE_ENV === "production") return;

    try {
      // Dynamically import dev mode to avoid including it in production builds
      // This import will be tree-shaken out in production
      if (process.env.NODE_ENV !== "production") {
        import("../dev/index")
          .then(({ enableDevMode }) => {
            this._devMode = enableDevMode(this, {
              autoAnalyze: false, // Don't auto-analyze to avoid startup noise
              warnings: true,
              conflictDetection: true,
              performanceMonitoring: true,
              debugMode: true,
            });

            // Expose dev tools to window for debugging
            if (typeof window !== "undefined") {
              import("../dev/index").then(({ exposeDevTools }) => {
                exposeDevTools(this, this._devMode);
              });
            }
          })
          .catch(() => {
            // Silently fail if dev module is not available
          });
      }
    } catch (error) {
      // Silently fail in case dev modules are not available
    }
  }

  /**
   * Get development mode instance if available
   */
  get devMode(): any {
    return this._devMode;
  }

  /**
   * Enable development mode analysis
   */
  public enableDevAnalysis(): void {
    if (this._devMode) {
      this._devMode.runAnalysis();
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[CombiRouter] Development mode not initialized. Try calling this after router creation.",
      );
    }
  }

  /**
   * Log development report
   */
  public logDevReport(): void {
    if (this._devMode) {
      this._devMode.logDevReport();
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("[CombiRouter] Development mode not available.");
    }
  }

  // =================================================================
  // --------------- PRODUCTION FEATURES ACCESS ---------------------
  // =================================================================

  /**
   * Get scroll restoration manager
   */
  get scrollRestoration(): ScrollRestorationManager | undefined {
    return this._scrollRestoration;
  }

  /**
   * Get code splitting manager
   */
  get codeSplitting(): CodeSplittingManager | undefined {
    return this._codeSplitting;
  }

  /**
   * Get transition manager
   */
  get transitions(): TransitionManager | undefined {
    return this._transitions;
  }

  /**
   * Get performance manager
   */
  get performance(): PerformanceManager | undefined {
    return this._performance;
  }

  /**
   * Setup hover prefetching for an element
   */
  public setupHoverPrefetch(element: Element, route: Route<any>): () => void {
    if (this._performance) {
      return this._performance.setupHoverPrefetch(element, String(route.id));
    }
    if (this._codeSplitting) {
      return this._codeSplitting.setupHoverPreloading(
        element,
        String(route.id),
      );
    }
    return () => {};
  }

  /**
   * Setup viewport prefetching for an element
   */
  public setupViewportPrefetch(
    element: Element,
    route: Route<any>,
  ): () => void {
    if (this._performance) {
      return this._performance.setupViewportPrefetch(element, String(route.id));
    }
    if (this._codeSplitting) {
      return this._codeSplitting.setupVisibilityPreloading(
        element,
        String(route.id),
      );
    }
    return () => {};
  }

  /**
   * Manually save scroll position
   */
  public saveScrollPosition(key?: string): void {
    if (this._scrollRestoration) {
      if (key) {
        this._scrollRestoration.manualSave(key);
      } else {
        this._scrollRestoration.saveCurrentPosition();
      }
    }
  }

  /**
   * Manually restore scroll position
   */
  public restoreScrollPosition(key: string): boolean {
    return this._scrollRestoration?.manualRestore(key) || false;
  }

  /**
   * Get performance report
   */
  public getPerformanceReport() {
    return this._performance?.getPerformanceReport();
  }

  /**
   * Cleanup production features on destroy
   */
  public destroy(): void {
    this._scrollRestoration?.destroy?.();
    this._codeSplitting?.destroy?.();
    this._transitions?.destroy?.();
    this._performance?.destroy?.();
  }

  /**
   * Register a lifecycle hook handler.
   * @internal Used by layers to hook into navigation lifecycle.
   */
  public _registerLifecycleHook(
    hookType: LifecycleHookType,
    handler: LifecycleHook,
  ): () => void {
    if (!this._lifecycleHooks.has(hookType)) {
      this._lifecycleHooks.set(hookType, new Set());
    }

    const hooks = this._lifecycleHooks.get(hookType)!;
    hooks.add(handler);

    // Return unsubscribe function
    return () => {
      hooks.delete(handler);
      if (hooks.size === 0) {
        this._lifecycleHooks.delete(hookType);
      }
    };
  }

  /**
   * Execute all registered lifecycle hooks of a given type.
   * @internal
   */
  private async _executeLifecycleHooks(
    hookType: "onNavigationStart",
    context: any,
  ): Promise<void>;
  private async _executeLifecycleHooks(
    hookType: "onBeforeNavigationComplete",
    match: RouteMatch<any>,
    isPopState: boolean,
  ): Promise<RouteMatch<any>>;
  private async _executeLifecycleHooks(
    hookType: "onNavigationComplete",
    match: RouteMatch<any>,
    isPopState: boolean,
  ): Promise<void>;
  private async _executeLifecycleHooks(
    hookType: "onNavigationError",
    error: any,
    context: any,
  ): Promise<void>;
  private async _executeLifecycleHooks(
    hookType: LifecycleHookType,
    ...args: any[]
  ): Promise<any> {
    const hooks = this._lifecycleHooks.get(hookType);
    if (!hooks || hooks.size === 0) {
      // For onBeforeNavigationComplete, return the match unchanged if no hooks
      if (hookType === "onBeforeNavigationComplete") {
        return args[0]; // Return the match
      }
      return;
    }

    const hookArray = Array.from(hooks);

    if (hookType === "onBeforeNavigationComplete") {
      // For onBeforeNavigationComplete, execute hooks sequentially and pass results through
      let currentMatch = args[0];
      for (const hook of hookArray) {
        try {
          const result = await (hook as BeforeNavigationCompleteHook)(
            currentMatch,
            args[1],
          );
          if (result) {
            currentMatch = result;
          }
        } catch (error) {
          console.error(`[CombiRouter] Error in ${hookType} hook:`, error);
          throw error;
        }
      }
      return currentMatch;
    } else {
      // For other hooks, execute in parallel
      const promises = hookArray.map(async (hook) => {
        try {
          return await (hook as any)(...args);
        } catch (error) {
          console.error(`[CombiRouter] Error in ${hookType} hook:`, error);
          // Don't rethrow for non-critical hooks to avoid breaking navigation
          if (hookType !== "onNavigationError") {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }
  }
}

export function createRouter(
  routes: Route<any>[],
  options: RouterOptions = {},
): CombiRouter {
  return new CombiRouter(routes, options);
}

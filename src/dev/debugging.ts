// =================================================================
//
//      Combi-Router: Enhanced Debugging Utilities and Introspection
//
//      This module contains comprehensive debugging and introspection
//      utilities for development, including route analysis, navigation
//      tracing, and interactive debugging tools.
//
// =================================================================

import type { Route, RouteMatch } from "../core/types";
import type { CombiRouter } from "../core/router";

// =================================================================
// ---------------- DEBUGGING UTILITIES ---------------------------
// =================================================================

/**
 * Creates a detailed string representation of a route for debugging.
 * @param route The route to inspect
 * @returns A formatted string with route details
 */
export function inspectRoute(route: Route<any>): string {
  const parts: string[] = [];

  parts.push(`Route #${route.id}`);
  if (route.name) parts.push(`(${route.name})`);
  parts.push(`- Depth: ${route.depth}`);
  parts.push(`- Static path: ${route.staticPath}`);
  parts.push(`- Parameters: [${route.paramNames.join(", ")}]`);
  parts.push(`- Dynamic: ${route.isDynamic}`);
  parts.push(`- Has query: ${route.hasQuery}`);

  if (route.metadata.loader) parts.push("- Has loader");
  if (route.metadata.guards?.length)
    parts.push(`- Guards: ${route.metadata.guards.length}`);
  if (route.metadata.cache) parts.push("- Has cache config");
  if (route.metadata.lazy) parts.push("- Lazy loaded");

  parts.push(
    `- Matchers: ${route.matchers.map((m: any) => m.type).join(" → ")}`,
  );

  return parts.join("\n");
}

/**
 * Creates a detailed string representation of a route match for debugging.
 * @param match The route match to inspect
 * @returns A formatted string with match details
 */
export function inspectMatch(match: RouteMatch<any>): string {
  const parts: string[] = [];

  parts.push(`Match for Route #${match.route.id}`);
  parts.push(`- Pathname: ${match.pathname}`);
  parts.push(`- Search: ${match.search}`);
  parts.push(`- Hash: ${match.hash}`);
  parts.push(`- Params: ${JSON.stringify(match.params, null, 2)}`);

  if (match.data) {
    parts.push(
      `- Data: ${typeof match.data === "object" ? JSON.stringify(match.data, null, 2) : match.data}`,
    );
  }

  if (match.child) {
    parts.push("- Has child match");
  }

  return parts.join("\n");
}

/**
 * Creates a tree view of all routes for debugging.
 * @param routes Array of routes to visualize
 * @returns A formatted tree string
 */
export function visualizeRouteTree(routes: Route<any>[]): string {
  const lines: string[] = [];

  // Group routes by parent relationships
  const rootRoutes = routes.filter((r) => !r.parent);
  const childRoutes = routes.filter((r) => r.parent);

  const addRoute = (route: Route<any>, indent = 0): void => {
    const prefix = "  ".repeat(indent);
    const name = route.name || `Route #${route.id}`;
    const path = route.staticPath;
    const params =
      route.paramNames.length > 0 ? ` (${route.paramNames.join(", ")})` : "";

    lines.push(`${prefix}├─ ${name}: ${path}${params}`);

    // Find and add children
    const children = childRoutes.filter((c) => c.parent?.id === route.id);
    children.forEach((child) => addRoute(child, indent + 1));
  };

  lines.push("Route Tree:");
  rootRoutes.forEach((route) => addRoute(route));

  return lines.join("\n");
}

/**
 * Logs detailed information about the current router state.
 * @param router The router instance to inspect
 */
export function debugRouter(router: CombiRouter): void {
  if (process.env.NODE_ENV === "production") return;

  console.group("[CombiRouter] Debug Info");

  console.log(
    "Current match:",
    router.currentMatch ? inspectMatch(router.currentMatch) : "None",
  );
  console.log("Is navigating:", router.isNavigating);
  console.log("Is fetching:", router.isFetching);
  console.log("Is online:", router.isOnline);
  console.log("Total routes:", router.routes.length);

  if (router.currentNavigation) {
    console.log("Current navigation:", {
      route: router.currentNavigation.route.id,
      params: router.currentNavigation.params,
      cancelled: router.currentNavigation.cancelled,
    });
  }

  console.log("\n" + visualizeRouteTree([...router.routes]));

  console.groupEnd();
}

/**
 * Creates a performance monitor for navigation timing.
 * @param router The router instance to monitor
 * @returns A function to stop monitoring
 */
export function monitorNavigation(router: CombiRouter): () => void {
  if (process.env.NODE_ENV === "production") return () => {};

  let startTime: number;

  const unsubscribe = router.subscribe((match) => {
    if (router.isNavigating && !startTime) {
      startTime = performance.now();
      console.log("[CombiRouter] Navigation started");
    } else if (!router.isNavigating && startTime) {
      const duration = performance.now() - startTime;
      console.log(
        `[CombiRouter] Navigation completed in ${duration.toFixed(2)}ms`,
      );
      if (match) {
        console.log(`[CombiRouter] Navigated to:`, inspectMatch(match));
      }
      startTime = 0;
    }
  });

  return unsubscribe;
}

// =================================================================
// ---------------- ENHANCED DEBUGGING INTERFACES ----------------
// =================================================================

export interface RouteAnalysis {
  route: Route<any>;
  staticPath: string;
  dynamicSegments: string[];
  depth: number;
  complexity: number;
  dependencies: string[];
  potentialIssues: string[];
  optimizations: string[];
}

export interface NavigationTrace {
  url: string;
  timestamp: number;
  steps: NavigationStep[];
  result: "success" | "failure" | "cancelled";
  duration: number;
  error?: any;
}

export interface NavigationStep {
  type: "match" | "guard" | "loader" | "render";
  routeId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  result?: any;
  error?: any;
}

export interface MatchInspection {
  route: Route<any>;
  params: Record<string, any>;
  searchParams: URLSearchParams;
  ancestry: Route<any>[];
  dataFlow: any;
  cachingInfo: any;
  guardResults: any[];
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  routes: {
    [routeId: string]: {
      valid: boolean;
      issues: string[];
    };
  };
}

export interface Optimization {
  type: "caching" | "guards" | "loaders" | "structure";
  priority: "high" | "medium" | "low";
  description: string;
  route?: Route<any>;
  implementation: string;
  impact: string;
}

// =================================================================
// ---------------- ENHANCED ROUTER DEBUGGER ---------------------
// =================================================================

export class RouterDebugger {
  private router: CombiRouter;
  private navigationTraces: NavigationTrace[] = [];
  private isTracing = false;

  constructor(router: CombiRouter) {
    this.router = router;
  }

  // =================================================================
  // ---------------- ROUTE ANALYSIS METHODS -----------------------
  // =================================================================

  private getRoutes(): any[] {
    // Handle both CombiRouter (routes as array) and layered router (routes as getter)
    if (typeof this.router.routes === "function") {
      // For layered routers, routes are not directly accessible
      // Return empty array to avoid errors - layered routers handle their own validation
      return [];
    }
    return [...(this.router.routes || [])];
  }

  public analyzeRoutes(): RouteAnalysis[] {
    return this.getRoutes().map((route) => this.analyzeRoute(route));
  }

  public analyzeRoute(route: Route<any>): RouteAnalysis {
    const dynamicSegments = route.paramNames;

    return {
      route,
      staticPath: route.staticPath,
      dynamicSegments,
      depth: route.depth,
      complexity: this.calculateComplexity(route),
      dependencies: this.findDependencies(route),
      potentialIssues: this.identifyIssues(route),
      optimizations: this.suggestRouteOptimizations(route),
    };
  }

  private calculateComplexity(route: Route<any>): number {
    let score = 0;

    // Base complexity from depth
    score += route.depth * 2;

    // Parameter complexity
    score += route.paramNames.length * 3;

    // Guard complexity
    if (route.metadata.guards) {
      score += route.metadata.guards.length * 5;
    }

    // Loader complexity
    if (route.metadata.loader) {
      score += 10;
    }

    // Cache complexity (reduces score)
    if (route.metadata.cache) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  private findDependencies(route: Route<any>): string[] {
    const deps: string[] = [];

    // Parent dependencies
    if (route.parent) {
      deps.push(`parent:${route.parent.id}`);
    }

    // Layout dependencies
    if (route.metadata.layout) {
      deps.push("layout:component");
    }

    // Lazy loading dependencies
    if (route.metadata.lazy) {
      deps.push("lazy:import");
    }

    return deps;
  }

  private identifyIssues(route: Route<any>): string[] {
    const issues: string[] = [];

    // Performance issues
    if (this.calculateComplexity(route) > 30) {
      issues.push("High complexity route");
    }

    if (route.paramNames.length > 4) {
      issues.push("Too many parameters");
    }

    if (route.depth > 5) {
      issues.push("Deeply nested route");
    }

    // Configuration issues
    if (route.metadata.loader && !route.metadata.cache) {
      issues.push("Loader without caching");
    }

    if (route.metadata.guards && route.metadata.guards.length > 3) {
      issues.push("Too many guards");
    }

    return issues;
  }

  private suggestRouteOptimizations(route: Route<any>): string[] {
    const optimizations: string[] = [];

    if (route.metadata.loader && !route.metadata.cache) {
      optimizations.push("Add caching to loader");
    }

    if (route.paramNames.length > 2) {
      optimizations.push("Consider using query parameters");
    }

    if (route.depth > 3 && !route.metadata.lazy) {
      optimizations.push("Consider lazy loading");
    }

    return optimizations;
  }

  // =================================================================
  // ---------------- NAVIGATION TRACING ---------------------------
  // =================================================================

  public startTracing(): void {
    if (this.isTracing) return;

    this.isTracing = true;
    this.router.subscribe(() => {
      if (this.isTracing) {
        this.captureNavigationTrace();
      }
    });
  }

  public stopTracing(): void {
    this.isTracing = false;
  }

  public traceNavigation(url: string): NavigationTrace {
    const startTime = performance.now();

    // This is a simplified trace - in reality, this would need to be
    // integrated more deeply with the router's navigation process
    const trace: NavigationTrace = {
      url,
      timestamp: Date.now(),
      steps: [],
      result: "success",
      duration: 0,
    };

    // Simulate tracing steps
    const match = this.router.match(url);
    if (match) {
      trace.steps.push({
        type: "match",
        routeId: match.route.id,
        startTime,
        endTime: performance.now(),
        duration: performance.now() - startTime,
        result: match,
      });
    }

    trace.duration = performance.now() - startTime;
    this.navigationTraces.push(trace);

    return trace;
  }

  private captureNavigationTrace(): void {
    // Implementation would capture real navigation steps
    // This is a placeholder for demonstration
  }

  public getNavigationTraces(): NavigationTrace[] {
    return [...this.navigationTraces];
  }

  public clearTraces(): void {
    this.navigationTraces = [];
  }

  // =================================================================
  // ---------------- CURRENT MATCH INSPECTION ---------------------
  // =================================================================

  public inspectCurrentMatch(): MatchInspection | null {
    const match = this.router.currentMatch;
    if (!match) return null;

    return {
      route: match.route,
      params: match.params,
      searchParams: new URLSearchParams(match.search),
      ancestry: match.route.ancestors,
      dataFlow: this.analyzeDataFlow(match),
      cachingInfo: this.analyzeCaching(match),
      guardResults: this.analyzeGuardResults(match),
    };
  }

  private analyzeDataFlow(match: RouteMatch<any>): any {
    const flow = {
      loaders: [] as any[],
      data: match.data,
      sources: [] as string[],
    };

    // Analyze data sources
    let current: RouteMatch<any> | null = match;
    while (current) {
      if (current.route.metadata.loader) {
        flow.loaders.push({
          routeId: current.route.id,
          hasData: !!current.data,
        });
        flow.sources.push(current.route.id);
      }
      current = current.child ?? null;
    }

    return flow;
  }

  private analyzeCaching(match: RouteMatch<any>): any {
    return {
      route: match.route.metadata.cache,
      status: "unknown", // Would need router integration to get actual cache status
    };
  }

  private analyzeGuardResults(_match: RouteMatch<any>): any[] {
    // Would need router integration to get actual guard execution results
    return [];
  }

  // =================================================================
  // ---------------- VALIDATION AND OPTIMIZATION ------------------
  // =================================================================

  public validateRouteConfiguration(): ValidationReport {
    const report: ValidationReport = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      routes: {},
    };

    this.getRoutes().forEach((route) => {
      const routeReport = this.validateSingleRoute(route);
      report.routes[route.id] = routeReport;

      if (!routeReport.valid) {
        report.valid = false;
        report.errors.push(
          ...routeReport.issues.filter((i) => i.includes("Error:")),
        );
        report.warnings.push(
          ...routeReport.issues.filter((i) => i.includes("Warning:")),
        );
      }
    });

    // Global validations
    this.validateGlobalConfiguration(report);

    return report;
  }

  private validateSingleRoute(route: Route<any>): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for common issues
    if (route.paramNames.length === 0 && route.metadata.loader) {
      issues.push("Warning: Route has loader but no parameters");
    }

    if (route.metadata.guards && route.metadata.guards.length > 5) {
      issues.push("Warning: Route has many guards (performance impact)");
    }

    if (route.depth > 6) {
      issues.push("Warning: Route is very deeply nested");
    }

    return {
      valid: !issues.some((i) => i.includes("Error:")),
      issues,
    };
  }

  private validateGlobalConfiguration(report: ValidationReport): void {
    // Check for route conflicts
    const patterns = new Map<string, Route<any>[]>();

    this.getRoutes().forEach((route) => {
      const pattern = this.getRoutePattern(route);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(route);
    });

    patterns.forEach((routes, pattern) => {
      if (routes.length > 1) {
        report.errors.push(
          `Error: Multiple routes with same pattern: ${pattern}`,
        );
        report.valid = false;
      }
    });
  }

  private getRoutePattern(route: Route<any>): string {
    const parts: string[] = [];

    route.routeChain.forEach((r: any) => {
      r.matchers.forEach((matcher: any) => {
        switch (matcher.type) {
          case "path":
            parts.push(matcher.segment);
            break;
          case "param":
            parts.push(`:${matcher.name}`);
            break;
          case "wildcard":
            parts.push("*");
            break;
        }
      });
    });

    return "/" + parts.join("/");
  }

  public suggestOptimizations(): Optimization[] {
    const optimizations: Optimization[] = [];

    this.getRoutes().forEach((route) => {
      // Caching optimizations
      if (route.metadata.loader && !route.metadata.cache) {
        optimizations.push({
          type: "caching",
          priority: "medium",
          description: "Add caching to route loader",
          route,
          implementation: "Add cache() enhancer to route definition",
          impact: "Reduces data fetching overhead",
        });
      }

      // Guard optimizations
      if (route.metadata.guards && route.metadata.guards.length > 3) {
        optimizations.push({
          type: "guards",
          priority: "low",
          description: "Consider combining multiple guards",
          route,
          implementation: "Merge guard logic into fewer functions",
          impact: "Reduces guard execution overhead",
        });
      }

      // Lazy loading optimizations
      if (route.depth > 3 && !route.metadata.lazy) {
        optimizations.push({
          type: "loaders",
          priority: "medium",
          description: "Consider lazy loading for deep routes",
          route,
          implementation: "Add lazy() enhancer with dynamic import",
          impact: "Reduces initial bundle size",
        });
      }
    });

    return optimizations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // =================================================================
  // ---------------- UTILITY METHODS ------------------------------
  // =================================================================

  public generateRouteTree(): string {
    return visualizeRouteTree(this.getRoutes());
  }

  public exportDebugData(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        routes: this.analyzeRoutes(),
        currentMatch: this.inspectCurrentMatch(),
        navigationTraces: this.getNavigationTraces(),
        validation: this.validateRouteConfiguration(),
        optimizations: this.suggestOptimizations(),
      },
      null,
      2,
    );
  }
}

// =================================================================
// ---------------- CONVENIENCE FUNCTIONS ------------------------
// =================================================================

/**
 * Creates a router debugger instance
 */
export function createDebugger(router: CombiRouter): RouterDebugger | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return new RouterDebugger(router);
}

/**
 * Quick function to analyze and log route structure
 */
export function analyzeRouterStructure(router: CombiRouter): void {
  if (process.env.NODE_ENV === "production") return;

  const routerDebugger = new RouterDebugger(router);
  const analysis = routerDebugger.analyzeRoutes();

  console.group("[CombiRouter] Route Structure Analysis");
  console.log("Total routes:", analysis.length);

  const complexRoutes = analysis.filter((a) => a.complexity > 20);
  if (complexRoutes.length > 0) {
    console.warn(
      "High complexity routes:",
      complexRoutes.map((a) => a.route.id),
    );
  }

  const issues = analysis.flatMap((a) => a.potentialIssues);
  if (issues.length > 0) {
    console.warn("Potential issues found:", issues);
  }

  const optimizations = analysis.flatMap((a) => a.optimizations);
  if (optimizations.length > 0) {
    console.info("Optimization suggestions:", optimizations);
  }

  console.groupEnd();
}

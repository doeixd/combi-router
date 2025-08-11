// =================================================================
//
//      Combi-Router: Development Mode Warning System
//
//      This module provides comprehensive warning detection for
//      common routing mistakes and development issues.
//
// =================================================================

import type { Route, RouteMatch } from "../core/types";
import type { CombiRouter } from "../core/router";

// =================================================================
// ---------------- WARNING TYPES & INTERFACES -------------------
// =================================================================

export enum WarningType {
  UNUSED_PARAMETER = "unused-parameter",
  CONFLICTING_ROUTES = "conflicting-routes",
  MISSING_PARAMETER = "missing-parameter",
  INEFFICIENT_HIERARCHY = "inefficient-hierarchy",
  DEAD_CODE_ROUTE = "dead-code-route",
  PERFORMANCE_ANTIPATTERN = "performance-antipattern",
  ROUTE_MATCHING_ISSUE = "route-matching-issue",
  PARAMETER_VALIDATION_FAILURE = "parameter-validation-failure",
  GUARD_EXECUTION_PROBLEM = "guard-execution-problem",
  LOADER_PERFORMANCE_ISSUE = "loader-performance-issue",
}

export enum WarningSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export interface DevWarning {
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  route?: Route<any>;
  suggestion: string;
  details?: any;
  timestamp: number;
}

export interface WarningConfig {
  enabled: boolean;
  severityFilter: WarningSeverity[];
  runtimeWarnings: boolean;
  staticWarnings: boolean;
  performanceWarnings: boolean;
}

// =================================================================
// ---------------- WARNING SYSTEM IMPLEMENTATION ----------------
// =================================================================

export class DevWarningSystem {
  private warnings: DevWarning[] = [];
  private config: WarningConfig;
  private router: CombiRouter;

  constructor(router: CombiRouter, config: Partial<WarningConfig> = {}) {
    this.router = router;
    this.config = {
      enabled: process.env.NODE_ENV !== "production",
      severityFilter: [
        WarningSeverity.INFO,
        WarningSeverity.WARNING,
        WarningSeverity.ERROR,
      ],
      runtimeWarnings: true,
      staticWarnings: true,
      performanceWarnings: true,
      ...config,
    };

    if (this.config.enabled) {
      this.init();
    }
  }

  private init(): void {
    // Run static analysis on router creation
    if (this.config.staticWarnings) {
      this.runStaticAnalysis();
    }

    // Set up runtime monitoring
    if (this.config.runtimeWarnings) {
      this.setupRuntimeMonitoring();
    }
  }

  private runStaticAnalysis(): void {
    this.checkUnusedParameters();
    this.checkConflictingRoutes();
    this.checkInefficiencies();
    this.checkDeadCodeRoutes();
    this.checkPerformanceAntiPatterns();
  }

  private setupRuntimeMonitoring(): void {
    this.router.subscribe((match) => {
      if (match) {
        this.checkRuntimeIssues(match);
      }
    });
  }

  // =================================================================
  // --------------- HELPER METHODS ---------------------------------
  // =================================================================

  private getRoutes(): any[] {
    // Handle both CombiRouter (routes as array) and layered router (routes as function)
    if (typeof this.router.routes === "function") {
      return this.router.routes();
    }
    return this.router.routes || [];
  }

  // =================================================================
  // --------------- PRIVATE WARNING CHECK METHODS -----------------
  // =================================================================

  private checkUnusedParameters(): void {
    const routes = this.getRoutes();

    routes.forEach((route) => {
      const paramNames = route.paramNames;
      const hasLoader = !!route.metadata.loader;
      const hasGuards =
        route.metadata.guards && route.metadata.guards.length > 0;

      // Check if parameters are potentially unused
      // This is a heuristic - we can't perfectly detect usage without runtime analysis
      if (paramNames.length > 0 && !hasLoader && !hasGuards) {
        this.addWarning({
          type: WarningType.UNUSED_PARAMETER,
          severity: WarningSeverity.WARNING,
          message: `Route has parameters (${paramNames.join(", ")}) but no loader or guards to use them`,
          route,
          suggestion:
            "Consider adding a loader to fetch data using these parameters, or remove unused parameters",
        });
      }
    });
  }

  private checkConflictingRoutes(): void {
    const routes = this.getRoutes();
    const patterns = new Map<string, Route<any>[]>();

    // Group routes by their pattern similarity
    routes.forEach((route) => {
      const pattern = this.getRoutePattern(route);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(route);
    });

    // Check for potential conflicts
    patterns.forEach((routeGroup, pattern) => {
      if (routeGroup.length > 1) {
        this.addWarning({
          type: WarningType.CONFLICTING_ROUTES,
          severity: WarningSeverity.ERROR,
          message: `Multiple routes match the same pattern: ${pattern}`,
          suggestion:
            "Ensure route patterns are unique or use proper route ordering",
          details: { conflictingRoutes: routeGroup.map((r) => r.id) },
        });
      }
    });

    // Check for parameter vs static path conflicts
    this.checkParameterConflicts(routes);
  }

  private checkParameterConflicts(routes: Route<any>[]): void {
    const pathGroups = new Map<
      string,
      { static: Route<any>[]; dynamic: Route<any>[] }
    >();

    routes.forEach((route) => {
      const staticParts = route.staticPath.split("/").filter((p) => p);
      const key = staticParts.slice(0, -1).join("/"); // All but last segment

      if (!pathGroups.has(key)) {
        pathGroups.set(key, { static: [], dynamic: [] });
      }

      const group = pathGroups.get(key)!;
      if (route.isDynamic) {
        group.dynamic.push(route);
      } else {
        group.static.push(route);
      }
    });

    pathGroups.forEach((group, basePath) => {
      if (group.static.length > 0 && group.dynamic.length > 0) {
        this.addWarning({
          type: WarningType.CONFLICTING_ROUTES,
          severity: WarningSeverity.WARNING,
          message: `Potential route conflict at '${basePath}': static and dynamic routes may interfere`,
          suggestion:
            "Ensure static routes are defined before dynamic ones in your route array",
          details: {
            staticRoutes: group.static.map((r) => r.id),
            dynamicRoutes: group.dynamic.map((r) => r.id),
          },
        });
      }
    });
  }

  private checkInefficiencies(): void {
    const routes = this.getRoutes();

    routes.forEach((route) => {
      // Check for deep nesting without clear hierarchy
      if (route.depth > 5) {
        this.addWarning({
          type: WarningType.INEFFICIENT_HIERARCHY,
          severity: WarningSeverity.INFO,
          message: `Route has very deep nesting (depth: ${route.depth})`,
          route,
          suggestion:
            "Consider flattening the route hierarchy or breaking into smaller sub-routers",
        });
      }

      // Check for routes with many parameters (potential complexity)
      if (route.paramNames.length > 4) {
        this.addWarning({
          type: WarningType.INEFFICIENT_HIERARCHY,
          severity: WarningSeverity.WARNING,
          message: `Route has many parameters (${route.paramNames.length})`,
          route,
          suggestion:
            "Consider using fewer parameters or query parameters for optional data",
        });
      }
    });
  }

  private checkDeadCodeRoutes(): void {
    const routes = this.getRoutes();

    routes.forEach((route) => {
      // Check for routes that might be unreachable due to wildcards
      const hasWildcardAncestor = route.ancestors.some((ancestor) =>
        ancestor.matchers.some((matcher: any) => matcher.type === "wildcard"),
      );

      if (hasWildcardAncestor) {
        this.addWarning({
          type: WarningType.DEAD_CODE_ROUTE,
          severity: WarningSeverity.WARNING,
          message:
            "Route may be unreachable due to wildcard matcher in ancestor route",
          route,
          suggestion:
            "Ensure wildcard routes are ordered correctly and specific routes come first",
        });
      }
    });
  }

  private checkPerformanceAntiPatterns(): void {
    if (!this.config.performanceWarnings) return;

    const routes = this.getRoutes();

    routes.forEach((route) => {
      // Check for routes without caching but with expensive loaders
      if (route.metadata.loader && !route.metadata.cache) {
        this.addWarning({
          type: WarningType.PERFORMANCE_ANTIPATTERN,
          severity: WarningSeverity.INFO,
          message: "Route has loader but no caching configured",
          route,
          suggestion: "Consider adding cache() enhancer for better performance",
        });
      }

      // Check for multiple guards (potential performance impact)
      if (route.metadata.guards && route.metadata.guards.length > 3) {
        this.addWarning({
          type: WarningType.PERFORMANCE_ANTIPATTERN,
          severity: WarningSeverity.INFO,
          message: `Route has many guards (${route.metadata.guards.length})`,
          route,
          suggestion:
            "Consider combining guards or using more efficient guard logic",
        });
      }
    });
  }

  // =================================================================
  // ---------------- RUNTIME ANALYSIS METHODS ---------------------
  // =================================================================

  private checkRuntimeIssues(match: RouteMatch<any>): void {
    this.checkMatchingIssues(match);
    this.checkParameterValidation(match);
    this.checkLoaderPerformance(match);
  }

  private checkMatchingIssues(match: RouteMatch<any>): void {
    // Check for unusual parameter values that might indicate URL issues
    Object.entries(match.params).forEach(([key, value]) => {
      if (typeof value === "string") {
        // Check for potentially problematic parameter values
        if (value.includes("%") && value.includes("encoding")) {
          this.addWarning({
            type: WarningType.ROUTE_MATCHING_ISSUE,
            severity: WarningSeverity.WARNING,
            message: `Parameter '${key}' may have URL encoding issues`,
            route: match.route,
            suggestion: "Ensure proper URL decoding is handled",
          });
        }

        if (value.length > 1000) {
          this.addWarning({
            type: WarningType.ROUTE_MATCHING_ISSUE,
            severity: WarningSeverity.WARNING,
            message: `Parameter '${key}' is unusually long (${value.length} characters)`,
            route: match.route,
            suggestion: "Consider using query parameters for large data",
          });
        }
      }
    });
  }

  private checkParameterValidation(match: RouteMatch<any>): void {
    // This would be called when parameter validation fails
    // The actual validation happens in the router, this is for additional checks
    const route = match.route;

    if (route.paramNames.length > 0 && Object.keys(match.params).length === 0) {
      this.addWarning({
        type: WarningType.PARAMETER_VALIDATION_FAILURE,
        severity: WarningSeverity.ERROR,
        message: "Route expects parameters but none were provided in match",
        route,
        suggestion: "Check route definition and navigation parameters",
      });
    }
  }

  private checkLoaderPerformance(match: RouteMatch<any>): void {
    if (match.route.metadata.loader) {
      const start = performance.now();

      // We can't directly monitor the loader here, but we can track timing
      // This would need to be integrated with the actual loader execution
      setTimeout(() => {
        const duration = performance.now() - start;
        if (duration > 5000) {
          // 5 second threshold
          this.addWarning({
            type: WarningType.LOADER_PERFORMANCE_ISSUE,
            severity: WarningSeverity.WARNING,
            message: `Loader took ${duration.toFixed(0)}ms to complete`,
            route: match.route,
            suggestion:
              "Consider optimizing data fetching or adding loading states",
          });
        }
      }, 0);
    }
  }

  // =================================================================
  // ---------------- UTILITY METHODS ------------------------------
  // =================================================================

  private getRoutePattern(route: Route<any>): string {
    // Create a pattern string that represents the route structure
    const parts: string[] = [];

    route.matchers.forEach((matcher: any) => {
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
        case "query":
          // Query parameters don't affect path patterns
          break;
      }
    });

    return "/" + parts.join("/");
  }

  private addWarning(warning: Omit<DevWarning, "timestamp">): void {
    if (!this.config.enabled) return;
    if (!this.config.severityFilter.includes(warning.severity)) return;

    const fullWarning: DevWarning = {
      ...warning,
      timestamp: Date.now(),
    };

    this.warnings.push(fullWarning);
    this.logWarning(fullWarning);
  }

  private logWarning(warning: DevWarning): void {
    const prefix = "[CombiRouter]";
    const routeInfo = warning.route ? ` (Route: ${warning.route.id})` : "";
    const message = `${prefix} ${warning.message}${routeInfo}`;

    switch (warning.severity) {
      case WarningSeverity.ERROR:
        console.error(message);
        console.error("Suggestion:", warning.suggestion);
        break;
      case WarningSeverity.WARNING:
        console.warn(message);
        console.warn("Suggestion:", warning.suggestion);
        break;
      case WarningSeverity.INFO:
        console.info(message);
        console.info("Suggestion:", warning.suggestion);
        break;
    }

    if (warning.details) {
      console.log("Details:", warning.details);
    }
  }

  // =================================================================
  // ---------------- PUBLIC API -----------------------------------
  // =================================================================

  public getWarnings(): DevWarning[] {
    return [...this.warnings];
  }

  public getWarningsByType(type: WarningType): DevWarning[] {
    return this.warnings.filter((w) => w.type === type);
  }

  public getWarningsBySeverity(severity: WarningSeverity): DevWarning[] {
    return this.warnings.filter((w) => w.severity === severity);
  }

  public clearWarnings(): void {
    this.warnings = [];
  }

  public updateConfig(config: Partial<WarningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public disable(): void {
    this.config.enabled = false;
  }

  public enable(): void {
    this.config.enabled = true;
  }
}

// =================================================================
// ---------------- CONVENIENCE FUNCTIONS ------------------------
// =================================================================

/**
 * Creates a warning system for a router with default configuration
 */
export function createWarningSystem(
  router: CombiRouter,
  config?: Partial<WarningConfig>,
): DevWarningSystem | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return new DevWarningSystem(router, config);
}

/**
 * Quick function to run static analysis on routes and log warnings
 */
export function analyzeRoutes(router: CombiRouter): void {
  if (process.env.NODE_ENV === "production") return;

  const warningSystem = new DevWarningSystem(router, {
    runtimeWarnings: false, // Only static analysis
    staticWarnings: true,
  });

  const warnings = warningSystem.getWarnings();

  if (warnings.length === 0) {
    console.log("[CombiRouter] ✅ No routing issues detected");
  } else {
    console.log(`[CombiRouter] Found ${warnings.length} potential issues:`);
    warnings.forEach((warning) => {
      console.log(`- ${warning.message}`);
    });
  }
}

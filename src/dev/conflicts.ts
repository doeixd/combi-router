// =================================================================
//
//      Combi-Router: Route Conflict Detection
//
//      This module provides comprehensive route conflict detection
//      and resolution suggestions for development.
//
// =================================================================

import type { Route } from "../core/types";

// =================================================================
// ---------------- CONFLICT TYPES & INTERFACES ------------------
// =================================================================

export enum ConflictType {
  OVERLAP = "overlap",
  UNREACHABLE = "unreachable",
  AMBIGUOUS = "ambiguous",
  PARAMETER_TYPE = "parameter-type",
  WILDCARD = "wildcard",
  DUPLICATE_STATIC = "duplicate-static",
}

export interface RouteConflict {
  type: ConflictType;
  routes: Route<any>[];
  conflictPath: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
  details?: any;
}

export interface ConflictAnalysis {
  conflicts: RouteConflict[];
  warnings: number;
  errors: number;
  summary: string;
}

// =================================================================
// ---------------- CONFLICT DETECTION ENGINE ---------------------
// =================================================================

export class RouteConflictDetector {
  private routes: Route<any>[];

  constructor(routes: Route<any>[]) {
    this.routes = [...routes];
  }

  /**
   * Analyzes all routes for conflicts and returns a comprehensive report
   */
  public analyzeConflicts(): ConflictAnalysis {
    const conflicts: RouteConflict[] = [];

    // Run different types of conflict detection
    conflicts.push(...this.detectStaticPathConflicts());
    conflicts.push(...this.detectParameterConflicts());
    conflicts.push(...this.detectWildcardConflicts());
    conflicts.push(...this.detectUnreachableRoutes());
    conflicts.push(...this.detectAmbiguousRoutes());
    conflicts.push(...this.detectParameterTypeConflicts());

    const errors = conflicts.filter((c) => c.severity === "error").length;
    const warnings = conflicts.filter((c) => c.severity === "warning").length;

    return {
      conflicts,
      errors,
      warnings,
      summary: this.generateSummary(conflicts, errors, warnings),
    };
  }

  // =================================================================
  // ---------------- SPECIFIC CONFLICT DETECTORS ------------------
  // =================================================================

  private detectStaticPathConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const staticPaths = new Map<string, Route<any>[]>();

    // Group routes by their complete static paths
    this.routes.forEach((route) => {
      const staticPath = this.getFullStaticPath(route);
      if (!staticPaths.has(staticPath)) {
        staticPaths.set(staticPath, []);
      }
      staticPaths.get(staticPath)!.push(route);
    });

    // Find duplicates
    staticPaths.forEach((routes, path) => {
      if (routes.length > 1) {
        conflicts.push({
          type: ConflictType.DUPLICATE_STATIC,
          routes,
          conflictPath: path,
          severity: "error",
          suggestion:
            "Multiple routes have identical static paths. Ensure each route has a unique path pattern.",
          details: {
            duplicateCount: routes.length,
            routeIds: routes.map((r) => r.id),
          },
        });
      }
    });

    return conflicts;
  }

  private detectParameterConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const pathSegments = this.groupRoutesByPathSegments();

    pathSegments.forEach((segmentGroup, basePath) => {
      const staticRoutes = segmentGroup.filter(
        (route) => !this.hasParameterAtLevel(route, basePath.split("/").length),
      );
      const paramRoutes = segmentGroup.filter((route) =>
        this.hasParameterAtLevel(route, basePath.split("/").length),
      );

      if (staticRoutes.length > 0 && paramRoutes.length > 0) {
        // Check for potential conflicts between static and parameter routes
        staticRoutes.forEach((staticRoute) => {
          paramRoutes.forEach((paramRoute) => {
            if (this.wouldConflict(staticRoute, paramRoute)) {
              conflicts.push({
                type: ConflictType.OVERLAP,
                routes: [staticRoute, paramRoute],
                conflictPath: basePath,
                severity: "warning",
                suggestion: `Static route '${staticRoute.staticPath}' may conflict with parameter route '${this.getRoutePattern(paramRoute)}'. Consider reordering routes or making paths more specific.`,
              });
            }
          });
        });
      }
    });

    return conflicts;
  }

  private detectWildcardConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const wildcardRoutes = this.routes.filter((route) =>
      route.matchers.some((matcher: any) => matcher.type === "wildcard"),
    );

    wildcardRoutes.forEach((wildcardRoute) => {
      // Find routes that might be overshadowed by this wildcard
      const affectedRoutes = this.routes.filter(
        (route) =>
          route !== wildcardRoute &&
          this.isOvershadowedByWildcard(route, wildcardRoute),
      );

      if (affectedRoutes.length > 0) {
        conflicts.push({
          type: ConflictType.WILDCARD,
          routes: [wildcardRoute, ...affectedRoutes],
          conflictPath: wildcardRoute.staticPath,
          severity: "warning",
          suggestion: `Wildcard route '${this.getRoutePattern(wildcardRoute)}' may overshadow other routes. Ensure wildcard routes are defined after more specific routes.`,
          details: {
            wildcardRoute: wildcardRoute.id,
            overshadowedRoutes: affectedRoutes.map((r) => r.id),
          },
        });
      }
    });

    return conflicts;
  }

  private detectUnreachableRoutes(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];

    this.routes.forEach((route, index) => {
      // Check if this route is made unreachable by earlier routes
      const earlierRoutes = this.routes.slice(0, index);
      const blockingRoutes = earlierRoutes.filter((earlierRoute) =>
        this.doesRouteBlock(earlierRoute, route),
      );

      if (blockingRoutes.length > 0) {
        conflicts.push({
          type: ConflictType.UNREACHABLE,
          routes: [route, ...blockingRoutes],
          conflictPath: route.staticPath,
          severity: "error",
          suggestion: `Route '${this.getRoutePattern(route)}' is unreachable because it's blocked by earlier route(s). Consider reordering routes or making patterns more specific.`,
          details: {
            unreachableRoute: route.id,
            blockingRoutes: blockingRoutes.map((r) => r.id),
          },
        });
      }
    });

    return conflicts;
  }

  private detectAmbiguousRoutes(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];

    // Group routes that could potentially match the same URLs
    const potentialMatches = this.findPotentiallyAmbiguousGroups();

    potentialMatches.forEach((group) => {
      if (group.length > 1) {
        conflicts.push({
          type: ConflictType.AMBIGUOUS,
          routes: group,
          conflictPath: this.findCommonPath(group),
          severity: "warning",
          suggestion:
            "Multiple routes could match similar URL patterns. Consider adding more specific constraints or using different path structures.",
          details: {
            routePatterns: group.map((r) => this.getRoutePattern(r)),
          },
        });
      }
    });

    return conflicts;
  }

  private detectParameterTypeConflicts(): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const paramGroups = this.groupRoutesByParameterPosition();

    paramGroups.forEach((routes, paramKey) => {
      const typeConflicts = this.findParameterTypeConflicts(routes);

      if (typeConflicts.length > 0) {
        conflicts.push({
          type: ConflictType.PARAMETER_TYPE,
          routes: typeConflicts,
          conflictPath: paramKey,
          severity: "warning",
          suggestion:
            "Routes have parameters at the same position with different validation schemas. This may cause unexpected behavior.",
          details: {
            parameterPosition: paramKey,
            schemas: typeConflicts.map((route) =>
              this.getParameterSchemas(route),
            ),
          },
        });
      }
    });

    return conflicts;
  }

  // =================================================================
  // ---------------- ANALYSIS HELPER METHODS ----------------------
  // =================================================================

  private getFullStaticPath(route: Route<any>): string {
    // Build the complete static path including inherited parts
    const pathParts: string[] = [];

    route.routeChain.forEach((r: Route<any>) => {
      r.matchers.forEach((matcher: any) => {
        if (matcher.type === "path") {
          pathParts.push(matcher.segment);
        }
      });
    });

    return "/" + pathParts.join("/");
  }

  private getRoutePattern(route: Route<any>): string {
    const parts: string[] = [];

    route.routeChain.forEach((r: Route<any>) => {
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

  private groupRoutesByPathSegments(): Map<string, Route<any>[]> {
    const groups = new Map<string, Route<any>[]>();

    this.routes.forEach((route) => {
      const staticParts = route.staticPath.split("/").filter((p: string) => p);

      // Group by each level of static path
      for (let i = 0; i <= staticParts.length; i++) {
        const partialPath = "/" + staticParts.slice(0, i).join("/");
        if (!groups.has(partialPath)) {
          groups.set(partialPath, []);
        }
        groups.get(partialPath)!.push(route);
      }
    });

    return groups;
  }

  private hasParameterAtLevel(route: Route<any>, level: number): boolean {
    let currentLevel = 0;

    for (const r of route.routeChain) {
      for (const matcher of r.matchers) {
        if ((matcher as any).type === "path") {
          currentLevel++;
        } else if (
          (matcher as any).type === "param" &&
          currentLevel === level
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private wouldConflict(route1: Route<any>, route2: Route<any>): boolean {
    // Simple conflict detection - routes with overlapping paths
    const pattern1 = this.getRoutePattern(route1);
    const pattern2 = this.getRoutePattern(route2);

    // If patterns are similar (considering parameters), they might conflict
    const normalized1 = pattern1.replace(/:[\w]+/g, ":param");
    const normalized2 = pattern2.replace(/:[\w]+/g, ":param");

    return normalized1 === normalized2;
  }

  private isOvershadowedByWildcard(
    route: Route<any>,
    wildcardRoute: Route<any>,
  ): boolean {
    // Check if the route could be matched by the wildcard
    const routeStaticPath = route.staticPath;
    const wildcardStaticPath = wildcardRoute.staticPath;

    return routeStaticPath.startsWith(wildcardStaticPath);
  }

  private doesRouteBlock(
    earlierRoute: Route<any>,
    laterRoute: Route<any>,
  ): boolean {
    // Check if the earlier route would match URLs intended for the later route
    const earlierPattern = this.normalizePattern(
      this.getRoutePattern(earlierRoute),
    );
    const laterPattern = this.normalizePattern(
      this.getRoutePattern(laterRoute),
    );

    // If the earlier pattern is more general and covers the later pattern
    return this.patternCovers(earlierPattern, laterPattern);
  }

  private normalizePattern(pattern: string): string {
    // Normalize patterns for comparison
    return pattern
      .replace(/:[\w]+/g, ":param") // Normalize parameter names
      .replace(/\/+/g, "/") // Normalize multiple slashes
      .replace(/\/$/, ""); // Remove trailing slash
  }

  private patternCovers(
    generalPattern: string,
    specificPattern: string,
  ): boolean {
    // Check if the general pattern would match URLs intended for the specific pattern
    const generalParts = generalPattern.split("/").filter((p) => p);
    const specificParts = specificPattern.split("/").filter((p) => p);

    if (generalParts.length > specificParts.length) return false;

    for (let i = 0; i < generalParts.length; i++) {
      const generalPart = generalParts[i];
      const specificPart = specificParts[i];

      if (generalPart === "*") return true; // Wildcard covers everything
      if (generalPart !== specificPart && generalPart !== ":param")
        return false;
    }

    return generalParts.length === specificParts.length;
  }

  private findPotentiallyAmbiguousGroups(): Route<any>[][] {
    const groups: Route<any>[][] = [];
    const processed = new Set<string>();

    this.routes.forEach((route) => {
      if (processed.has(route.id)) return;

      const similarRoutes = this.routes.filter(
        (other) =>
          other !== route &&
          !processed.has(other.id) &&
          this.areRoutesSimilar(route, other),
      );

      if (similarRoutes.length > 0) {
        const group = [route, ...similarRoutes];
        groups.push(group);
        group.forEach((r) => processed.add(r.id));
      }
    });

    return groups;
  }

  private areRoutesSimilar(route1: Route<any>, route2: Route<any>): boolean {
    const pattern1 = this.normalizePattern(this.getRoutePattern(route1));
    const pattern2 = this.normalizePattern(this.getRoutePattern(route2));

    // Routes are similar if they have the same normalized pattern
    return pattern1 === pattern2;
  }

  private findCommonPath(routes: Route<any>[]): string {
    if (routes.length === 0) return "";

    const paths = routes.map((r) =>
      r.staticPath.split("/").filter((p: string) => p),
    );
    const minLength = Math.min(...paths.map((p) => p.length));

    const commonParts: string[] = [];
    for (let i = 0; i < minLength; i++) {
      const parts = paths.map((p) => p[i]);
      if (parts.every((part) => part === parts[0])) {
        commonParts.push(parts[0]);
      } else {
        break;
      }
    }

    return "/" + commonParts.join("/");
  }

  private groupRoutesByParameterPosition(): Map<string, Route<any>[]> {
    const groups = new Map<string, Route<any>[]>();

    this.routes.forEach((route) => {
      route.paramNames.forEach((_paramName: any, index: number) => {
        const key = `position-${index}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(route);
      });
    });

    return groups;
  }

  private findParameterTypeConflicts(routes: Route<any>[]): Route<any>[] {
    // This would need access to the actual Zod schemas to properly detect conflicts
    // For now, we'll return routes that have parameters at the same position
    // The actual implementation would compare the validation schemas

    if (routes.length <= 1) return [];

    // Simplified: assume conflict if multiple routes have parameters at same position
    return routes;
  }

  private getParameterSchemas(route: Route<any>): any {
    // This would extract the actual Zod schemas from route matchers
    // For now, return parameter names as a placeholder
    return route.paramNames;
  }

  private generateSummary(
    conflicts: RouteConflict[],
    errors: number,
    warnings: number,
  ): string {
    if (conflicts.length === 0) {
      return "✅ No route conflicts detected";
    }

    const parts = [];
    if (errors > 0) parts.push(`${errors} error(s)`);
    if (warnings > 0) parts.push(`${warnings} warning(s)`);

    return `Found ${conflicts.length} potential route conflicts: ${parts.join(", ")}`;
  }
}

// =================================================================
// ---------------- CONVENIENCE FUNCTIONS ------------------------
// =================================================================

/**
 * Analyzes routes for conflicts and returns a detailed report
 */
export function analyzeRouteConflicts(routes: Route<any>[]): ConflictAnalysis {
  const detector = new RouteConflictDetector(routes);
  return detector.analyzeConflicts();
}

/**
 * Quick function to check for conflicts and log them to console
 */
export function logRouteConflicts(routes: Route<any>[]): void {
  if (process.env.NODE_ENV === "production") return;

  const analysis = analyzeRouteConflicts(routes);

  console.group("[CombiRouter] Route Conflict Analysis");
  console.log(analysis.summary);

  if (analysis.conflicts.length > 0) {
    analysis.conflicts.forEach((conflict) => {
      const prefix =
        conflict.severity === "error"
          ? "❌"
          : conflict.severity === "warning"
            ? "⚠️"
            : "ℹ️";

      console.group(
        `${prefix} ${conflict.type.toUpperCase()}: ${conflict.conflictPath}`,
      );
      console.log(
        "Routes:",
        conflict.routes.map((r) => r.id),
      );
      console.log("Suggestion:", conflict.suggestion);
      if (conflict.details) {
        console.log("Details:", conflict.details);
      }
      console.groupEnd();
    });
  }

  console.groupEnd();
}

/**
 * Finds specific types of conflicts
 */
export function findConflicts(
  routes: Route<any>[],
  type: ConflictType,
): RouteConflict[] {
  const analysis = analyzeRouteConflicts(routes);
  return analysis.conflicts.filter((c) => c.type === type);
}

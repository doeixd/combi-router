// =================================================================
//
//      Combi-Router: Route Class and Building Functions
//
//      This module contains the core Route class and functions for
//      creating and extending routes.
//
// =================================================================

import type { Parser } from "@doeixd/combi-parse";
import type { RouteMatcher, RouteMetadata, InferMatcherParams } from "./types";
import { buildRouteParser } from "./parser";

// =================================================================
// ---------------------- THE ROUTE CLASS -------------------------
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
  public readonly parent?: Route<any>;
  private _parser?: Parser<TParams>;

  constructor(
    public readonly matchers: readonly RouteMatcher[],
    public readonly metadata: RouteMetadata = {},
    name?: string,
    parent?: Route<any>,
  ) {
    this.name = name;
    this.parent = parent;

    // Validate route during creation
    this._validateRoute();

    // Extract metadata from meta matchers
    const metaMatchers = matchers.filter((m) => m.type === "meta");
    for (const metaMatcher of metaMatchers) {
      if (metaMatcher.parser) {
        const result = metaMatcher.parser.run({ input: "", index: 0 });
        if (result.type === "success") {
          Object.assign(this.metadata, result.value);
        }
      }
    }
  }

  /**
   * Lazily builds and retrieves the composite parser for this route.
   * The parser is created on first access and cached for performance.
   */
  get parser(): Parser<TParams> {
    if (!this._parser) {
      console.log(
        `[Route] Building parser for route ${this.id} with ${this.matchers.length} matchers`,
      );
      console.log(
        `[Route] Matchers:`,
        this.matchers.map((m) => ({
          type: m.type,
          hasParser: !!m.parser,
          paramName: m.paramName,
        })),
      );
      this._parser = buildRouteParser(this.matchers) as Parser<TParams>;
      console.log(`[Route] Parser built:`, !!this._parser);
    }
    return this._parser;
  }

  // =================================================================
  // -------------------- INTROSPECTION UTILITIES -------------------
  // =================================================================

  /** Get the depth of this route in the hierarchy (0 for root routes) */
  get depth(): number {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /** Get all ancestor routes from root to parent */
  get ancestors(): Route<any>[] {
    const ancestors: Route<any>[] = [];
    let current = this.parent;
    while (current) {
      ancestors.unshift(current);
      current = current.parent;
    }
    return ancestors;
  }

  /** Get the static path parts (non-parameter segments) */
  get staticPath(): string {
    const pathMatchers = this.matchers.filter((m) => m.type === "path");
    return pathMatchers.map((m) => m.build({})).join("") || "/";
  }

  /** Get all parameter names defined by this route */
  get paramNames(): string[] {
    return this.matchers
      .filter((m) => m.paramName)
      .map((m) => m.paramName!)
      .filter((name, index, arr) => arr.indexOf(name) === index); // dedupe
  }

  /** Check if this route has dynamic parameters */
  get isDynamic(): boolean {
    return this.matchers.some(
      (m) => m.type === "param" || m.type === "wildcard",
    );
  }

  /** Check if this route has query parameters */
  get hasQuery(): boolean {
    return this.matchers.some((m) => m.type === "query");
  }

  /** Get the full chain of routes from root to this route */
  get routeChain(): Route<any>[] {
    return [...this.ancestors, this];
  }

  /**
   * Validates the route configuration during creation
   * @private
   */
  private _validateRoute(): void {
    // Check for duplicate parameter names
    const paramNames = this.paramNames;
    const duplicates = paramNames.filter(
      (name, index) => paramNames.indexOf(name) !== index,
    );
    if (duplicates.length > 0) {
      throw new (class RouteValidationError extends Error {
        constructor(
          message: string,
          public readonly details?: any,
        ) {
          super(message);
          this.name = "RouteValidationError";
        }
      })(`Duplicate parameter names found: ${duplicates.join(", ")}`, {
        duplicates,
        route: this,
      });
    }

    // Check for invalid matcher combinations
    const wildcardCount = this.matchers.filter(
      (m) => m.type === "wildcard",
    ).length;
    if (wildcardCount > 1) {
      throw new (class RouteValidationError extends Error {
        constructor(
          message: string,
          public readonly details?: any,
        ) {
          super(message);
          this.name = "RouteValidationError";
        }
      })("Routes cannot have more than one wildcard matcher", {
        wildcardCount,
        route: this,
      });
    }

    // Wildcard should be last path matcher
    const wildcardIndex = this.matchers.findIndex((m) => m.type === "wildcard");
    if (wildcardIndex !== -1) {
      const hasPathAfterWildcard = this.matchers
        .slice(wildcardIndex + 1)
        .some((m) => m.type === "path" || m.type === "param");

      if (hasPathAfterWildcard) {
        throw new (class RouteValidationError extends Error {
          constructor(
            message: string,
            public readonly details?: any,
          ) {
            super(message);
            this.name = "RouteValidationError";
          }
        })("Wildcard matcher must be the last path-related matcher", {
          wildcardIndex,
          route: this,
        });
      }
    }

    // Check for end matcher not being last (this is a warning case, not an error)
    // Routes with end matcher not at the end will simply never match
    const endIndex = this.matchers.findIndex((m) => m.type === "end");
    if (endIndex !== -1 && endIndex !== this.matchers.length - 1) {
      // This is intentionally allowed - it just means the route will never match
      // which is the expected behavior in some test cases
      console.warn(
        `[CombiRouter] Route ${this.id} has end matcher not at the end. This route will never match.`,
      );
    }
  }
}

// =================================================================
// ------------------ ROUTE BUILDING & COMPOSITION ---------------
// =================================================================

export function route<T extends RouteMatcher[]>(
  ...matchers: T
): Route<InferMatcherParams<T>> {
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
  return new Route(
    [...baseRoute.matchers, ...additionalMatchers],
    { ...baseRoute.metadata },
    undefined,
    baseRoute,
  );
}

// =================================================================
// ----------------- HIGHER-ORDER ENHANCERS ----------------------
// =================================================================

export function pipe<T>(initial: T, ...fns: Array<(arg: T) => T>): T {
  return fns.reduce((acc, fn) => fn(acc), initial);
}

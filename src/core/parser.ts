// =================================================================
//
//      Combi-Router: Enhanced Parser Implementation and Utilities
//
//      This module contains the route parsing logic with improved
//      separation of path and query parameter concerns.
//
// =================================================================

import { Parser, sequence } from "@doeixd/combi-parse";
import type { RouteMatcher } from "./types";

// =================================================================
// ------------------- ENHANCED PARSING INTERNALS ----------------
// =================================================================

/**
 * Enhanced route parser that better separates path and query concerns.
 * Provides cleaner separation between path parsing and query parameter metadata.
 * @internal
 */
export function buildRouteParser(
  matchers: readonly RouteMatcher[],
): Parser<any> {
  // Defensive check for matchers
  if (!matchers || matchers.length === 0) {
    console.warn("[Parser] No matchers provided to buildRouteParser");
    return new Parser((state) => ({
      type: "failure",
      error: "No matchers",
      state,
    }));
  }

  // Separate path-related matchers from query parameter declarations
  const pathMatchers = matchers
    .filter((m) => m.type !== "query" && m.type !== "meta")
    .map((m) => {
      if (!m.parser) {
        console.error(`[Parser] Matcher of type ${m.type} has no parser`, m);
      }
      return m.parser;
    })
    .filter((p) => p !== undefined);

  const queryMatchers = matchers
    .filter((m) => m.type === "query")
    .map((m) => {
      if (!m.parser) {
        console.error(`[Parser] Query matcher has no parser`, m);
      }
      return m.parser;
    })
    .filter((p) => p !== undefined);

  // Check if we have valid parsers
  if (pathMatchers.length === 0) {
    console.warn("[Parser] No path matchers with valid parsers");
    return new Parser((state) => ({
      type: "failure",
      error: "No valid path matchers",
      state,
    }));
  }

  // Build path parser that combines all path-related results into a single object
  const pathParser = sequence(pathMatchers).map((results) =>
    Object.assign(
      {},
      ...results.filter((result) => result && typeof result === "object"),
    ),
  );

  // Query parser collects metadata for later URL search params validation
  // This returns an array of {name, schema} objects for query parameter processing
  const queryParser = sequence(queryMatchers);

  // Combine path and query parsing results with clear separation
  return pathParser.chain((pathResult) =>
    queryParser.map((queryResultArray) => ({
      path: pathResult,
      query: queryResultArray,
    })),
  );
}

/**
 * Utility to extract path-only parsing logic for cases where we don't need query metadata.
 * @internal
 */
export function buildPathOnlyParser(
  matchers: readonly RouteMatcher[],
): Parser<any> {
  const pathMatchers = matchers
    .filter((m) => m.type !== "query" && m.type !== "meta")
    .map((m) => m.parser);

  return sequence(pathMatchers).map((results) =>
    Object.assign(
      {},
      ...results.filter((result) => result && typeof result === "object"),
    ),
  );
}

/**
 * Extract query parameter metadata for separate processing.
 * @internal
 */
export function extractQueryMatchers(
  matchers: readonly RouteMatcher[],
): RouteMatcher[] {
  return matchers.filter((m) => m.type === "query");
}

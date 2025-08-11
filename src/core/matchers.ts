// =================================================================
//
//      Combi-Router: Route Matchers
//
//      This module contains all the route matcher functions like
//      path, param, query, etc.
//
// =================================================================

import {
  Parser,
  str,
  regex,
  optional as optionalParser,
  eof,
  success,
  failure,
  sepBy,
} from "@doeixd/combi-parse";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RouteMatcher } from "./types";
import { validateSafely } from "./validation";

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
  // Ensure path segments don't pollute params by mapping their parser result to an empty object
  // Handle segments that already start with '/'
  const normalizedSegment = segment.startsWith("/")
    ? segment.substring(1)
    : segment;

  // Special case for root path
  if (normalizedSegment === "") {
    return {
      type: "path",
      parser: str("/").map(() => ({})),
      build: () => "/",
    };
  }

  return {
    type: "path",
    parser: str("/")
      .keepRight(str(normalizedSegment))
      .map(() => ({})),
    build: () => `/${normalizedSegment}`,
  };
}

/**
 * Matches an optional static path segment.
 * @param segment The optional string segment.
 * @example
 * // Matches "/products" and "/products/all"
 * const productsRoute = route(path('products'), path.optional('all'));
 */
path.optional = function (segment: string): RouteMatcher {
  return {
    type: "optionalPath",
    paramName: segment,
    parser: optionalParser(str("/" + segment)).map((res) =>
      res ? { [segment]: true } : { [segment]: undefined },
    ),
    build: (params) => (params[segment] ? `/${segment}` : ""),
  };
};

/**
 * Matches all remaining path segments into an array of strings.
 * This should typically be the last path-related matcher in a route definition.
 * Uses enhanced combi-parse combinators for cleaner implementation.
 * @param name The name for the array of segments in the params object.
 * @example
 * // Matches "/files/a/b/c" -> params.filePath === ['a', 'b', 'c']
 * const fileRoute = route(path('files'), path.wildcard('filePath'));
 */
path.wildcard = function (name = "wildcard"): RouteMatcher {
  // Use regex to match path segments efficiently
  const segmentParser = regex(/[^/?#]+/);

  // Parser for wildcard path segments: leading slash followed by segments separated by slashes
  const wildcardParser = str("/")
    .keepRight(sepBy(segmentParser, str("/")))
    .map((segments) => ({ [name]: segments }));

  return {
    type: "wildcard",
    paramName: name,
    parser: wildcardParser,
    build: (params) => {
      if (Array.isArray(params[name])) {
        return `/${params[name].map(encodeURIComponent).join("/")}`;
      }
      return null;
    },
  };
};

/**
 * Matches a dynamic parameter in the path and validates it using a Standard Schema.
 * Enhanced with better type inference and error reporting.
 * @param name The name of the parameter (e.g., 'id').
 * @param schema A StandardSchema for validation and type coercion.
 * @example
 * // Matches "/users/123" and provides `params.id` as a number.
 * // const userRoute = route(path('users'), param('id', YourNumberSchema)); // Example usage
 */
export function param<TInput, TOutput>(
  name: string,
  schema: StandardSchemaV1<TInput, TOutput>,
): RouteMatcher {
  // Create a more sophisticated parameter parser using combi-parse
  const paramValueParser = regex(/[^/?#]+/);

  const paramParser = str("/")
    .keepRight(paramValueParser)
    .chain(
      (value) =>
        new Parser((state) => {
          // Smart type coercion: attempt to convert to number if it looks like one
          const valueToParse: unknown = /^\d+(\.\d+)?$/.test(value)
            ? Number(value)
            : value;

          // Use enhanced validation with better error context
          const validationResult = validateSafely(
            schema,
            valueToParse,
            `Parameter "${name}"`,
          );

          if (!validationResult.success) {
            return failure(validationResult.error!, state);
          }

          return success({ [name]: validationResult.value }, state);
        }),
    );

  return {
    type: "param",
    paramName: name,
    schema,
    parser: paramParser,
    build: (params) =>
      params[name] !== undefined && params[name] !== null
        ? `/${encodeURIComponent(params[name])}`
        : null,
  };
}

/**
 * Declares a required query parameter and its validation schema.
 * Note: This matcher does not consume path input; it provides metadata for the
 * router to perform validation against the URL's search string after path matching.
 * @param name The name of the query parameter (e.g., 'page').
 * @param schema A StandardSchema for validation.
 * @example
 * // Matches "/items?page=2" and provides `params.page` as a number.
 * // const listRoute = route(path('items'), query('page', YourNumberSchema)); // Example usage
 */
export function query<TInput, TOutput>(
  name: string,
  schema: StandardSchemaV1<TInput, TOutput>,
): RouteMatcher {
  return {
    type: "query",
    paramName: name,
    schema,
    parser: new Parser((state) => success({ name, schema }, state)), // schema is passed to _processParams
    build: (params) =>
      params[name] !== undefined
        ? `${name}=${encodeURIComponent(params[name])}`
        : null,
  };
}

/**
 * Declares an optional query parameter. The provided Standard Schema should handle optionality.
 * @param name The name of the query parameter.
 * @param schema A StandardSchema for the parameter's type if it exists (e.g., a schema for string | undefined).
 * @example
 * // Matches "/search?q=term" or "/search". `params.q` will be string or undefined if schema allows.
 * // const searchRoute = route(path('search'), query.optional('q', YourOptionalStringSchema)); // Example usage
 */
query.optional = <TInput, TOutput>(
  name: string,
  schema: StandardSchemaV1<TInput, TOutput>,
): RouteMatcher => {
  // Standard Schema doesn't have a generic .optional() modifier like Zod.
  // The schema itself must define optionality (e.g. by allowing `undefined` input/output).
  return query(name, schema);
};

/** A matcher that ensures the path has no remaining segments to parse. */
export const end: RouteMatcher = { type: "end", parser: eof, build: () => "" };

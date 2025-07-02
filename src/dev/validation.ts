// =================================================================
//
//      Combi-Router: Route Validation and Dev Warnings
//
//      This module contains development-time route validation and
//      warning utilities.
//
// =================================================================

import type { Route } from '../core/types';

// =================================================================
// ---------------- ROUTE VALIDATION & DEV WARNINGS --------------
// =================================================================

/**
 * Validates a route configuration and provides detailed warnings
 * for potential issues in development.
 * @param route The route to validate
 * @returns Array of validation issues found
 */
export function validateRoute(route: Route<any>): string[] {
  const issues: string[] = [];
  
  // Check for duplicate parameter names
  const paramNames = route.paramNames;
  const duplicates = paramNames.filter((name: string, index: number) => paramNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    issues.push(`Duplicate parameter names found: ${duplicates.join(', ')}`);
  }

  // Check for invalid matcher combinations
  const wildcardCount = route.matchers.filter((m: any) => m.type === 'wildcard').length;
  if (wildcardCount > 1) {
    issues.push('Routes cannot have more than one wildcard matcher');
  }

  // Wildcard should be last path matcher
  const wildcardIndex = route.matchers.findIndex((m: any) => m.type === 'wildcard');
  if (wildcardIndex !== -1) {
    const hasPathAfterWildcard = route.matchers
      .slice(wildcardIndex + 1)
      .some((m: any) => m.type === 'path' || m.type === 'param');
    
    if (hasPathAfterWildcard) {
      issues.push('Wildcard matcher must be the last path-related matcher');
    }
  }

  // Check for end matcher not being last
  const endIndex = route.matchers.findIndex((m: any) => m.type === 'end');
  if (endIndex !== -1 && endIndex !== route.matchers.length - 1) {
    issues.push('End matcher should be the last matcher (this route will never match)');
  }

  return issues;
}

/**
 * Validates an array of routes and logs warnings for any issues found.
 * This is useful during development to catch configuration problems early.
 * @param routes Array of routes to validate
 */
export function validateRoutes(routes: Route<any>[]): void {
  if (process.env.NODE_ENV === 'production') return;
  
  for (const route of routes) {
    const issues = validateRoute(route);
    if (issues.length > 0) {
      console.warn(`[CombiRouter] Route ${route.id} validation issues:`, issues);
    }
  }
}

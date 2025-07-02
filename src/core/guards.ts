// =================================================================
//
//      Combi-Router: Guard Types and Typed Guard Implementation
//
//      This module contains guard-related functionality and the
//      typed guard system.
//
// =================================================================

import type { 
  RouteGuard, 
  TypedRouteGuard, 
  GuardContext, 
  GuardResult, 
  RouteMatch
} from './types';
import { Route } from './route';

// =================================================================
// ----------------- HIGHER-ORDER ENHANCERS ----------------------
// =================================================================

export function guard<TParams>(...guardFns: RouteGuard[]) {
  return (r: Route<TParams>): Route<TParams> => {
    const existingGuards = r.metadata.guards || [];
    return new Route(r.matchers, { ...r.metadata, guards: [...existingGuards, ...guardFns] }, r.name);
  };
}

/**
 * Creates a typed guard function with better type safety and context.
 * @param guardFn The guard function to wrap
 * @returns A typed guard that can be used with routes
 * @example
 * const authGuard = typedGuard<{ userId: string }>(({ params, to, from }) => {
 *   return isAuthenticated() || '/login';
 * });
 */
export function typedGuard<TParams = any>(guardFn: TypedRouteGuard<TParams>) {
  return (context: { to: RouteMatch<any>, from: RouteMatch<any> | null }): GuardResult => {
    const guardContext: GuardContext<TParams> = {
      to: context.to,
      from: context.from,
      params: context.to.params,
      searchParams: new URLSearchParams(context.to.search)
    };
    return guardFn(guardContext);
  };
}

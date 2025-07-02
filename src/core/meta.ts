// =================================================================
//
//      Combi-Router: Metadata and Higher-Order Route Enhancers
//
//      This module contains the meta system and higher-order functions
//      for enhancing routes with metadata.
//
// =================================================================

import { Parser, success } from '@doeixd/combi-parse';
import type { RouteMatcher, RouteMetadata, LoaderContext } from './types';
import { Route } from './route';

// =================================================================
// ----------------- HIGHER-ORDER ENHANCERS ----------------------
// =================================================================

export function meta<TParams>(metadata: RouteMetadata): RouteMatcher & ((r: Route<TParams>) => Route<TParams>) {
  const metaMatcher: RouteMatcher = {
    type: 'meta',
    parser: new Parser((state) => success(metadata, state)),
    build: () => ''
  };
  
  const higherOrderFn = (r: Route<TParams>): Route<TParams> => {
    // Use the metadata from the closure, not from the parser
    const combinedMetadata = { ...r.metadata, ...metadata };
    
    // Filter out meta matchers when using as higher-order function to avoid re-processing old metadata
    const nonMetaMatchers = r.matchers.filter(m => m.type !== 'meta');
    return new Route(nonMetaMatchers, combinedMetadata, r.name);
  };
  
  return Object.assign(higherOrderFn, metaMatcher);
}

export function loader<TParams>(loaderFn: (context: LoaderContext<TParams>) => Promise<any> | any) {
  return meta<TParams>({ loader: loaderFn as any });
}

export function layout<TParams>(layoutComponent: any) {
  return meta<TParams>({ layout: layoutComponent });
}

export function lazy<TParams>(importFn: () => Promise<{ default: any }>, options: Omit<Exclude<RouteMetadata['lazy'], undefined>, 'import'> = {}) {
    return meta<TParams>({ lazy: { import: importFn, ...options } });
}

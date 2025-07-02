// =================================================================
//
//      Combi-Router: A Composable, Type-Safe Router
//
//      This file provides the complete, final, and production-ready
//      implementation. It emphasizes functional composition, reference-based
//      navigation, and end-to-end type safety. This version includes
//      advanced features like true hierarchical matching, parallel data loading,
//      suspense, and View Transitions for a modern, high-performance
//      user experience.
//
// =================================================================

// =================================================================
     ----------------------- CORE EXPORTS ---------------------------
     =================================================================
    
     Core types and interfaces
    port type {
    Resource,
    ResourceStatus,
    InferParams,
    RouteMatch,
  RouteMatcher,
  RouteMetadata,
  LoaderContext,
  RouteGuard,
  ErrorContext,
  RouterOptions,
  NavigationError,
  NavigationResult,
  NavigationController,
  GuardContext,
  GuardResult,
  TypedRouteGuard,
  InferMatcherParams,
  StandardSchemaV1,
  StandardSchemaV1Namespace,
  Parser,
  Success
} from './core/types';
    
     Error classes and enums
     ort { RouteValidationError, NavigationErrorType } from './core/types';
     
     Route class and building functions
     ort { Route, route, extend, pipe } from './core/route';
    
     Route matchers
    port { path, param, query, end } from './core/matchers';

// Router class and factory
export { CombiRouter, createRouter } from './core/router';
 
// Guards
export { guard, typedGuard } from './core/guards';
 
 / Meta enhancers
 xport { meta, loader, layout, lazy } from './core/meta';
 
 / =================================================================
 / ----------------------- DATA EXPORTS ---------------------------
 / =================================================================
 
 / Resource/Suspense system
 xport { createResource, SuspensePromise } from './data/resource';
 
 / Cache utilities
 xport { cache } from './data/cache';
 
 / =================================================================
 / ----------------------- DEV EXPORTS ----------------------------
 / =================================================================
 
 / Development validation (only in dev builds)
 xport { validateRoute, validateRoutes } from './dev/validation';
 
// Debugging utilities (only in dev builds)
    port { 
    inspectRoute, 
    inspectMatch, 
        sualizeRouteTree, 
        bugRouter, 
    monitorNavigation 
} from './dev/debugging';
    
        ================================================================
        ---------------------- UTILITY EXPORTS ------------------------
            ==============================================================
                
                work-agnostic integration helpers
                 from './utils';
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
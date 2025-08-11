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
// ----------------------- CORE EXPORTS ---------------------------
// =================================================================

// Core types and interfaces
export type {
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
  Success,
} from "./core/types";

// Error classes and enums
export { RouteValidationError, NavigationErrorType } from "./core/types";

// Route class and building functions
export { Route, route, extend, pipe } from "./core/route";

// Route matchers
export { path, param, query, end } from "./core/matchers";

// Router class and factory
export { CombiRouter, createRouter } from "./core/router";

// Guards
export { guard, typedGuard } from "./core/guards";

// Meta enhancers
export { meta, loader, layout, lazy } from "./core/meta";

// =================================================================
// ----------------------- DATA EXPORTS ---------------------------
// =================================================================

// Resource/Suspense system
export { createResource, SuspensePromise } from "./data/resource";

// Cache utilities
export { cache } from "./data/cache";

// =================================================================
// ----------------------- DEV EXPORTS ----------------------------
// =================================================================

// Development validation (only in dev builds)
export { validateRoute, validateRoutes } from "./dev/validation";

// Debugging utilities (only in dev builds)
export {
  inspectRoute,
  inspectMatch,
  visualizeRouteTree,
  debugRouter,
  monitorNavigation,
} from "./dev/debugging";

// =================================================================
// ---------------------- UTILITY EXPORTS ------------------------
// =================================================================

// Framework-agnostic integration helpers
export * from "./utils";

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
  AdvancedResource,
  ResourceConfig,
  RetryConfig,
  CacheConfig,
  ResourceEvent,
  GlobalResourceState,
  CacheEntry,
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
  ViewContext,
  ViewFactory,
} from "./core/types";

// Error classes and enums
export { RouteValidationError, NavigationErrorType } from "./core/types";

// Route class and building functions
export { Route, route, extend, pipe } from "./core/route";

// Route matchers
export { path, param, query, end } from "./core/matchers";

// Router class and factory (backwards compatible - uses layered implementation)
export { CombiRouter, createRouter } from "./core/router-compat";

// New composable API exports
export {
  createLayeredRouter,
  createComposableRouter,
  conditionalLayer,
  identityLayer,
  makeLayered,
} from "./core/layered-router";

// Layer system exports
export * from "./layers";

// Guards
export { guard, typedGuard } from "./core/guards";

// Meta enhancers
export { meta, loader, layout, lazy, view } from "./core/meta";

// =================================================================
// ----------------------- DATA EXPORTS ---------------------------
// =================================================================

// Resource/Suspense system
export {
  createResource,
  createAdvancedResource,
  resourceState,
  SuspensePromise,
} from "./data/resource";

// Cache utilities
export { cache, AdvancedCache, globalCache } from "./data/cache";

// =================================================================
// ----------------------- DEV EXPORTS ----------------------------
// =================================================================

// Development validation (only in dev builds)
export { validateRoute, validateRoutes } from "./dev/validation";

// Enhanced debugging utilities (only in dev builds)
export {
  inspectRoute,
  inspectMatch,
  visualizeRouteTree,
  debugRouter,
  monitorNavigation,
  RouterDebugger,
  createDebugger,
  analyzeRouterStructure,
} from "./dev/debugging";

// Warning system (only in dev builds)
export {
  DevWarningSystem,
  createWarningSystem,
  analyzeRoutes,
  WarningType,
  WarningSeverity,
} from "./dev/warnings";

// Conflict detection (only in dev builds)
export {
  RouteConflictDetector,
  analyzeRouteConflicts,
  logRouteConflicts,
  findConflicts,
  ConflictType,
} from "./dev/conflicts";

// Performance monitoring (only in dev builds)
export {
  PerformanceMonitor,
  createPerformanceMonitor,
  logPerformanceMetrics,
} from "./dev/performance";

// Comprehensive dev mode (only in dev builds)
export {
  CombiRouterDevMode,
  enableDevMode,
  analyzeRouter,
  createDevTools,
  exposeDevTools,
} from "./dev/index";

// Dev mode types
export type {
  DevModeConfig,
  DevModeFeatures,
  WarningConfig,
  PerformanceConfig,
  DevWarning,
  RouteConflict,
  ConflictAnalysis,
  NavigationTiming,
  LoaderTiming,
  GuardTiming,
  PerformanceMetrics,
  PerformanceInsights,
  RouteAnalysis,
  NavigationTrace,
  NavigationStep,
  MatchInspection,
  ValidationReport,
  Optimization,
} from "./dev/index";

// =================================================================
// ---------------------- PRODUCTION FEATURES ---------------------
// =================================================================

// Production features for modern web applications
export * from "./features";

// =================================================================
// ----------------------- UTILITY EXPORTS ------------------------
// =================================================================

// Framework-agnostic integration helpers
export * from "./utils";

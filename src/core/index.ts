// =================================================================
//
//      Combi-Router: Core Module Exports
//
//      This module exports all core router functionality for
//      fine-grained imports and better tree-shaking.
//
// =================================================================

// Core types and interfaces
export type * from './types';

// Error classes and enums
export { RouteValidationError, NavigationErrorType } from './types';

// Route class and building functions
export { Route, route, extend, pipe } from './route';

// Route matchers
export { path, param, query, end } from './matchers';

// Router class and factory
export { CombiRouter, createRouter } from './router';

// Guards
export { guard, typedGuard } from './guards';

// Meta enhancers
export { meta, loader, layout, lazy } from './meta';

// Parser utilities
export { buildRouteParser } from './parser';

// Validation utilities  
export { validateWithStandardSchemaSync } from './validation';

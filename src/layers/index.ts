// =================================================================
//
//      Combi-Router: Layer System Exports
//
//      Centralized exports for all router layers
//
// =================================================================

// Core layer system
export * from "./performance";
export * from "./scroll-restoration";
export * from "./code-splitting";
export * from "./transitions";
export * from "./head";
export * from "./dev";
export * from "./data";
export * from "./loader";
export * from "./view";

// Re-export layer types
export * from "../core/layer-types";

// Re-export layered router implementation
export * from "../core/layered-router";

// Core layer exports (explicit to avoid conflicts)
export {
  createCoreNavigationLayer,
  type CoreNavigationExtensions,
} from "./core";

// Convenience re-exports (already exported above)

export { createPerformanceLayer, withPerformance } from "./performance";

export {
  createScrollRestorationLayer,
  withScrollRestoration,
} from "./scroll-restoration";

export { createCodeSplittingLayer, withCodeSplitting } from "./code-splitting";

export { createTransitionsLayer, withTransitions } from "./transitions";

export { createHeadManagementLayer, withHeadManagement } from "./head";

export { devLayer, quickDevLayer } from "./dev";

export { dataLayer, quickDataLayer } from "./data";

export {
  createLoaderLayer,
  quickLoaderLayer,
  simpleLoaderLayer,
} from "./loader";

export { createViewLayer } from "./view";

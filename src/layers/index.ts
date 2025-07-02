// =================================================================
//
//      Combi-Router: Layer System Exports
//
//      Centralized exports for all router layers
//
// =================================================================

// Core layer system
export * from './core';
export * from './performance';
export * from './scroll-restoration';
export * from './code-splitting';
export * from './transitions';
export * from './head';
export * from './dev';
export * from './data';

// Re-export layer types
export * from '../core/layer-types';

// Re-export layered router implementation
export * from '../core/layered-router';

// Convenience re-exports
export {
  createCoreNavigationLayer
} from './core';

export {
  createPerformanceLayer,
  withPerformance
} from './performance';

export {
  createScrollRestorationLayer,
  withScrollRestoration
} from './scroll-restoration';

export {
  createCodeSplittingLayer,
  withCodeSplitting
} from './code-splitting';

export {
  createTransitionsLayer,
  withTransitions
} from './transitions';

export {
  createHeadManagementLayer,
  withHeadManagement
} from './head';

export {
  devLayer,
  quickDevLayer
} from './dev';

export {
  dataLayer,
  quickDataLayer
} from './data';

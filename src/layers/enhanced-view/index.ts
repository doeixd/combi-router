// =================================================================
//
//      Combi-Router: Enhanced View Layer - Main Export
//
//      Central export point for all enhanced view layer features
//
// =================================================================

// Core enhanced view layer
export {
  createEnhancedViewLayer,
  type EnhancedViewLayerConfig,
  type EnhancedViewLayerExtensions,
  type EnhancedViewFactory,
  type TemplateResult,
  type HTMLTemplateResult,
  type RouterOutlet,
  type MorphdomOptions
} from './enhanced-view';

// Enhanced meta functions for route configuration
export {
  enhancedView,
  view, // Alias for backward compatibility
  htmlTemplate,
  lazyView,
  conditionalView,
  errorBoundaryView,
  composeViews,
  streamingView,
  cachedView
} from './enhanced-meta';

// Re-export morphdom integration utilities
export { createMorphdomIntegration } from './morphdom-integration';

// Re-export nested routing utilities
export { createNestedRouter, createRouterOutlet } from './nested-routing';

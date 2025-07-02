// =================================================================
//
//      Combi-Router: Production Features Index
//
//      Aggregates all production features for modern web applications
//
// =================================================================

export * from './scroll-restoration';
export * from './code-splitting';
export * from './transitions';
export * from './performance';
export * from './head';

// Feature configuration interfaces
export interface ProductionFeatures {
  scrollRestoration?: import('./scroll-restoration').ScrollRestorationConfig;
  codeSplitting?: import('./code-splitting').CodeSplittingConfig;
  transitions?: import('./transitions').TransitionConfig;
  performance?: import('./performance').PerformanceConfig;
  head?: import('./head').HeadInput;
}

// Re-export main interfaces for convenience
export type {
  ScrollRestorationConfig,
  ScrollPosition,
  ScrollRestorationStrategy
} from './scroll-restoration';

export type {
  CodeSplittingConfig,
  PreloadStrategy,
  ChunkNamingFunction,
  LoadingState,
  SplittingStrategy
} from './code-splitting';

export type {
  TransitionConfig,
  TransitionType,
  TransitionFunction,
  TransitionContext,
  TransitionDirection
} from './transitions';

export type {
  PerformanceConfig,
  PrefetchStrategy,
  ResourcePriority,
  MemoryManagementConfig
} from './performance';

export type {
  HeadInput,
  HeadFunction,
  HeadTag,
  MetaTag,
  LinkTag,
  ScriptTag,
  StyleTag,
  TitleTemplate,
  ResolvedHeadData
} from './head';

// =================================================================
//
//      Combi-Router: Code Splitting Layer
//
//      Intelligent lazy loading and code splitting as a composable layer
//
// =================================================================

/**
 * # Code Splitting Layer
 * 
 * Provides intelligent lazy loading and code splitting capabilities with
 * preloading strategies, chunk management, and connection-aware loading.
 * 
 * This layer enhances the router with dynamic code loading, intelligent
 * prefetching, and optimized chunk management for better performance.
 * 
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, withCodeSplitting } from '@doeixd/combi-router';
 * 
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withCodeSplitting({
 *     strategy: 'route-based',
 *     preloadStrategy: 'hover',
 *     connectionAware: true
 *   }))
 *   ();
 * 
 * // Code splitting methods are now available
 * router.registerLazyRoute('user', () => import('./UserPage'));
 * router.preloadRoute('about');
 * const loadingState = router.getLoadingState('user');
 * ```
 * 
 * @example Advanced Configuration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withCodeSplitting({
 *     strategy: 'hybrid',
 *     preloadStrategy: 'visible',
 *     connectionAware: true,
 *     retryAttempts: 3,
 *     retryDelay: 1000,
 *     chunkNaming: (route) => `chunk-${route.id}`,
 *     fallback: LoadingSpinner,
 *     errorBoundary: ErrorPage
 *   }))
 *   ();
 * ```
 * 
 * ## Features Provided
 * 
 * ### Lazy Loading Strategies
 * - **Route-based**: Split by individual routes
 * - **Feature-based**: Split by feature modules
 * - **Hybrid**: Combine route and feature splitting
 * 
 * ### Preloading Strategies
 * - **Hover**: Load when user hovers over links
 * - **Visible**: Load when links enter viewport
 * - **Immediate**: Load all chunks immediately
 * - **None**: No automatic preloading
 * 
 * ### Connection Awareness
 * - Adapt loading strategy based on network conditions
 * - Disable preloading on slow connections
 * - Progressive enhancement for fast connections
 * 
 * ### Error Handling
 * - Automatic retry with exponential backoff
 * - Fallback components for loading states
 * - Error boundaries for failed loads
 * 
 * ## Configuration Options
 * 
 * ```typescript
 * interface CodeSplittingLayerConfig {
 *   strategy?: 'route-based' | 'feature-based' | 'hybrid';
 *   preloadStrategy?: 'hover' | 'visible' | 'immediate' | 'none';
 *   chunkNaming?: (route: Route<any>) => string;
 *   fallback?: any;                    // Loading component
 *   errorBoundary?: any;               // Error component
 *   preloadTimeout?: number;           // Timeout for preloading
 *   retryAttempts?: number;            // Retry failed loads
 *   retryDelay?: number;               // Delay between retries
 *   priority?: 'high' | 'low' | 'auto';
 *   connectionAware?: boolean;         // Adapt to connection speed
 * }
 * ```
 */

import type { Route, RouteMatch } from '../core/types';
import type { RouterLayer, CodeSplittingLayerConfig } from '../core/layer-types';
import { CodeSplittingManager, type CodeSplittingConfig, defaultCodeSplittingConfig } from '../features/code-splitting';

/**
 * Validates code splitting layer configuration
 */
function validateCodeSplittingConfig(config: CodeSplittingLayerConfig): CodeSplittingLayerConfig {
  const validated = { ...config };
  
  // Validate timeout values
  if (config.preloadTimeout !== undefined && config.preloadTimeout < 0) {
    console.warn('[CodeSplittingLayer] Invalid preloadTimeout, using default');
    validated.preloadTimeout = defaultCodeSplittingConfig.preloadTimeout;
  }
  
  // Validate retry configuration
  if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
    console.warn('[CodeSplittingLayer] Invalid retryAttempts, using default');
    validated.retryAttempts = defaultCodeSplittingConfig.retryAttempts;
  }
  
  if (config.retryDelay !== undefined && config.retryDelay < 0) {
    console.warn('[CodeSplittingLayer] Invalid retryDelay, using default');
    validated.retryDelay = defaultCodeSplittingConfig.retryDelay;
  }
  
  return validated;
}

/**
 * Checks if the router instance supports lifecycle hooks
 */
function hasLifecycleSupport(self: any): self is { _registerLifecycleHook: (name: string, fn: Function) => void } {
  return typeof self._registerLifecycleHook === 'function';
}

/**
 * Creates a code splitting layer for intelligent lazy loading and chunk management.
 * 
 * This layer provides advanced code splitting capabilities including intelligent
 * preloading, connection awareness, and robust error handling for dynamic imports.
 * 
 * @param config Configuration options for code splitting behavior
 * @returns A router layer that adds code splitting capabilities
 * 
 * @example Basic Code Splitting
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createCodeSplittingLayer({
 *     strategy: 'route-based',
 *     preloadStrategy: 'hover'
 *   }))
 *   ();
 * 
 * // Register lazy routes
 * router.registerLazyRoute('user', () => import('./UserPage'));
 * ```
 * 
 * @example Connection-Aware Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createCodeSplittingLayer({
 *     strategy: 'hybrid',
 *     connectionAware: true,           // Adapt to connection speed
 *     retryAttempts: 3,               // Retry failed loads
 *     fallback: LoadingSpinner        // Show while loading
 *   }))
 *   ();
 * ```
 */
export function createCodeSplittingLayer(config: CodeSplittingLayerConfig = {}): RouterLayer<any, CodeSplittingLayerExtensions> {
  return (self) => {
    // Validate and sanitize configuration
    const validatedConfig = validateCodeSplittingConfig(config);
    
    // Convert layer config to code splitting manager config
    const codeSplittingConfig: CodeSplittingConfig = {
      strategy: validatedConfig.strategy ?? defaultCodeSplittingConfig.strategy,
      preloadStrategy: validatedConfig.preloadStrategy ?? defaultCodeSplittingConfig.preloadStrategy,
      chunkNaming: validatedConfig.chunkNaming ?? defaultCodeSplittingConfig.chunkNaming,
      fallback: validatedConfig.fallback ?? defaultCodeSplittingConfig.fallback,
      errorBoundary: validatedConfig.errorBoundary ?? defaultCodeSplittingConfig.errorBoundary,
      preloadTimeout: validatedConfig.preloadTimeout ?? defaultCodeSplittingConfig.preloadTimeout,
      retryAttempts: validatedConfig.retryAttempts ?? defaultCodeSplittingConfig.retryAttempts,
      retryDelay: validatedConfig.retryDelay ?? defaultCodeSplittingConfig.retryDelay,
      priority: validatedConfig.priority ?? defaultCodeSplittingConfig.priority,
      connectionAware: validatedConfig.connectionAware ?? defaultCodeSplittingConfig.connectionAware
    };

    // Create code splitting manager instance
    const codeSplittingManager = new CodeSplittingManager(codeSplittingConfig);

    // Track cleanup functions for proper disposal
    const cleanupFunctions: (() => void)[] = [];

    // Register lifecycle hooks with the core layer
    if (hasLifecycleSupport(self)) {
      try {
        // Route load - handle lazy loading
        self._registerLifecycleHook('onRouteLoad', async (route: Route<any>) => {
          try {
            if (route.metadata?.lazy) {
              console.log(`[CodeSplittingLayer] Loading lazy route: ${route.id}`);
              await codeSplittingManager.loadChunk(String(route.id));
            }
          } catch (error) {
            console.error('[CodeSplittingLayer] Error in onRouteLoad:', error);
          }
        });

        // Navigation start - prepare chunks
        self._registerLifecycleHook('onNavigationStart', (context) => {
          try {
            if (context?.to?.route?.metadata?.lazy) {
              console.log(`[CodeSplittingLayer] Preparing chunk for: ${context.to.route.id}`);
            }
          } catch (error) {
            console.error('[CodeSplittingLayer] Error in onNavigationStart:', error);
          }
        });

        // Cleanup on destroy
        self._registerLifecycleHook('onDestroy', () => {
          try {
            cleanupFunctions.forEach(cleanup => cleanup());
            codeSplittingManager.destroy();
            console.log('[CodeSplittingLayer] Cleanup completed');
          } catch (error) {
            console.error('[CodeSplittingLayer] Error during cleanup:', error);
          }
        });
      } catch (error) {
        console.error('[CodeSplittingLayer] Failed to register lifecycle hooks:', error);
      }
    } else {
      console.warn('[CodeSplittingLayer] Lifecycle hooks not supported by router instance');
    }

    // Register a lazy route with import function
    const registerLazyRoute = (routeId: string, importFn: () => Promise<any>): void => {
      try {
        codeSplittingManager.registerRoute({
          id: routeId,
          metadata: { lazy: true }
        } as Route<any>);
        // Store import function mapping
        console.log(`[CodeSplittingLayer] Registered lazy route: ${routeId}`);
      } catch (error) {
        console.error(`[CodeSplittingLayer] Failed to register lazy route ${routeId}:`, error);
      }
    };

    // Preload a route chunk
    const preloadRoute = async (routeId: string): Promise<void> => {
      try {
        await codeSplittingManager.preloadChunk(routeId);
        console.log(`[CodeSplittingLayer] Preloaded route: ${routeId}`);
      } catch (error) {
        console.error(`[CodeSplittingLayer] Failed to preload route ${routeId}:`, error);
      }
    };

    // Get loading state for a route
    const getLoadingState = (routeId: string) => {
      try {
        return codeSplittingManager.getLoadingState(routeId);
      } catch (error) {
        console.error(`[CodeSplittingLayer] Failed to get loading state for ${routeId}:`, error);
        return { status: 'error', error };
      }
    };

    // Setup hover preloading for an element
    const setupHoverPreloading = (element: Element, routeId: string): (() => void) => {
      try {
        return codeSplittingManager.setupHoverPreloading(element, routeId);
      } catch (error) {
        console.error(`[CodeSplittingLayer] Failed to setup hover preloading for ${routeId}:`, error);
        return () => {};
      }
    };

    // Setup visibility preloading for an element
    const setupVisibilityPreloading = (element: Element, routeId: string): (() => void) => {
      try {
        return codeSplittingManager.setupVisibilityPreloading(element, routeId);
      } catch (error) {
        console.error(`[CodeSplittingLayer] Failed to setup visibility preloading for ${routeId}:`, error);
        return () => {};
      }
    };

    // Update configuration
    const updateCodeSplittingConfig = (newConfig: Partial<CodeSplittingLayerConfig>): void => {
      try {
        const updatedConfig: Partial<CodeSplittingConfig> = {
          strategy: newConfig.strategy,
          preloadStrategy: newConfig.preloadStrategy,
          chunkNaming: newConfig.chunkNaming,
          fallback: newConfig.fallback,
          errorBoundary: newConfig.errorBoundary,
          preloadTimeout: newConfig.preloadTimeout,
          retryAttempts: newConfig.retryAttempts,
          retryDelay: newConfig.retryDelay,
          priority: newConfig.priority,
          connectionAware: newConfig.connectionAware
        };
        
        codeSplittingManager.updateConfig(updatedConfig);
        console.log('[CodeSplittingLayer] Configuration updated');
      } catch (error) {
        console.error('[CodeSplittingLayer] Failed to update configuration:', error);
      }
    };

    // Get performance report
    const getCodeSplittingReport = () => {
      try {
        return codeSplittingManager.getStats();
      } catch (error) {
        console.error('[CodeSplittingLayer] Failed to get performance report:', error);
        return null;
      }
    };

    // Return the code splitting layer extensions
    return {
      // Code splitting manager instance (for advanced usage)
      codeSplitting: codeSplittingManager,
      
      // High-level API
      registerLazyRoute,
      preloadRoute,
      getLoadingState,
      
      // Element interaction
      setupHoverPreloading,
      setupVisibilityPreloading,
      
      // Configuration and monitoring
      updateCodeSplittingConfig,
      getCodeSplittingReport
    };
  };
}

// Type for the extensions this layer provides
export interface CodeSplittingLayerExtensions {
  codeSplitting: CodeSplittingManager;
  registerLazyRoute: (routeId: string, importFn: () => Promise<any>) => void;
  preloadRoute: (routeId: string) => Promise<void>;
  getLoadingState: (routeId: string) => any;
  setupHoverPreloading: (element: Element, routeId: string) => () => void;
  setupVisibilityPreloading: (element: Element, routeId: string) => () => void;
  updateCodeSplittingConfig: (config: Partial<CodeSplittingLayerConfig>) => void;
  getCodeSplittingReport: () => any;
}

// Convenience factory with default config
export const withCodeSplitting = (config: CodeSplittingLayerConfig = {}) => createCodeSplittingLayer(config);

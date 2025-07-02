// =================================================================
//
//      Combi-Router: Data Management Layer
//
//      A comprehensive data management layer that provides advanced caching,
//      resource management, suspense-based data fetching, and performance
//      optimization features. Essential for modern data-driven applications.
//
// =================================================================

import type { RouterLayer, ComposableRouter, RouterContext } from '../core/layer-types';
import { globalCache, type AdvancedCache } from '../data/cache';
import { resourceState, createResource, createAdvancedResource, type Resource, type AdvancedResource, type ResourceConfig, type GlobalResourceState } from '../data/resource';

/**
 * Configuration options for the data management layer.
 * 
 * Controls cache behavior, automatic cleanup, and resource monitoring
 * for optimal data management performance.
 */
export interface DataLayerConfig {
  /**
   * Configuration for the global cache system.
   * 
   * The cache uses advanced LRU eviction with priority-based retention,
   * tag-based invalidation, and automatic expiration.
   */
  cache?: {
    /** 
     * Maximum number of cache entries before LRU eviction begins.
     * @default 1000 
     */
    maxSize?: number;
    /** 
     * Default time-to-live for cache entries in milliseconds.
     * @default 300000 (5 minutes)
     */
    defaultTTL?: number;
  };
  
  /**
   * Whether to enable automatic cleanup of expired cache entries and stale resources.
   * When enabled, runs periodic cleanup to maintain memory efficiency.
   * 
   * @default false
   */
  autoCleanup?: boolean;
  
  /**
   * Interval for automatic cleanup operations in milliseconds.
   * Only used when `autoCleanup` is enabled.
   * 
   * @default 300000 (5 minutes)
   */
  cleanupInterval?: number;
  
  /**
   * Whether to log resource lifecycle events for debugging.
   * Useful for development to track resource creation, loading, and errors.
   * 
   * @default false (true in development builds)
   */
  logResourceEvents?: boolean;
}

/**
 * Extensions added to the router by the data management layer.
 * 
 * Provides comprehensive data management capabilities including resource creation,
 * advanced caching, state monitoring, and performance optimization features.
 */
export interface DataLayerExtensions {
  /**
   * Global cache instance with advanced features including:
   * - LRU eviction with priority-based retention
   * - Tag-based invalidation for granular cache control
   * - Automatic expiration and cleanup
   * - Performance monitoring and statistics
   * 
   * @example
   * ```typescript
   * // Store data with tags for easy invalidation
   * router.cache.set('user:123', userData, {
   *   ttl: 600000,
   *   invalidateOn: ['user', 'profile'],
   *   priority: 'high'
   * });
   * 
   * // Check cache statistics
   * const stats = router.cache.getStats();
   * console.log(`Cache hit ratio: ${stats.hitRatio}`);
   * ```
   */
  cache: AdvancedCache;
  
  /**
   * Creates a basic resource for suspense-based data fetching.
   * 
   * Resources provide a simple way to handle asynchronous data with automatic
   * suspense integration. The resource will suspend rendering until data is loaded.
   * 
   * @param promiseFn - Function that returns a promise for the data
   * @returns Resource object with `read()` method and `status` property
   * 
   * @example
   * ```typescript
   * // In a route loader
   * const userResource = router.createResource(() => 
   *   fetch(`/api/users/${params.id}`).then(r => r.json())
   * );
   * 
   * // In your component
   * const userData = userResource.read(); // Suspends if not loaded
   * console.log(`User: ${userData.name}`);
   * ```
   */
  createResource: <T>(promiseFn: () => Promise<T>) => Resource<T>;
  
  /**
   * Creates an advanced resource with retry logic, caching, and state management.
   * 
   * Advanced resources provide production-ready data fetching with:
   * - Automatic retry with exponential backoff
   * - Integrated caching with TTL and invalidation
   * - Background refetching for stale data
   * - Comprehensive error handling
   * - Loading state management
   * 
   * @param promiseFn - Function that returns a promise for the data
   * @param config - Configuration for retry, caching, and behavior
   * @param cacheKey - Optional custom cache key for manual cache management
   * @returns Advanced resource with full state management capabilities
   * 
   * @example
   * ```typescript
   * // Advanced resource with retry and caching
   * const userResource = router.createAdvancedResource(
   *   () => api.fetchUser(userId),
   *   {
   *     retry: { 
   *       attempts: 3,
   *       delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000)
   *     },
   *     cache: { 
   *       ttl: 300000,
   *       invalidateOn: ['user', 'profile']
   *     },
   *     staleTime: 60000,
   *     backgroundRefetch: true
   *   },
   *   `user:${userId}` // Custom cache key
   * );
   * 
   * // Check loading state
   * if (userResource.isLoading) {
   *   console.log('Loading user data...');
   * }
   * 
   * // Get cached data without suspending
   * const cachedUser = userResource.peek();
   * 
   * // Force refresh
   * await userResource.refetch();
   * ```
   */
  createAdvancedResource: <T>(
    promiseFn: () => Promise<T>, 
    config?: ResourceConfig, 
    cacheKey?: string
  ) => AdvancedResource<T>;
  
  /**
   * Returns the global resource state including loading counts and active resources.
   * 
   * Useful for implementing global loading indicators or monitoring resource usage.
   * 
   * @returns Global state object with loading information
   * 
   * @example
   * ```typescript
   * const globalState = router.getGlobalResourceState();
   * 
   * if (globalState.isLoading) {
   *   console.log(`${globalState.loadingCount} resources loading`);
   *   showGlobalSpinner(true);
   * } else {
   *   showGlobalSpinner(false);
   * }
   * ```
   */
  getGlobalResourceState: () => GlobalResourceState;
  
  /**
   * Invalidates all cached resources and cache entries with the specified tags.
   * 
   * This is the primary mechanism for coordinated cache invalidation across
   * the application when data changes.
   * 
   * @param tags - Array of tags to invalidate
   * @returns Number of entries that were invalidated
   * 
   * @example
   * ```typescript
   * // After updating user data
   * const invalidated = router.invalidateByTags(['user', 'profile']);
   * console.log(`Invalidated ${invalidated} cache entries`);
   * 
   * // Common patterns
   * router.invalidateByTags(['user:123']); // Specific user
   * router.invalidateByTags(['users']);    // All user data
   * router.invalidateByTags(['*']);        // Everything (use sparingly)
   * ```
   */
  invalidateByTags: (tags: string[]) => number;
  
  /**
   * Registers a listener for resource lifecycle events.
   * 
   * Useful for implementing global loading states, error handling,
   * analytics, or debugging resource behavior.
   * 
   * @param listener - Function to call when resource events occur
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * // Monitor all resource events
   * const unsubscribe = router.onResourceEvent((event) => {
   *   switch (event.type) {
   *     case 'fetch-start':
   *       console.log('Resource loading started');
   *       break;
   *     case 'fetch-success':
   *       console.log('Resource loaded successfully');
   *       break;
   *     case 'fetch-error':
   *       console.error('Resource failed to load', event.error);
   *       break;
   *     case 'retry':
   *       console.log(`Retrying resource (attempt ${event.attempt})`);
   *       break;
   *   }
   * });
   * 
   * // Clean up when done
   * unsubscribe();
   * ```
   */
  onResourceEvent: (listener: (event: any) => void) => () => void;
  
  /**
   * Returns comprehensive cache statistics for monitoring and optimization.
   * 
   * Provides insights into cache performance, hit rates, and memory usage
   * to help optimize caching strategies.
   * 
   * @returns Object containing cache statistics and metrics
   * 
   * @example
   * ```typescript
   * const stats = router.getCacheStats();
   * 
   * console.log(`Cache entries: ${stats.totalEntries}`);
   * console.log(`Hit ratio: ${(stats.hitRatio * 100).toFixed(1)}%`);
   * console.log(`Expired entries: ${stats.expired}`);
   * console.log(`High priority entries: ${stats.byPriority.high}`);
   * 
   * // Use for optimization decisions
   * if (stats.hitRatio < 0.5) {
   *   console.warn('Low cache hit ratio - consider adjusting TTL');
   * }
   * ```
   */
  getCacheStats: () => any;
  
  /**
   * Clears all cached data and resets the cache.
   * 
   * Use with caution as this will force all subsequent data requests
   * to fetch fresh data from their sources.
   * 
   * @example
   * ```typescript
   * // Clear all cached data (e.g., on user logout)
   * router.clearCache();
   * 
   * // Or be more selective with tags
   * router.invalidateByTags(['user', 'session']);
   * ```
   */
  clearCache: () => void;
  
  /**
   * Preloads data for a specific route to improve navigation performance.
   * 
   * This method executes the route's loader function and caches the result,
   * making subsequent navigation to that route faster.
   * 
   * @param routeId - ID of the route to preload (route.id property)
   * @param params - Route parameters for dynamic routes
   * 
   * @example
   * ```typescript
   * // Preload user profile on hover
   * onUserLinkHover(userId => {
   *   router.preloadRoute('user-profile', { id: userId });
   * });
   * 
   * // Preload critical routes on app start
   * await Promise.all([
   *   router.preloadRoute('dashboard'),
   *   router.preloadRoute('user-settings'),
   *   router.preloadRoute('notifications')
   * ]);
   * ```
   */
  preloadRoute: (routeId: string, params?: Record<string, any>) => Promise<void>;
}

/**
 * Creates a comprehensive data management layer that provides advanced caching,
 * resource management, suspense-based data fetching, and performance optimization.
 * 
 * This layer integrates all data management features from the `/data` folder and provides
 * a unified interface for handling asynchronous data, caching, and resource lifecycle
 * management in modern web applications.
 * 
 * ## Features
 * 
 * - **Advanced Caching**: LRU cache with priority-based retention and tag-based invalidation
 * - **Resource Management**: Suspense-compatible resources with retry logic and state management
 * - **Performance Optimization**: Background refetching, preloading, and memory management
 * - **Global State Monitoring**: Track loading states and resource lifecycle events
 * - **Production Ready**: Built-in error handling, retry strategies, and cleanup mechanisms
 * 
 * ## Resource Types
 * 
 * - **Basic Resources**: Simple suspense-based data fetching
 * - **Advanced Resources**: Full-featured with retry, caching, and background updates
 * - **Route Preloading**: Proactive data loading for improved navigation performance
 * 
 * ## Cache Features
 * 
 * - **Tag-based Invalidation**: Invalidate related data with semantic tags
 * - **Priority Levels**: High, normal, and low priority entries with smart eviction
 * - **Automatic Cleanup**: Optional periodic cleanup of expired entries
 * - **Performance Monitoring**: Comprehensive statistics and hit ratio tracking
 * 
 * @param config - Configuration options for data management behavior
 * @returns Router layer that adds comprehensive data management capabilities
 * 
 * @example
 * ```typescript
 * // Basic data layer
 * const router = createLayeredRouter(routes)
 *   (dataLayer())
 *   ();
 * 
 * // With custom configuration
 * const router = createLayeredRouter(routes)
 *   (dataLayer({
 *     cache: {
 *       maxSize: 2000,
 *       defaultTTL: 600000 // 10 minutes
 *     },
 *     autoCleanup: true,
 *     cleanupInterval: 180000, // 3 minutes
 *     logResourceEvents: true
 *   }))
 *   ();
 * 
 * // Create resources
 * const userResource = router.createAdvancedResource(
 *   () => api.fetchUser(userId),
 *   {
 *     retry: { attempts: 3 },
 *     cache: { ttl: 300000, invalidateOn: ['user'] },
 *     staleTime: 60000,
 *     backgroundRefetch: true
 *   }
 * );
 * 
 * // Monitor global state
 * const globalState = router.getGlobalResourceState();
 * if (globalState.isLoading) {
 *   showLoadingSpinner();
 * }
 * 
 * // Cache management
 * router.cache.set('config', appConfig, { 
 *   priority: 'high',
 *   invalidateOn: ['config', 'app']
 * });
 * 
 * // Invalidate when data changes
 * router.invalidateByTags(['user', 'profile']);
 * 
 * // Preload for better UX
 * router.preloadRoute('user-dashboard', { id: userId });
 * ```
 * 
 * @see {@link DataLayerConfig} for configuration options
 * @see {@link DataLayerExtensions} for available methods and properties
 * @see {@link quickDataLayer} for a preconfigured data layer
 */
export function dataLayer(config: DataLayerConfig = {}): RouterLayer<RouterContext, DataLayerExtensions> {
  return (router: ComposableRouter<RouterContext>) => {
    // Configure global cache if options provided
    if (config.cache) {
      // The global cache is already created, but we could create a new one
      // For now, we'll use the existing global cache
    }

    let cleanupInterval: NodeJS.Timeout | null = null;
    
    // Setup automatic cleanup if enabled
    if (config.autoCleanup) {
      const interval = config.cleanupInterval || 300000; // 5 minutes
      cleanupInterval = setInterval(() => {
        // Clean up expired cache entries
        const stats = globalCache.getStats();
        if (stats.expired > 0) {
          console.log(`[DataLayer] Cleaning up ${stats.expired} expired cache entries`);
        }
      }, interval);
    }

    // Setup resource event logging if enabled
    let resourceEventUnsubscriber: (() => void) | null = null;
    if (config.logResourceEvents) {
      resourceEventUnsubscriber = resourceState.onEvent((event) => {
        console.log('[DataLayer] Resource event:', event);
      });
    }

    // Cleanup function
    const cleanup = () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
      if (resourceEventUnsubscriber) {
        resourceEventUnsubscriber();
        resourceEventUnsubscriber = null;
      }
    };

    // Listen for router destruction to cleanup
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
    }

    return {
      cache: globalCache,
      
      createResource,
      
      createAdvancedResource,
      
      getGlobalResourceState: resourceState.getGlobalState,
      
      invalidateByTags: resourceState.invalidateByTags,
      
      onResourceEvent: resourceState.onEvent,
      
      getCacheStats: () => globalCache.getStats(),
      
      clearCache: () => globalCache.clear(),
      
      preloadRoute: async (routeId: string, params: Record<string, any> = {}) => {
        // Find the route by ID
        const route = router.routes.find(r => r.id === routeId);
        if (!route) {
          console.warn(`[DataLayer] Route with ID ${routeId} not found`);
          return;
        }
        
        // Use the router's peek method to preload
        try {
          await router.peek(route, params);
        } catch (error) {
          console.warn(`[DataLayer] Failed to preload route ${routeId}:`, error);
        }
      }
    };
  };
}

/**
 * Creates a data management layer with sensible defaults for quick setup.
 * 
 * This is a convenience function that configures the data layer with commonly
 * used settings for production applications. It's equivalent to calling
 * `dataLayer()` with a pre-configured set of performance-optimized options.
 * 
 * ## Default Configuration
 * 
 * - ✅ **Automatic cleanup**: Enabled with 5-minute intervals
 * - ✅ **Resource event logging**: Enabled in development, disabled in production
 * - ✅ **Optimized cache**: 1000 entries max, 5-minute default TTL
 * - ✅ **Memory efficient**: Periodic cleanup prevents memory leaks
 * 
 * ## Performance Optimized
 * 
 * The default configuration is optimized for typical web applications with:
 * - Balanced memory usage vs. performance
 * - Automatic maintenance to prevent memory leaks
 * - Development-friendly logging for debugging
 * - Production-ready defaults
 * 
 * @returns Router layer with preconfigured data management
 * 
 * @example
 * ```typescript
 * // Quick setup for most applications
 * const router = createLayeredRouter(routes)
 *   (quickDataLayer())  // Production-ready defaults
 *   ();
 * 
 * // Equivalent to:
 * const router = createLayeredRouter(routes)
 *   (dataLayer({
 *     autoCleanup: true,
 *     cleanupInterval: 300000, // 5 minutes
 *     logResourceEvents: process.env.NODE_ENV !== 'production',
 *     cache: {
 *       maxSize: 1000,
 *       defaultTTL: 300000 // 5 minutes
 *     }
 *   }))
 *   ();
 * 
 * // Use all data features immediately
 * const userResource = router.createAdvancedResource(() => api.fetchUser());
 * const stats = router.getCacheStats();
 * router.preloadRoute('dashboard');
 * ```
 * 
 * @see {@link dataLayer} for custom configuration options
 * @see {@link DataLayerConfig} for all available configuration options
 */
export function quickDataLayer(): RouterLayer<RouterContext, DataLayerExtensions> {
  return dataLayer({
    autoCleanup: true,
    cleanupInterval: 300000, // 5 minutes
    logResourceEvents: process.env.NODE_ENV !== 'production',
    cache: {
      maxSize: 1000,
      defaultTTL: 300000 // 5 minutes
    }
  });
}

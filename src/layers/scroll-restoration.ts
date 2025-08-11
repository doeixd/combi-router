// =================================================================
//
//      Combi-Router: Scroll Restoration Layer
//
//      Scroll restoration functionality as a composable layer
//
// =================================================================

/**
 * # Scroll Restoration Layer
 *
 * Provides automatic scroll position management for improved user experience
 * during navigation. Handles saving, restoring, and smooth scrolling based
 * on navigation type and user preferences.
 *
 * This layer automatically manages scroll positions across route changes,
 * ensuring users return to the correct scroll position when navigating
 * back and providing smooth scroll behavior when desired.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, withScrollRestoration } from '@doeixd/combi-router';
 *
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withScrollRestoration({
 *     strategy: 'smooth',
 *     restoreOnBack: true
 *   }))
 *   ();
 *
 * // Scroll restoration works automatically during navigation
 * await router.navigate('/about');  // Scroll resets to top
 * await router.navigate('/user/123');  // Scroll resets to top
 * history.back();  // Scroll restores to previous position
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withScrollRestoration({
 *     enabled: true,
 *     strategy: 'smooth',              // Smooth scrolling
 *     restoreOnBack: true,             // Restore on back navigation
 *     saveDelay: 100,                  // Debounce scroll saving
 *     maxPositions: 50,                // Limit stored positions
 *     excludePaths: ['/modal/*'],      // Skip certain routes
 *     smoothScrollBehavior: 'smooth'   // Native smooth scroll
 *   }))
 *   ();
 * ```
 *
 * ## Features Provided
 *
 * ### Automatic Scroll Management
 * - **Position Saving**: Automatically saves scroll position before navigation
 * - **Position Restoration**: Restores scroll position on back navigation
 * - **Smart Reset**: Resets scroll to top for forward navigation
 * - **Route Exclusion**: Skip scroll management for specific routes
 *
 * ### Smooth Scrolling
 * - **Configurable Behavior**: Auto, smooth, or instant scrolling
 * - **Motion Preference**: Respects user's reduced-motion preference
 * - **Custom Timing**: Configurable scroll animation timing
 *
 * ### Memory Management
 * - **Position Limits**: Configurable maximum stored positions
 * - **Automatic Cleanup**: Removes old scroll positions
 * - **Efficient Storage**: Lightweight position tracking
 *
 * ### Manual Control
 * - **Save Position**: Manually save current scroll position
 * - **Restore Position**: Manually restore to saved position
 * - **Clear History**: Clear all saved positions
 *
 * ## Configuration Options
 *
 * ```typescript
 * interface ScrollRestorationLayerConfig {
 *   enabled?: boolean;                    // Enable/disable scroll restoration
 *   strategy?: 'auto' | 'manual' | 'smooth';  // Scroll behavior strategy
 *   restoreOnBack?: boolean;              // Restore position on back navigation
 *   saveDelay?: number;                   // Debounce delay for saving (ms)
 *   maxPositions?: number;                // Maximum positions to store
 *   smoothScrollBehavior?: ScrollBehavior; // Native scroll behavior
 *   excludePaths?: string[];              // Paths to exclude from restoration
 * }
 * ```
 *
 * ## Manual Control Methods
 *
 * ```typescript
 * // Manual scroll position control
 * router.saveScrollPosition();          // Save current position
 * router.saveScrollPosition('routeId'); // Save for specific route
 * router.restoreScrollPosition('routeId'); // Restore specific position
 * router.clearScrollHistory();          // Clear all positions
 *
 * // Configuration updates
 * router.updateScrollConfig({
 *   strategy: 'smooth',
 *   restoreOnBack: false
 * });
 *
 * // Debug and inspection
 * const history = router.getScrollHistory();
 * ```
 */

import type { ScrollRestorationLayerConfig } from "../core/layer-types";
import {
  ScrollRestorationManager,
  type ScrollRestorationConfig,
  defaultScrollRestorationConfig,
} from "../features/scroll-restoration";

/**
 * Creates a scroll restoration layer for automatic scroll position management.
 *
 * This layer provides intelligent scroll position handling that improves user
 * experience by maintaining scroll positions across navigation and providing
 * smooth scrolling behavior when appropriate.
 *
 * @param config Configuration options for scroll restoration behavior
 * @returns A router layer that adds scroll restoration capabilities
 *
 * @example Basic Scroll Restoration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createScrollRestorationLayer({
 *     strategy: 'smooth',
 *     restoreOnBack: true
 *   }))
 *   ();
 *
 * // Scroll positions are now managed automatically
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createScrollRestorationLayer({
 *     enabled: true,
 *     strategy: 'auto',                // Respect user preferences
 *     restoreOnBack: true,             // Restore on back navigation
 *     saveDelay: 200,                  // Debounce scroll events
 *     maxPositions: 100,               // Store more positions
 *     excludePaths: ['/popup/*', '/modal/*']  // Skip certain routes
 *   }))
 *   ();
 * ```
 *
 * @example Mobile-Optimized Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createScrollRestorationLayer({
 *     strategy: 'smooth',
 *     smoothScrollBehavior: 'smooth',  // Native smooth scroll
 *     saveDelay: 50,                   // Faster response on mobile
 *     restoreOnBack: true
 *   }))
 *   ();
 * ```
 */
export function createScrollRestorationLayer(
  config: ScrollRestorationLayerConfig = {},
) {
  // Convert layer config to scroll restoration manager config
  const scrollConfig: ScrollRestorationConfig = {
    enabled: config.enabled ?? defaultScrollRestorationConfig.enabled,
    strategy: config.strategy ?? defaultScrollRestorationConfig.strategy,
    restoreOnBack:
      config.restoreOnBack ?? defaultScrollRestorationConfig.restoreOnBack,
    saveDelay: config.saveDelay ?? defaultScrollRestorationConfig.saveDelay,
    maxPositions:
      config.maxPositions ?? defaultScrollRestorationConfig.maxPositions,
    smoothScrollBehavior:
      config.smoothScrollBehavior ??
      defaultScrollRestorationConfig.smoothScrollBehavior,
    excludePaths:
      config.excludePaths ?? defaultScrollRestorationConfig.excludePaths,
  };

  // Create scroll restoration manager instance
  const scrollManager = new ScrollRestorationManager(scrollConfig);

  // Return layer function that returns methods object
  return function scrollRestorationLayer() {
    return {
      saveScrollPosition: () => {
        return scrollManager.saveCurrentPosition();
      },

      restoreScrollPosition: (_routeId: string) => {
        return scrollManager.restorePosition(_routeId);
      },

      clearScrollPosition: () => {
        scrollManager.clearPositions();
      },

      updateScrollConfig: (
        newConfig: Partial<ScrollRestorationLayerConfig>,
      ) => {
        const updatedConfig = { ...scrollConfig, ...newConfig };
        scrollManager.updateConfig(updatedConfig);
      },

      getScrollPositions: () => {
        return scrollManager.getAllPositions();
      },
    };
  };
}

// Type for the extensions this layer provides
export interface ScrollRestorationLayerExtensions {
  scrollRestoration: ScrollRestorationManager;
  saveScrollPosition: (routeId?: string) => void;
  restoreScrollPosition: (routeId: string) => void;
  clearScrollHistory: () => void;
  updateScrollConfig: (config: Partial<ScrollRestorationLayerConfig>) => void;
  getScrollHistory: () => ReturnType<
    ScrollRestorationManager["getAllPositions"]
  >;
}

// Convenience factory with default config
export const withScrollRestoration = (
  config: ScrollRestorationLayerConfig = {},
) => createScrollRestorationLayer(config);

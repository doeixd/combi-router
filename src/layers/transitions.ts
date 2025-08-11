// =================================================================
//
//      Combi-Router: Transitions Layer
//
//      Advanced page transitions as a composable layer
//
// =================================================================

/**
 * # Transitions Layer
 *
 * Provides sophisticated page transitions beyond the basic View Transitions API,
 * including custom animations, motion preferences, and smooth navigation experiences.
 *
 * This layer enhances navigation with beautiful transitions that respect user
 * preferences and provide smooth visual feedback during route changes.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, withTransitions } from '@doeixd/combi-router';
 *
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withTransitions({
 *     type: 'view-transitions',
 *     duration: 300,
 *     respectPreferences: true
 *   }))
 *   ();
 *
 * // Transitions happen automatically during navigation
 * await router.navigate('/about'); // Smooth transition
 * ```
 *
 * @example Custom Transitions
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withTransitions({
 *     type: 'custom',
 *     duration: 500,
 *     easing: 'ease-in-out',
 *     customTransition: async (context) => {
 *       // Custom transition logic
 *       const { from, to, direction } = context;
 *       if (direction === 'forward') {
 *         // Slide in from right
 *       } else {
 *         // Slide in from left
 *       }
 *     }
 *   }))
 *   ();
 * ```
 *
 * ## Features Provided
 *
 * ### Transition Types
 * - **View Transitions**: Native browser View Transitions API
 * - **Custom**: User-defined transition functions
 * - **Fade**: Built-in fade transitions
 * - **Slide**: Built-in slide transitions
 * - **None**: Disable transitions
 *
 * ### Motion Preferences
 * - Respects `prefers-reduced-motion` setting
 * - Automatic fallback for accessibility
 * - Configurable motion sensitivity
 *
 * ### Direction Awareness
 * - Forward navigation (push)
 * - Backward navigation (pop)
 * - Replace navigation
 * - Context-aware animations
 *
 * ### Performance Optimizations
 * - Hardware acceleration
 * - Optimized timing functions
 * - Efficient cleanup
 *
 * ## Configuration Options
 *
 * ```typescript
 * interface TransitionsLayerConfig {
 *   enabled?: boolean;                // Enable/disable transitions
 *   type?: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
 *   duration?: number;                // Transition duration in ms
 *   easing?: string;                  // CSS easing function
 *   customTransition?: TransitionFunction;  // Custom transition logic
 *   skipSameRoute?: boolean;          // Skip transitions for same route
 *   fallbackTransition?: TransitionType;    // Fallback if primary fails
 *   debugMode?: boolean;              // Enable debug logging
 *   respectPreferences?: boolean;     // Respect user motion preferences
 * }
 * ```
 */

import type { RouteMatch, NavigationContext } from "../core/types";
import type { RouterLayer, TransitionsLayerConfig } from "../core/layer-types";
import {
  TransitionManager,
  type TransitionConfig,
  type TransitionDirection,
  defaultTransitionConfig,
} from "../features/transitions";

/**
 * Validates transitions layer configuration
 */
function validateTransitionsConfig(
  config: TransitionsLayerConfig,
): TransitionsLayerConfig {
  const validated = { ...config };

  // Validate duration
  if (
    config.duration !== undefined &&
    (config.duration < 0 || config.duration > 10000)
  ) {
    console.warn("[TransitionsLayer] Invalid duration, using default");
    validated.duration = defaultTransitionConfig.duration;
  }

  // Validate easing function
  if (config.easing !== undefined && typeof config.easing !== "string") {
    console.warn("[TransitionsLayer] Invalid easing function, using default");
    validated.easing = defaultTransitionConfig.easing;
  }

  return validated;
}

/**
 * Checks if the router instance supports lifecycle hooks
 */
function hasLifecycleSupport(
  self: any,
): self is { _registerLifecycleHook: (name: string, fn: Function) => void } {
  return typeof self._registerLifecycleHook === "function";
}

/**
 * Creates a transitions layer for advanced page transitions and animations.
 *
 * This layer provides sophisticated transition effects that enhance the user
 * experience during navigation while respecting accessibility preferences.
 *
 * @param config Configuration options for transition behavior
 * @returns A router layer that adds transition capabilities
 *
 * @example Basic Transitions
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createTransitionsLayer({
 *     type: 'view-transitions',
 *     duration: 300
 *   }))
 *   ();
 *
 * // Transitions happen automatically
 * ```
 *
 * @example Accessibility-Focused Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createTransitionsLayer({
 *     type: 'fade',
 *     respectPreferences: true,        // Respect reduced motion
 *     fallbackTransition: 'none',     // Fallback for accessibility
 *     duration: 200                   // Quick transitions
 *   }))
 *   ();
 * ```
 */
export function createTransitionsLayer(
  config: TransitionsLayerConfig = {},
): RouterLayer<any, TransitionsLayerExtensions> {
  return (self) => {
    // Validate and sanitize configuration
    const validatedConfig = validateTransitionsConfig(config);

    // Convert layer config to transition manager config
    const transitionConfig: TransitionConfig = {
      enabled: validatedConfig.enabled ?? defaultTransitionConfig.enabled,
      type: validatedConfig.type ?? defaultTransitionConfig.type,
      duration: validatedConfig.duration ?? defaultTransitionConfig.duration,
      easing: validatedConfig.easing ?? defaultTransitionConfig.easing,
      customTransition:
        validatedConfig.customTransition ??
        defaultTransitionConfig.customTransition,
      skipSameRoute:
        validatedConfig.skipSameRoute ?? defaultTransitionConfig.skipSameRoute,
      fallbackTransition:
        validatedConfig.fallbackTransition ??
        defaultTransitionConfig.fallbackTransition,
      debugMode: validatedConfig.debugMode ?? defaultTransitionConfig.debugMode,
      respectPreferences:
        validatedConfig.respectPreferences ??
        defaultTransitionConfig.respectPreferences,
    };

    // Create transition manager instance
    const transitionManager = new TransitionManager(transitionConfig);

    // Track cleanup functions for proper disposal
    const cleanupFunctions: (() => void)[] = [];

    // Register lifecycle hooks with the core layer
    if (hasLifecycleSupport(self)) {
      try {
        // Navigation start - prepare transition
        self._registerLifecycleHook(
          "onNavigationStart",
          (context: NavigationContext) => {
            try {
              if (transitionConfig.enabled && context.from && context.to) {
                const direction = context.isPopState ? "back" : "forward";

                if (transitionConfig.debugMode) {
                  console.log(
                    `[TransitionsLayer] Navigation start: ${direction}`,
                  );
                }

                // Transition context is ready for execution
              }
            } catch (error) {
              console.error(
                "[TransitionsLayer] Error in onNavigationStart:",
                error,
              );
            }
          },
        );

        // Navigation complete - execute transition
        self._registerLifecycleHook(
          "onNavigationComplete",
          async (match: RouteMatch<any>, isPopState?: boolean) => {
            try {
              if (transitionConfig.enabled) {
                const direction = isPopState ? "back" : "forward";
                const transitionContext = {
                  from: self.currentMatch,
                  to: match,
                  direction,
                  isInitial: !self.currentMatch,
                };

                if (transitionConfig.debugMode) {
                  console.log(
                    `[TransitionsLayer] Executing transition: ${direction}`,
                  );
                }

                // Execute transition
                await transitionManager.executeTransition({
                  ...transitionContext,
                  direction: direction as TransitionDirection,
                });
              }
            } catch (error) {
              console.error(
                "[TransitionsLayer] Error in onNavigationComplete:",
                error,
              );
            }
          },
        );

        // Cleanup on destroy
        self._registerLifecycleHook("onDestroy", () => {
          try {
            cleanupFunctions.forEach((cleanup) => cleanup());
            transitionManager.destroy();
            console.log("[TransitionsLayer] Cleanup completed");
          } catch (error) {
            console.error("[TransitionsLayer] Error during cleanup:", error);
          }
        });
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to register lifecycle hooks:",
          error,
        );
      }
    } else {
      console.warn(
        "[TransitionsLayer] Lifecycle hooks not supported by router instance",
      );
    }

    // Execute a custom transition
    const executeTransition = async (context: any): Promise<void> => {
      try {
        await transitionManager.executeTransition(context);
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to execute transition:",
          error,
        );
      }
    };

    // Get transition direction
    const getTransitionDirection = (
      from: RouteMatch<any> | null,
      to: RouteMatch<any>,
    ): string => {
      try {
        return transitionManager.getTransitionDirection(from, to);
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to get transition direction:",
          error,
        );
        return "forward";
      }
    };

    // Check if transitions are supported
    const isTransitionSupported = (): boolean => {
      try {
        return (
          typeof document !== "undefined" && "startViewTransition" in document
        );
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to check transition support:",
          error,
        );
        return false;
      }
    };

    // Update configuration
    const updateTransitionsConfig = (
      newConfig: Partial<TransitionsLayerConfig>,
    ): void => {
      try {
        const updatedConfig: Partial<TransitionConfig> = {
          enabled: newConfig.enabled,
          type: newConfig.type,
          duration: newConfig.duration,
          easing: newConfig.easing,
          customTransition: newConfig.customTransition,
          skipSameRoute: newConfig.skipSameRoute,
          fallbackTransition: newConfig.fallbackTransition,
          debugMode: newConfig.debugMode,
          respectPreferences: newConfig.respectPreferences,
        };

        transitionManager.updateConfig(updatedConfig);
        console.log("[TransitionsLayer] Configuration updated");
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to update configuration:",
          error,
        );
      }
    };

    // Get transition status
    const getTransitionStatus = () => {
      try {
        return {
          isTransitioning: false, // Cannot access private property
          supportedTypes: [],
          currentConfig: transitionConfig,
        };
      } catch (error) {
        console.error(
          "[TransitionsLayer] Failed to get transition status:",
          error,
        );
        return {
          isTransitioning: false,
          supportedTypes: [],
          currentConfig: transitionConfig,
        };
      }
    };

    // Return the transitions layer extensions
    return {
      // Transition manager instance (for advanced usage)
      transitions: transitionManager,

      // High-level API
      executeTransition,
      getTransitionDirection,
      isTransitionSupported,

      // Configuration and monitoring
      updateTransitionsConfig,
      getTransitionStatus,
    };
  };
}

// Type for the extensions this layer provides
export interface TransitionsLayerExtensions {
  transitions: TransitionManager;
  executeTransition: (context: any) => Promise<void>;
  getTransitionDirection: (
    from: RouteMatch<any> | null,
    to: RouteMatch<any>,
  ) => string;
  isTransitionSupported: () => boolean;
  updateTransitionsConfig: (config: Partial<TransitionsLayerConfig>) => void;
  getTransitionStatus: () => {
    isTransitioning: boolean;
    supportedTypes: string[];
    currentConfig: TransitionConfig;
  };
}

// Convenience factory with default config
export const withTransitions = (config: TransitionsLayerConfig = {}) =>
  createTransitionsLayer(config);

// =================================================================
//
//      Combi-Router: Head Management Layer
//
//      Dynamic head tag management as a composable layer
//
// =================================================================

/**
 * # Head Management Layer
 *
 * Provides dynamic head tag management for SEO, meta tags, and document
 * head manipulation with support for route-specific configurations.
 *
 * This layer enhances the router with automatic head tag updates during
 * navigation, supporting titles, meta tags, Open Graph, and custom elements.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, withHeadManagement } from '@doeixd/combi-router';
 *
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withHeadManagement({
 *     titleTemplate: 'My App | %s',
 *     defaultTitle: 'My App',
 *     enableOpenGraph: true
 *   }))
 *   ();
 *
 * // Head management happens automatically during navigation
 * router.setHeadData({
 *   title: 'About Us',
 *   meta: [
 *     { name: 'description', content: 'Learn about our company' }
 *   ]
 * });
 * ```
 *
 * @example Route-Specific Head Data
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (withHeadManagement())
 *   ();
 *
 * // Set head data for specific routes
 * router.setRouteHeadData('user', (params) => ({
 *   title: `User Profile - ${params.name}`,
 *   meta: [
 *     { property: 'og:title', content: `${params.name}'s Profile` },
 *     { property: 'og:description', content: 'User profile page' }
 *   ]
 * }));
 * ```
 *
 * ## Features Provided
 *
 * ### Title Management
 * - Dynamic title updates
 * - Title templates with placeholders
 * - Fallback titles for routes
 *
 * ### Meta Tags
 * - Dynamic meta tag creation/update
 * - SEO-optimized meta descriptions
 * - Open Graph and Twitter Card support
 *
 * ### Link Tags
 * - Canonical URLs
 * - Alternate language links
 * - Preload/prefetch resources
 *
 * ### Script and Style Tags
 * - Route-specific scripts
 * - Inline styles
 * - External resource loading
 *
 * ## Configuration Options
 *
 * ```typescript
 * interface HeadManagementLayerConfig {
 *   titleTemplate?: string;           // Template for titles (e.g., '%s | My App')
 *   defaultTitle?: string;            // Default title when none specified
 *   enableOpenGraph?: boolean;        // Auto-generate Open Graph tags
 *   enableTwitterCard?: boolean;      // Auto-generate Twitter Card tags
 *   enableCanonical?: boolean;        // Auto-generate canonical URLs
 *   baseUrl?: string;                 // Base URL for canonical links
 *   preserveExisting?: boolean;       // Preserve existing head tags
 * }
 * ```
 */

import type { RouteMatch } from "../core/types";
import type {
  RouterLayer,
  HeadManagementLayerConfig,
} from "../core/layer-types";
import { HeadManager, type HeadInput, resolveHeadData } from "../features/head";

/**
 * Validates head management layer configuration
 */
function validateHeadConfig(
  config: HeadManagementLayerConfig,
): HeadManagementLayerConfig {
  const validated = { ...config };

  // Validate title template
  if (
    config.titleTemplate !== undefined &&
    typeof config.titleTemplate !== "string"
  ) {
    console.warn("[HeadLayer] Invalid titleTemplate, using default");
    validated.titleTemplate = "%s";
  }

  // Validate base URL
  if (config.baseUrl !== undefined) {
    try {
      new URL(config.baseUrl);
    } catch {
      console.warn("[HeadLayer] Invalid baseUrl, disabling canonical URLs");
      validated.enableCanonical = false;
    }
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
 * Creates a head management layer for dynamic document head manipulation.
 *
 * This layer provides comprehensive head tag management with automatic
 * updates during navigation and support for SEO optimization.
 *
 * @param config Configuration options for head management behavior
 * @returns A router layer that adds head management capabilities
 *
 * @example Basic Head Management
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createHeadManagementLayer({
 *     titleTemplate: 'My App | %s',
 *     enableOpenGraph: true
 *   }))
 *   ();
 *
 * // Automatic head updates during navigation
 * ```
 *
 * @example SEO-Optimized Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createHeadManagementLayer({
 *     titleTemplate: '%s | My Company',
 *     defaultTitle: 'My Company - Industry Leader',
 *     enableOpenGraph: true,
 *     enableTwitterCard: true,
 *     enableCanonical: true,
 *     baseUrl: 'https://mycompany.com'
 *   }))
 *   ();
 * ```
 */
export function createHeadManagementLayer(
  config: HeadManagementLayerConfig = {},
): RouterLayer<any, HeadManagementLayerExtensions> {
  return (self) => {
    // Validate and sanitize configuration
    const validatedConfig = validateHeadConfig(config);

    // Create head manager instance
    const headManager =
      typeof document !== "undefined" ? new HeadManager(document) : null;

    // Store route-specific head data
    const routeHeadData = new Map<
      string,
      HeadInput | ((params: any) => HeadInput)
    >();

    // Current head state
    let currentHeadData: HeadInput | null = null;

    // Track cleanup functions for proper disposal
    const cleanupFunctions: (() => void)[] = [];

    // Register lifecycle hooks with the core layer
    if (hasLifecycleSupport(self)) {
      try {
        // Navigation complete - update head tags
        self._registerLifecycleHook(
          "onNavigationComplete",
          (match: RouteMatch<any>) => {
            try {
              updateHeadForRoute(match);
            } catch (error) {
              console.error(
                "[HeadLayer] Error in onNavigationComplete:",
                error,
              );
            }
          },
        );

        // Cleanup on destroy
        self._registerLifecycleHook("onDestroy", () => {
          try {
            cleanupFunctions.forEach((cleanup) => cleanup());
            // HeadManager cleanup - clear managed elements
            if (headManager && "managedElements" in headManager) {
              (headManager as any).managedElements?.clear();
            }
            console.log("[HeadLayer] Cleanup completed");
          } catch (error) {
            console.error("[HeadLayer] Error during cleanup:", error);
          }
        });
      } catch (error) {
        console.error("[HeadLayer] Failed to register lifecycle hooks:", error);
      }
    } else {
      console.warn(
        "[HeadLayer] Lifecycle hooks not supported by router instance",
      );
    }

    // Update head tags for a specific route
    const updateHeadForRoute = (match: RouteMatch<any>): void => {
      if (!headManager) {
        console.warn("[HeadLayer] Head manager not available (likely SSR)");
        return;
      }

      try {
        // Get route-specific head data
        const routeData = routeHeadData.get(match.route.id);
        let headData: HeadInput = {};

        if (routeData) {
          headData =
            typeof routeData === "function"
              ? routeData(match.params)
              : routeData;
        }

        // Apply global configuration
        if (!headData.title && validatedConfig.defaultTitle) {
          headData.title = validatedConfig.defaultTitle;
        }

        // Normalize title to string
        let titleStr: string | undefined;
        if (typeof headData.title === "string") {
          titleStr = headData.title;
        } else if (typeof headData.title === "function") {
          const result = headData.title(match.params);
          titleStr =
            typeof result === "string" ? result : (result as any)?.title;
        } else if (headData.title && typeof headData.title === "object") {
          titleStr = (headData.title as any).title;
        }

        // Apply title template
        if (titleStr && validatedConfig.titleTemplate) {
          titleStr = validatedConfig.titleTemplate.replace("%s", titleStr);
          headData.title = titleStr;
        }

        // Normalize meta to array
        let metaArray: any[] = [];
        if (Array.isArray(headData.meta)) {
          metaArray = headData.meta;
        } else if (typeof headData.meta === "function") {
          metaArray = headData.meta(match.params);
        }

        // Auto-generate Open Graph tags
        if (validatedConfig.enableOpenGraph && titleStr) {
          if (!metaArray.find((m: any) => m.property === "og:title")) {
            metaArray.push({
              property: "og:title",
              content: titleStr,
            });
          }
          if (
            !metaArray.find((m: any) => m.property === "og:url") &&
            validatedConfig.baseUrl
          ) {
            const url = new URL(
              match.pathname,
              validatedConfig.baseUrl,
            ).toString();
            metaArray.push({ property: "og:url", content: url });
          }
        }

        // Auto-generate Twitter Card tags
        if (validatedConfig.enableTwitterCard && titleStr) {
          if (!metaArray.find((m: any) => m.name === "twitter:title")) {
            metaArray.push({
              name: "twitter:title",
              content: titleStr,
            });
          }
          if (!metaArray.find((m: any) => m.name === "twitter:card")) {
            metaArray.push({ name: "twitter:card", content: "summary" });
          }
        }

        // Update headData with normalized meta
        if (metaArray.length > 0) {
          headData.meta = metaArray;
        }

        // Normalize link to array
        let linkArray: any[] = [];
        if (Array.isArray(headData.link)) {
          linkArray = headData.link;
        } else if (typeof headData.link === "function") {
          linkArray = headData.link(match.params);
        }

        // Auto-generate canonical URL
        if (validatedConfig.enableCanonical && validatedConfig.baseUrl) {
          if (!linkArray.find((l: any) => l.rel === "canonical")) {
            const canonical = new URL(
              match.pathname,
              validatedConfig.baseUrl,
            ).toString();
            linkArray.push({ rel: "canonical", href: canonical });
          }
        }

        // Update headData with normalized link
        if (linkArray.length > 0) {
          headData.link = linkArray;
        }

        // Resolve and apply head data
        const resolvedHead = resolveHeadData(headData, match);
        headManager.apply(resolvedHead);

        currentHeadData = headData;
        console.log(`[HeadLayer] Updated head for route: ${match.route.id}`);
      } catch (error) {
        console.error(
          `[HeadLayer] Failed to update head for route ${match.route.id}:`,
          error,
        );
      }
    };

    // Set head data for the current route
    const setHeadData = (headData: HeadInput): void => {
      try {
        if (!headManager) {
          console.warn("[HeadLayer] Head manager not available");
          return;
        }

        if (!self.currentMatch) {
          console.warn("[HeadLayer] No current match available");
          return;
        }

        const resolvedHead = resolveHeadData(headData, self.currentMatch);
        headManager.apply(resolvedHead);
        currentHeadData = headData;
        console.log("[HeadLayer] Head data updated");
      } catch (error) {
        console.error("[HeadLayer] Failed to set head data:", error);
      }
    };

    // Set head data for a specific route
    const setRouteHeadData = (
      routeId: string,
      headData: HeadInput | ((params: any) => HeadInput),
    ): void => {
      try {
        routeHeadData.set(routeId, headData);
        console.log(`[HeadLayer] Head data set for route: ${routeId}`);

        // Update immediately if this is the current route
        if (self.currentMatch?.route.id === routeId) {
          updateHeadForRoute(self.currentMatch);
        }
      } catch (error) {
        console.error(
          `[HeadLayer] Failed to set head data for route ${routeId}:`,
          error,
        );
      }
    };

    // Get current head data
    const getCurrentHeadData = (): HeadInput | null => {
      return currentHeadData;
    };

    // Remove head data for a route
    const removeRouteHeadData = (routeId: string): void => {
      try {
        const removed = routeHeadData.delete(routeId);
        if (removed) {
          console.log(`[HeadLayer] Head data removed for route: ${routeId}`);
        }
      } catch (error) {
        console.error(
          `[HeadLayer] Failed to remove head data for route ${routeId}:`,
          error,
        );
      }
    };

    // Update configuration
    const updateHeadConfig = (
      newConfig: Partial<HeadManagementLayerConfig>,
    ): void => {
      try {
        Object.assign(validatedConfig, validateHeadConfig(newConfig));
        console.log("[HeadLayer] Configuration updated");

        // Re-apply head data with new config
        if (self.currentMatch) {
          updateHeadForRoute(self.currentMatch);
        }
      } catch (error) {
        console.error("[HeadLayer] Failed to update configuration:", error);
      }
    };

    // Get head management status
    const getHeadStatus = () => {
      try {
        return {
          isAvailable: !!headManager,
          routeDataCount: routeHeadData.size,
          currentRoute: self.currentMatch?.route.id || null,
          hasCurrentData: !!currentHeadData,
          config: validatedConfig,
        };
      } catch (error) {
        console.error("[HeadLayer] Failed to get head status:", error);
        return {
          isAvailable: false,
          routeDataCount: 0,
          currentRoute: null,
          hasCurrentData: false,
          config: validatedConfig,
        };
      }
    };

    // Return the head management layer extensions
    return {
      // Head manager instance (for advanced usage)
      headManager,

      // High-level API
      setHeadData,
      setRouteHeadData,
      getCurrentHeadData,
      removeRouteHeadData,

      // Configuration and monitoring
      updateHeadConfig,
      getHeadStatus,
    };
  };
}

// Type for the extensions this layer provides
export interface HeadManagementLayerExtensions {
  headManager: HeadManager | null;
  setHeadData: (headData: HeadInput) => void;
  setRouteHeadData: (
    routeId: string,
    headData: HeadInput | ((params: any) => HeadInput),
  ) => void;
  getCurrentHeadData: () => HeadInput | null;
  removeRouteHeadData: (routeId: string) => void;
  updateHeadConfig: (config: Partial<HeadManagementLayerConfig>) => void;
  getHeadStatus: () => {
    isAvailable: boolean;
    routeDataCount: number;
    currentRoute: string | null;
    hasCurrentData: boolean;
    config: HeadManagementLayerConfig;
  };
}

// Convenience factory with default config
export const withHeadManagement = (config: HeadManagementLayerConfig = {}) =>
  createHeadManagementLayer(config);

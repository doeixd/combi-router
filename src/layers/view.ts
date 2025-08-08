// =================================================================
//
//      Combi-Router: View Layer
//
//      DOM rendering and SPA functionality as a composable layer
//
// =================================================================

/**
 * # View Layer
 *
 * A composable layer that provides complete DOM rendering and SPA functionality.
 * It connects route definitions with view factories to the DOM, manages loading/error states,
 * and intercepts link clicks for seamless single-page application navigation.
 *
 * This layer integrates with the existing head management system and lifecycle hooks
 * from the core navigation layer to provide a complete rendering solution.
 *
 * @example Basic Usage
 * ```typescript
 * import { createLayeredRouter, createCoreNavigationLayer, createViewLayer, view } from '@doeixd/combi-router';
 *
 * const homeRoute = pipe(
 *   route(path(''), end),
 *   view(() => '<h1>Welcome Home!</h1>')
 * );
 *
 * const router = createLayeredRouter([homeRoute])
 *   (createCoreNavigationLayer())
 *   (createViewLayer({
 *     root: '#app',
 *     loadingView: () => '<div>Loading...</div>',
 *     errorView: (error) => `<div>Error: ${error.message}</div>`
 *   }))
 *   ();
 * ```
 *
 * @example Advanced Usage with Data Loading
 * ```typescript
 * const userRoute = pipe(
 *   route(path('user'), param('id', z.string()), end),
 *   loader(async ({ params }) => ({ user: await fetchUser(params.id) })),
 *   head(({ data }) => ({ title: `User: ${data.user.name}` })),
 *   view(({ match }) => `
 *     <div class="user-profile">
 *       <h1>${match.data.user.name}</h1>
 *       <p>Email: ${match.data.user.email}</p>
 *       <a href="/">← Back to Home</a>
 *     </div>
 *   `)
 * );
 * ```
 *
 * ## Features Provided
 *
 * ### DOM Rendering
 * - Automatic rendering of view factory results to the DOM
 * - Support for both string HTML and DOM Node returns
 * - Configurable root element for rendering
 *
 * ### State Management
 * - Loading state rendering during navigation
 * - Error state rendering when navigation fails
 * - 404 Not Found rendering for unmatched routes
 *
 * ### SPA Navigation
 * - Automatic interception of internal link clicks
 * - Prevention of full page reloads for SPA navigation
 * - Respect for external links, downloads, and modifier keys
 *
 * ### Integration
 * - Seamless integration with existing head management
 * - Integration with core navigation lifecycle hooks
 * - Support for all existing router features (guards, loaders, etc.)
 */

import type { RouterLayer, ComposableRouter } from "../core/layer-types";
import type {
  RouteMatch,
  NavigationError,
  ViewFactory,
  ViewContext,
} from "../core/types";
import { NavigationErrorType } from "../core/types";
import { HeadManager, resolveHeadData } from "../features/head";

/** Configuration for the createViewLayer. */
export interface ViewLayerConfig {
  /** The root DOM element or CSS selector to render the application into. */
  root: HTMLElement | string;
  /** Optional: A factory for rendering the loading state UI. */
  loadingView?: () => string | Node;
  /** Optional: A factory for rendering an error state UI. */
  errorView?: (error: NavigationError) => string | Node;
  /** Optional: A factory for rendering the 404 Not Found UI. */
  notFoundView?: () => string | Node;
  /** Optional: Custom link selector for SPA navigation (default: 'a[href]') */
  linkSelector?: string;
  /** Optional: Disable automatic link interception */
  disableLinkInterception?: boolean;
}

/** Extensions provided by the ViewLayer. */
export interface ViewLayerExtensions {
  /** Manually triggers a re-render of the current view. */
  rerender: () => void;
  /** Get the current root element being used for rendering */
  getRootElement: () => HTMLElement | null;
  /** Update the view layer configuration */
  updateConfig: (newConfig: Partial<ViewLayerConfig>) => void;
}

/**
 * Creates a View Layer that handles the entire rendering lifecycle for a vanilla JS application.
 * It connects route definitions to the DOM, manages loading/error states, and intercepts
 * link clicks for a seamless single-page application experience.
 *
 * @param config The configuration specifying the root element and fallback views.
 * @returns A composable router layer.
 *
 * @example Basic Setup
 * ```typescript
 * const router = createLayeredRouter(routes)
 *   (createCoreNavigationLayer())
 *   (createViewLayer({
 *     root: '#app-root',
 *     loadingView: () => '<div class="spinner">Loading...</div>',
 *     errorView: (error) => `<div class="error">${error.message}</div>`
 *   }))
 *   ();
 * ```
 */
export function createViewLayer(
  config: ViewLayerConfig,
): RouterLayer<any, ViewLayerExtensions> {
  return (router: ComposableRouter<any>) => {
    let currentConfig = { ...config };
    let rootElement = resolveRootElement(currentConfig.root);

    if (!rootElement) {
      throw new Error(
        `[ViewLayer] Root element "${currentConfig.root}" not found.`,
      );
    }

    const headManager = new HeadManager(document);
    let lastError: NavigationError | undefined;
    let cleanupFunctions: (() => void)[] = [];

    /** Resolves a root element from a selector or element */
    function resolveRootElement(
      root: HTMLElement | string,
    ): HTMLElement | null {
      return typeof root === "string"
        ? document.querySelector<HTMLElement>(root)
        : root;
    }

    /** Renders content to the root element. */
    const render = (content: string | Node) => {
      console.log(
        "[ViewLayer] render() called with content:",
        typeof content === "string" ? content : `<${content.nodeName}>`,
      );
      console.log("[ViewLayer] rootElement:", rootElement?.id || rootElement);

      if (!rootElement) {
        console.log("[ViewLayer] No root element available for rendering");
        return;
      }

      if (typeof content === "string") {
        rootElement.innerHTML = content;
        console.log("[ViewLayer] Set innerHTML to:", rootElement.innerHTML);
      } else {
        rootElement.innerHTML = ""; // Clear previous content
        rootElement.appendChild(content);
        console.log(
          "[ViewLayer] Appended DOM node, innerHTML now:",
          rootElement.innerHTML,
        );
      }
    };

    /** The main state handler, called whenever the router's state changes. */
    const handleStateChange = (match: RouteMatch | null) => {
      console.log(
        "[ViewLayer] handleStateChange called with match:",
        match
          ? {
              route: { id: match.route.id, staticPath: match.route.staticPath },
              params: match.params,
              pathname: match.pathname,
              hasView: !!match.route.metadata?.view,
            }
          : null,
      );
      console.log("[ViewLayer] router.isFetching:", router.isFetching);
      console.log("[ViewLayer] lastError:", lastError);

      // 1. Head Management: Update the document head for SEO.
      if (match?.route.metadata?.view || match?.route.metadata?._head) {
        if (match.route.metadata._head) {
          const resolvedHead = resolveHeadData(
            match.route.metadata._head,
            match,
          );
          headManager.apply(resolvedHead);
        }
      } else if (!match && currentConfig.notFoundView) {
        headManager.apply({
          title: "Not Found",
          meta: [],
          link: [],
          script: [],
          style: [],
          htmlAttrs: {},
          bodyAttrs: {},
          noscript: [],
        });
      }

      // 2. Render Loading State: If the router is fetching data, show the loading view.
      if (router.isFetching && currentConfig.loadingView) {
        console.log("[ViewLayer] Rendering loading view");
        render(currentConfig.loadingView());
        return;
      }

      // 3. Render Error State: If a navigation error occurred, show the error view.
      if (lastError && currentConfig.errorView) {
        render(currentConfig.errorView(lastError));
        return;
      }

      // 4. Render Not Found State: If no route was matched.
      if (!match) {
        if (currentConfig.notFoundView) {
          render(currentConfig.notFoundView());
        } else {
          render("<h2>404 - Not Found</h2>");
        }
        return;
      }

      // 5. Render Matched View: Find and execute the view factory from the route's metadata.
      const viewFactory = match.route.metadata?.view as ViewFactory | undefined;
      console.log(
        `[ViewLayer] Looking for view factory on route ${match.route.id}, found:`,
        !!viewFactory,
      );
      if (viewFactory) {
        try {
          const viewContext: ViewContext = { match };
          const renderedContent = viewFactory(viewContext);
          console.log(
            `[ViewLayer] Successfully rendered view for route ${match.route.id}`,
          );
          render(renderedContent);
        } catch (error) {
          console.error(
            `[ViewLayer] Error rendering view for route (ID: ${match.route.id}):`,
            error,
          );
          if (currentConfig.errorView) {
            const navigationError: NavigationError = {
              type: NavigationErrorType.Unknown,
              message: `View rendering failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              originalError: error,
              route: match.route,
              params: match.params,
            };
            render(currentConfig.errorView(navigationError));
          } else {
            render("<div>Error rendering view</div>");
          }
        }
      } else {
        console.warn(
          `[ViewLayer] No view() factory found for matched route (ID: ${match.route.id}).`,
        );
        render("<!-- View not configured -->");
      }
    };

    /** Intercepts clicks on local `<a>` tags for SPA navigation. */
    const handleLinkClick = async (event: MouseEvent) => {
      if (currentConfig.disableLinkInterception) return;

      const linkSelector = currentConfig.linkSelector || "a[href]";
      const link = (event.target as HTMLElement).closest(
        linkSelector,
      ) as HTMLAnchorElement;

      if (
        !link ||
        !link.href ||
        link.origin !== window.location.origin ||
        link.hasAttribute("download") ||
        link.hasAttribute("target") ||
        link.getAttribute("href")?.startsWith("#") ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }

      event.preventDefault();

      const href = link.getAttribute("href");
      if (!href) return;

      lastError = undefined; // Clear previous errors

      try {
        // Use the router's navigation method which will trigger the proper lifecycle
        const success = await router.navigate(href);
        if (!success) {
          console.warn("[ViewLayer] Navigation failed for:", href);
        }
      } catch (error) {
        console.error("[ViewLayer] Navigation error:", error);
        lastError = {
          type: NavigationErrorType.Unknown,
          message: `Navigation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          originalError: error,
        };
        handleStateChange(router.currentMatch);
      }
    };

    // Set up global link click handling
    if (!currentConfig.disableLinkInterception) {
      document.body.addEventListener("click", handleLinkClick);
      cleanupFunctions.push(() =>
        document.body.removeEventListener("click", handleLinkClick),
      );
    }

    // --- Lifecycle Integration ---
    // Hook into the CoreNavigationLayer's lifecycle for precise state management.
    console.log(
      "[ViewLayer] Checking for lifecycle hooks, _registerLifecycleHook available:",
      typeof (router as any)._registerLifecycleHook === "function",
    );
    if (typeof (router as any)._registerLifecycleHook === "function") {
      const registerHook = (router as any)._registerLifecycleHook;

      const unsubStart = registerHook("onNavigationStart", () => {
        console.log("[ViewLayer] onNavigationStart triggered");
        lastError = undefined;
        // Don't render during navigation start - currentMatch is still the old value
        // Just clear errors and optionally show loading state
        if (currentConfig.loadingView) {
          render(currentConfig.loadingView());
        }
      });

      const unsubComplete = registerHook(
        "onNavigationComplete",
        (match: RouteMatch | null) => {
          console.log(
            "[ViewLayer] onNavigationComplete triggered with match:",
            match
              ? {
                  route: {
                    id: match.route.id,
                    staticPath: match.route.staticPath,
                  },
                  params: match.params,
                }
              : null,
          );
          handleStateChange(match);
        },
      );

      const unsubError = registerHook("onNavigationError", (error: any) => {
        console.log("[ViewLayer] onNavigationError triggered:", error);
        lastError = {
          type: NavigationErrorType.Unknown,
          message: error?.message || "Navigation error occurred",
          originalError: error,
          route: error.route,
          params: error.params,
        };
        handleStateChange(router.currentMatch);
      });

      cleanupFunctions.push(unsubStart, unsubComplete, unsubError);
    } else {
      console.log("[ViewLayer] Using fallback subscription method");
      // Fallback for routers without lifecycle hooks (less precise but functional)
      const unsubscribe = router.subscribe((match: RouteMatch | null) => {
        console.log(
          "[ViewLayer] Subscription callback triggered with match:",
          match,
        );
        // Clear any previous errors on successful navigation
        if (match && lastError) {
          lastError = undefined;
        }
        handleStateChange(match);
      });
      cleanupFunctions.push(unsubscribe);

      // Hook into router error handling if available
      if (typeof router.onError === "function") {
        router.onError((errorContext: any) => {
          lastError = {
            type: NavigationErrorType.Unknown,
            message: errorContext.error?.message || "Navigation error occurred",
            originalError: errorContext.error,
            route: errorContext.route,
            params: errorContext.params,
          };
          handleStateChange(router.currentMatch);
        });
      }
    }

    // Initial render for the current page state when the app loads.
    const initialPath =
      window.location.pathname + window.location.search + window.location.hash;
    console.log("[ViewLayer] Initial path:", initialPath);
    const initialMatch = router.match(initialPath);
    console.log(
      "[ViewLayer] Initial match result:",
      initialMatch
        ? {
            route: {
              id: initialMatch.route.id,
              staticPath: initialMatch.route.staticPath,
            },
            params: initialMatch.params,
          }
        : null,
    );

    if (initialMatch) {
      console.log("[ViewLayer] Triggering initial navigation to:", initialPath);
      // Trigger initial navigation which will cause proper rendering via lifecycle hooks
      router.navigate(initialPath).catch((error) => {
        console.error("[ViewLayer] Initial navigation failed:", error);
        lastError = {
          type: NavigationErrorType.Unknown,
          message: `Initial navigation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          originalError: error,
        };
        handleStateChange(null);
      });
    } else {
      console.log("[ViewLayer] No initial match found, rendering 404");
      // No initial match found, render 404
      handleStateChange(null);
    }

    // Return the layer's public API and cleanup logic.
    return {
      rerender: () => handleStateChange(router.currentMatch),

      getRootElement: () => rootElement,

      updateConfig: (newConfig: Partial<ViewLayerConfig>) => {
        currentConfig = { ...currentConfig, ...newConfig };

        // Update root element if changed
        if (newConfig.root && newConfig.root !== currentConfig.root) {
          const newRoot = resolveRootElement(newConfig.root);
          if (newRoot) {
            rootElement = newRoot;
          } else {
            console.error(
              `[ViewLayer] New root element "${newConfig.root}" not found.`,
            );
          }
        }
      },

      _cleanup: () => {
        cleanupFunctions.forEach((fn) => fn());
        if (rootElement) {
          rootElement.innerHTML = "";
        }
        headManager.apply({
          title: undefined,
          meta: [],
          link: [],
          script: [],
          style: [],
          htmlAttrs: {},
          bodyAttrs: {},
          noscript: [],
        });
      },
    };
  };
}

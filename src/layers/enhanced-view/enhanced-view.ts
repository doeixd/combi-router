// =================================================================
//
//      Combi-Router: Enhanced View Layer
//
//      Extended DOM rendering with morphdom integration, HTML support,
//      and advanced nested routing capabilities
//
// =================================================================

/**
 * # Enhanced View Layer
 *
 * An advanced view layer that extends the base view layer with:
 * - Support for HTML template literals and custom templating systems
 * - Morphdom integration for efficient DOM patching
 * - Enhanced nested routing with outlet support
 * - Template function results (HTMLTemplateResult, lit-html, etc.)
 *
 * @example Basic Usage with HTML Support
 * ```typescript
 * import { html } from 'lit-html';
 *
 * const homeRoute = pipe(
 *   route(path(''), end),
 *   view(() => html`<h1>Welcome Home!</h1>`)
 * );
 * ```
 *
 * @example Morphdom Integration
 * ```typescript
 * const router = createLayeredRouter([homeRoute])
 *   (createCoreNavigationLayer())
 *   (createEnhancedViewLayer({
 *     root: '#app',
 *     useMorphdom: true,
 *     morphdomOptions: {
 *       childrenOnly: false,
 *       onBeforeElUpdated: (fromEl, toEl) => {
 *         // Custom morphdom hooks
 *         return true;
 *       }
 *     }
 *   }))
 *   ();
 * ```
 */

import type { RouterLayer, ComposableRouter } from "../../core/layer-types";
import type {
  RouteMatch,
  NavigationError,
  ViewContext,
} from "../../core/types";
import { NavigationErrorType } from "../../core/types";
import { HeadManager, resolveHeadData } from "../../features/head";

// Type definitions for various template result types
export interface TemplateResult {
  // lit-html style
  strings?: TemplateStringsArray;
  values?: unknown[];
  _$litType$?: number;
  // Other template engines might have different shapes
  [key: string]: any;
}

export interface HTMLTemplateResult {
  template?: HTMLTemplateElement;
  render?: () => Node | string;
  html?: string;
  dom?: DocumentFragment;
}

// Extended view factory that supports multiple return types
export type EnhancedViewFactory<TParams = any> = (
  context: ViewContext<TParams>
) => string | Node | TemplateResult | HTMLTemplateResult | Promise<any>;

// Morphdom options (subset of actual morphdom options)
export interface MorphdomOptions {
  childrenOnly?: boolean;
  onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean;
  onElUpdated?: (el: Element) => void;
  onBeforeNodeAdded?: (node: Node) => Node | boolean;
  onNodeAdded?: (node: Node) => void;
  onBeforeNodeDiscarded?: (node: Node) => boolean;
  onNodeDiscarded?: (node: Node) => void;
  onBeforeElChildrenUpdated?: (fromEl: Element, toEl: Element) => boolean;
}

/** Configuration for the enhanced view layer */
export interface EnhancedViewLayerConfig {
  /** The root DOM element or CSS selector to render the application into */
  root: HTMLElement | string;

  /** Enable morphdom for efficient DOM patching */
  useMorphdom?: boolean;

  /** Custom morphdom options */
  morphdomOptions?: MorphdomOptions;

  /** Custom template result renderer */
  templateRenderer?: (result: TemplateResult | HTMLTemplateResult, container: HTMLElement) => void;

  /** Optional: A factory for rendering the loading state UI */
  loadingView?: () => string | Node | TemplateResult | HTMLTemplateResult;

  /** Optional: A factory for rendering an error state UI */
  errorView?: (error: NavigationError) => string | Node | TemplateResult | HTMLTemplateResult;

  /** Optional: A factory for rendering the 404 Not Found UI */
  notFoundView?: () => string | Node | TemplateResult | HTMLTemplateResult;

  /** Optional: Custom link selector for SPA navigation (default: 'a[href]') */
  linkSelector?: string;

  /** Optional: Disable automatic link interception */
  disableLinkInterception?: boolean;

  /** Enable nested route outlet support */
  enableOutlets?: boolean;

  /** Custom outlet attribute name (default: 'router-outlet') */
  outletAttribute?: string;
}

/** Extensions provided by the Enhanced ViewLayer */
export interface EnhancedViewLayerExtensions {
  /** Manually triggers a re-render of the current view */
  rerender: () => void;

  /** Get the current root element being used for rendering */
  getRootElement: () => HTMLElement | null;

  /** Update the view layer configuration */
  updateConfig: (newConfig: Partial<EnhancedViewLayerConfig>) => void;

  /** Register a nested outlet */
  registerOutlet: (outlet: RouterOutlet) => void;

  /** Unregister a nested outlet */
  unregisterOutlet: (outlet: RouterOutlet) => void;

  /** Force a morphdom update */
  morphUpdate: (newContent: string | Node) => void;
}

/** Router outlet for nested routing */
export interface RouterOutlet {
  element: HTMLElement;
  parentRouteId?: number;
  render: (match: RouteMatch | null) => void;
}

// Utility to check if a value is a template result
function isTemplateResult(value: any): value is TemplateResult | HTMLTemplateResult {
  return value && (
    // lit-html check
    value._$litType$ !== undefined ||
    // Generic template result checks
    value.template instanceof HTMLTemplateElement ||
    value.render !== undefined ||
    value.html !== undefined ||
    value.dom instanceof DocumentFragment ||
    // Tagged template check
    (value.strings && Array.isArray(value.strings))
  );
}

// Convert various template results to DOM nodes or HTML strings
async function renderTemplateResult(
  result: TemplateResult | HTMLTemplateResult,
  customRenderer?: (result: TemplateResult | HTMLTemplateResult, container: HTMLElement) => void
): Promise<string | Node> {
  // If custom renderer is provided, use a temporary container
  if (customRenderer) {
    const tempContainer = document.createElement('div');
    customRenderer(result, tempContainer);
    return tempContainer;
  }

  // Handle lit-html style results
  if (result._$litType$) {
    // For lit-html, we'd need the actual lit-html render function
    // This is a simplified version - in production you'd import lit-html
    console.warn('[EnhancedViewLayer] lit-html detected but no renderer configured');
    return '<div>lit-html template (configure templateRenderer)</div>';
  }

  // Handle HTMLTemplateResult
  if (result.template instanceof HTMLTemplateElement) {
    return result.template.content.cloneNode(true) as DocumentFragment;
  }

  if (result.render && typeof result.render === 'function') {
    const rendered = await result.render();
    return rendered;
  }

  if (result.html && typeof result.html === 'string') {
    return result.html;
  }

  if (result.dom instanceof DocumentFragment) {
    return result.dom.cloneNode(true) as DocumentFragment;
  }

  // Fallback for unknown template results
  return JSON.stringify(result);
}

// Simple morphdom implementation (you'd normally import the actual morphdom library)
function morphdom(fromNode: Element, toNode: string | Element, options?: MorphdomOptions): Element {
  // This is a simplified implementation
  // In production, you'd use: import morphdom from 'morphdom';

  const toElement = typeof toNode === 'string'
    ? new DOMParser().parseFromString(toNode, 'text/html').body.firstElementChild!
    : toNode;

  if (!fromNode || !toElement) {
    console.error('[EnhancedViewLayer] Invalid morphdom arguments');
    return fromNode;
  }

  // Basic implementation - in production use actual morphdom
  if (options?.onBeforeElUpdated) {
    if (!options.onBeforeElUpdated(fromNode, toElement)) {
      return fromNode;
    }
  }

  // Simplified attribute sync
  Array.from(toElement.attributes).forEach(attr => {
    fromNode.setAttribute(attr.name, attr.value);
  });

  // Remove attributes not in toElement
  Array.from(fromNode.attributes).forEach(attr => {
    if (!toElement.hasAttribute(attr.name)) {
      fromNode.removeAttribute(attr.name);
    }
  });

  // Update content if text node
  if (toElement.childNodes.length === 1 && toElement.firstChild?.nodeType === Node.TEXT_NODE) {
    fromNode.textContent = toElement.textContent;
  } else {
    // More complex child reconciliation would go here
    fromNode.innerHTML = toElement.innerHTML;
  }

  if (options?.onElUpdated) {
    options.onElUpdated(fromNode);
  }

  return fromNode;
}

/**
 * Creates an Enhanced View Layer with morphdom support, template rendering,
 * and advanced nested routing capabilities.
 */
export function createEnhancedViewLayer(
  config: EnhancedViewLayerConfig
): RouterLayer<any, EnhancedViewLayerExtensions> {
  return (router: ComposableRouter<any>) => {
    let currentConfig = { ...config };
    let rootElement = resolveRootElement(currentConfig.root);

    if (!rootElement) {
      throw new Error(
        `[EnhancedViewLayer] Root element "${currentConfig.root}" not found.`
      );
    }

    const headManager = new HeadManager(document);
    let lastError: NavigationError | undefined;
    let cleanupFunctions: (() => void)[] = [];
    let registeredOutlets: Set<RouterOutlet> = new Set();
    let currentVirtualDOM: string | null = null;

    /** Resolves a root element from a selector or element */
    function resolveRootElement(root: HTMLElement | string): HTMLElement | null {
      return typeof root === 'string'
        ? document.querySelector<HTMLElement>(root)
        : root;
    }

    /** Enhanced render function with morphdom support */
    const render = async (content: string | Node | TemplateResult | HTMLTemplateResult) => {
      if (!rootElement) {
        console.log("[EnhancedViewLayer] No root element available for rendering");
        return;
      }

      // Handle template results
      if (isTemplateResult(content)) {
        content = await renderTemplateResult(content, currentConfig.templateRenderer);
      }

      // Handle async content
      if (content instanceof Promise) {
        content = await content;
      }

      // Apply morphdom if enabled
      if (currentConfig.useMorphdom && typeof content === 'string') {
        if (rootElement.innerHTML) {
          morphdom(rootElement, `<div>${content}</div>`, currentConfig.morphdomOptions);
          currentVirtualDOM = content;
        } else {
          rootElement.innerHTML = content;
          currentVirtualDOM = content;
        }
      } else if (typeof content === 'string') {
        rootElement.innerHTML = content;
        currentVirtualDOM = content;
      } else if (content instanceof Node) {
        if (currentConfig.useMorphdom && currentVirtualDOM) {
          // Create a wrapper to use morphdom with Node content
          const wrapper = document.createElement('div');
          wrapper.appendChild(content.cloneNode(true));
          morphdom(rootElement, wrapper, currentConfig.morphdomOptions);
          currentVirtualDOM = wrapper.innerHTML;
        } else {
          rootElement.innerHTML = '';
          rootElement.appendChild(content);
          currentVirtualDOM = null;
        }
      }

      // Handle nested outlets after render
      if (currentConfig.enableOutlets) {
        handleOutlets();
      }
    };

    /** Handle nested routing outlets */
    const handleOutlets = () => {
      const outletAttribute = currentConfig.outletAttribute || 'router-outlet';
      const outlets = rootElement?.querySelectorAll(`[${outletAttribute}]`);

      outlets?.forEach(outletElement => {
        const outlet: RouterOutlet = {
          element: outletElement as HTMLElement,
          parentRouteId: parseInt(outletElement.getAttribute(`${outletAttribute}-parent`) || '0'),
          render: (match: RouteMatch | null) => {
            renderOutlet(outlet, match);
          }
        };

        if (!Array.from(registeredOutlets).some(o => o.element === outletElement)) {
          registeredOutlets.add(outlet);
          outlet.render(router.currentMatch);
        }
      });
    };

    /** Render content into an outlet */
    const renderOutlet = async (outlet: RouterOutlet, match: RouteMatch | null) => {
      if (!match) {
        outlet.element.innerHTML = '';
        return;
      }

      // Find the child match for this outlet
      let childMatch = match.child;
      while (childMatch && outlet.parentRouteId) {
        if (childMatch.route.parent?.id === outlet.parentRouteId) {
          break;
        }
        childMatch = childMatch.child;
      }

      if (!childMatch) {
        outlet.element.innerHTML = '';
        return;
      }

      // Get the view factory for the child route
      const viewFactory = childMatch.route.metadata?.view as EnhancedViewFactory | undefined;
      if (viewFactory) {
        try {
          const viewContext: ViewContext = { match: childMatch };
          let content = await viewFactory(viewContext);

          // Handle template results for outlets
          if (isTemplateResult(content)) {
            content = await renderTemplateResult(content, currentConfig.templateRenderer);
          }

          // Render into outlet
          if (typeof content === 'string') {
            if (currentConfig.useMorphdom && outlet.element.innerHTML) {
              morphdom(outlet.element, `<div>${content}</div>`, currentConfig.morphdomOptions);
            } else {
              outlet.element.innerHTML = content;
            }
          } else if (content instanceof Node) {
            outlet.element.innerHTML = '';
            outlet.element.appendChild(content);
          }
        } catch (error) {
          console.error(`[EnhancedViewLayer] Error rendering outlet:`, error);
          outlet.element.innerHTML = '<div>Error rendering view</div>';
        }
      }
    };

    /** The main state handler */
    const handleStateChange = async (match: RouteMatch | null) => {
      // Head management
      if (match?.route.metadata?.view || match?.route.metadata?._head) {
        if (match.route.metadata._head) {
          const resolvedHead = resolveHeadData(match.route.metadata._head, match);
          headManager.apply(resolvedHead);
        }
      }

      // Loading state
      if (router.isFetching && currentConfig.loadingView) {
        await render(currentConfig.loadingView());
        return;
      }

      // Error state
      if (lastError && currentConfig.errorView && !lastError.message.includes("No route matches")) {
        await render(currentConfig.errorView(lastError));
        return;
      }

      // Not found state
      if (!match || (lastError && lastError.message.includes("No route matches"))) {
        if (currentConfig.notFoundView) {
          await render(currentConfig.notFoundView());
        } else {
          await render("<h2>404 - Not Found</h2>");
        }
        return;
      }

      // Render matched view
      const viewFactory = match.route.metadata?.view as EnhancedViewFactory | undefined;
      if (viewFactory) {
        try {
          const viewContext: ViewContext = { match };
          const renderedContent = await viewFactory(viewContext);
          await render(renderedContent);

          // Update outlets for nested routes
          registeredOutlets.forEach(outlet => outlet.render(match));
        } catch (error) {
          console.error(`[EnhancedViewLayer] Error rendering view:`, error);
          if (currentConfig.errorView) {
            const navigationError: NavigationError = {
              type: NavigationErrorType.Unknown,
              message: `View rendering failed: ${error instanceof Error ? error.message : "Unknown error"}`,
              originalError: error,
              route: match.route,
              params: match.params,
            };
            await render(currentConfig.errorView(navigationError));
          } else {
            await render("<div>Error rendering view</div>");
          }
        }
      } else {
        console.warn(`[EnhancedViewLayer] No view() factory found for route ${match.route.id}`);
        await render("<!-- View not configured -->");
      }
    };

    /** Intercepts clicks on local links for SPA navigation */
    const handleLinkClick = async (event: MouseEvent) => {
      if (currentConfig.disableLinkInterception) return;

      const linkSelector = currentConfig.linkSelector || "a[href]";
      const link = (event.target as HTMLElement).closest(linkSelector) as HTMLAnchorElement;

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

      lastError = undefined;

      try {
        const success = await router.navigate(href);
        if (!success) {
          console.warn("[EnhancedViewLayer] Navigation failed for:", href);
        }
      } catch (error) {
        console.error("[EnhancedViewLayer] Navigation error:", error);
        lastError = {
          type: NavigationErrorType.Unknown,
          message: `Navigation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          originalError: error,
        };
        await handleStateChange(router.currentMatch);
      }
    };

    // Set up global link click handling
    if (!currentConfig.disableLinkInterception) {
      document.body.addEventListener("click", handleLinkClick);
      cleanupFunctions.push(() =>
        document.body.removeEventListener("click", handleLinkClick)
      );
    }

    // Hook into lifecycle
    if (typeof (router as any)._registerLifecycleHook === "function") {
      const registerHook = (router as any)._registerLifecycleHook;

      const unsubStart = registerHook("onNavigationStart", async () => {
        lastError = undefined;
        if (currentConfig.loadingView) {
          await render(currentConfig.loadingView());
        }
      });

      const unsubComplete = registerHook(
        "onNavigationComplete",
        async (match: RouteMatch | null) => {
          await handleStateChange(match);
        }
      );

      const unsubError = registerHook("onNavigationError", async (error: any) => {
        lastError = {
          type: NavigationErrorType.Unknown,
          message: error?.message || "Navigation error occurred",
          originalError: error,
          route: error.route,
          params: error.params,
        };

        const is404Error = error?.message?.includes("No route matches");
        await handleStateChange(is404Error ? null : router.currentMatch);
      });

      cleanupFunctions.push(unsubStart, unsubComplete, unsubError);
    } else {
      // Fallback subscription
      const unsubscribe = router.subscribe(async (match: RouteMatch | null) => {
        if (match && lastError) {
          lastError = undefined;
        }
        await handleStateChange(match);
      });
      cleanupFunctions.push(unsubscribe);
    }

    // Initial render
    const initialPath = window.location.pathname + window.location.search + window.location.hash;
    const initialMatch = router.match(initialPath);

    if (initialMatch && !router.currentMatch) {
      router._setCurrentMatch(initialMatch);
      handleStateChange(initialMatch);
    } else {
      handleStateChange(router.currentMatch);
    }

    // Return the layer's public API
    return {
      rerender: () => handleStateChange(router.currentMatch),

      getRootElement: () => rootElement,

      updateConfig: (newConfig: Partial<EnhancedViewLayerConfig>) => {
        currentConfig = { ...currentConfig, ...newConfig };

        if (newConfig.root && newConfig.root !== currentConfig.root) {
          const newRoot = resolveRootElement(newConfig.root);
          if (newRoot) {
            rootElement = newRoot;
          } else {
            console.error(`[EnhancedViewLayer] New root element "${newConfig.root}" not found.`);
          }
        }
      },

      registerOutlet: (outlet: RouterOutlet) => {
        registeredOutlets.add(outlet);
        outlet.render(router.currentMatch);
      },

      unregisterOutlet: (outlet: RouterOutlet) => {
        registeredOutlets.delete(outlet);
      },

      morphUpdate: async (newContent: string | Node) => {
        if (currentConfig.useMorphdom && rootElement) {
          if (typeof newContent === 'string') {
            morphdom(rootElement, `<div>${newContent}</div>`, currentConfig.morphdomOptions);
            currentVirtualDOM = newContent;
          } else {
            const wrapper = document.createElement('div');
            wrapper.appendChild(newContent.cloneNode(true));
            morphdom(rootElement, wrapper, currentConfig.morphdomOptions);
            currentVirtualDOM = wrapper.innerHTML;
          }
        }
      },

      _cleanup: () => {
        cleanupFunctions.forEach((fn) => fn());
        registeredOutlets.clear();
        if (rootElement) {
          rootElement.innerHTML = "";
        }
        currentVirtualDOM = null;
      },
    };
  };
}

// =================================================================
//
//      Combi-Router: Nested Routing Utilities
//
//      Advanced utilities for hierarchical routing patterns
//
// =================================================================

import type { Route } from "../../core/route";
import type { RouteMatch } from "../../core/types";
import type { ComposableRouter } from "../../core/layer-types";
import type { EnhancedViewFactory, RouterOutlet } from "./enhanced-view";

/**
 * Configuration for nested routing
 */
export interface NestedRouterConfig {
  /** Parent route that contains the nested routes */
  parentRoute: Route<any>;

  /** Child routes that should be nested under the parent */
  childRoutes: Route<any>[];

  /** Optional outlet element or selector */
  outlet?: HTMLElement | string;

  /** Whether to automatically manage outlet lifecycle */
  autoManageOutlet?: boolean;
}

/**
 * Outlet configuration options
 */
export interface OutletConfig {
  /** The element to use as the outlet */
  element: HTMLElement;

  /** Parent route ID to match against */
  parentRouteId?: number;

  /** Custom render function for the outlet */
  render?: (match: RouteMatch | null, element: HTMLElement) => void;

  /** Transition configuration */
  transition?: {
    enter?: string;
    leave?: string;
    duration?: number;
  };

  /** Whether to preserve scroll position when changing routes */
  preserveScroll?: boolean;

  /** Loading view to show while route is loading */
  loadingView?: () => string | Node;

  /** Error view to show when route fails */
  errorView?: (error: Error) => string | Node;
}

/**
 * Creates a nested router that manages parent-child route relationships
 *
 * @example
 * ```typescript
 * const nestedRouter = createNestedRouter({
 *   parentRoute: dashboardRoute,
 *   childRoutes: [
 *     dashboardOverviewRoute,
 *     dashboardAnalyticsRoute,
 *     dashboardSettingsRoute
 *   ],
 *   outlet: '#dashboard-outlet'
 * });
 * ```
 */
export function createNestedRouter(config: NestedRouterConfig): {
  parent: Route<any>;
  children: Route<any>[];
  outlets: Map<string, RouterOutlet>;
  findChildMatch: (match: RouteMatch | null) => RouteMatch | null;
  renderChild: (match: RouteMatch | null, outlet?: HTMLElement) => void;
  destroy: () => void;
} {
  const { parentRoute, childRoutes, outlet: outletConfig, autoManageOutlet = true } = config;
  const outlets = new Map<string, RouterOutlet>();
  const cleanupFunctions: (() => void)[] = [];

  // Resolve outlet element if provided
  let outletElement: HTMLElement | null = null;
  if (outletConfig) {
    outletElement = typeof outletConfig === 'string'
      ? document.querySelector<HTMLElement>(outletConfig)
      : outletConfig;
  }

  /**
   * Find the child match for the parent route
   */
  const findChildMatch = (match: RouteMatch | null): RouteMatch | null => {
    if (!match) return null;

    let current: RouteMatch | null = match;

    // Walk up the match tree to find the parent
    while (current) {
      if (current.route.id === parentRoute.id) {
        return current.child || null;
      }
      current = current.child || null;
    }

    return null;
  };

  /**
   * Render a child route into an outlet
   */
  const renderChild = (match: RouteMatch | null, outlet?: HTMLElement): void => {
    const targetOutlet = outlet || outletElement;
    if (!targetOutlet) {
      console.warn('[NestedRouter] No outlet element available for rendering');
      return;
    }

    const childMatch = findChildMatch(match);

    if (!childMatch) {
      // Clear the outlet
      targetOutlet.innerHTML = '';
      return;
    }

    // Find the matching child route
    const childRoute = childRoutes.find(r => r.id === childMatch.route.id);
    if (!childRoute) {
      console.warn(`[NestedRouter] No child route found for match ${childMatch.route.id}`);
      return;
    }

    // Get the view factory
    const viewFactory = childMatch.route.metadata?.view as EnhancedViewFactory | undefined;
    if (viewFactory) {
      try {
        const content = viewFactory({ match: childMatch });

        if (typeof content === 'string') {
          targetOutlet.innerHTML = content;
        } else if (content instanceof Node) {
          targetOutlet.innerHTML = '';
          targetOutlet.appendChild(content);
        }
      } catch (error) {
        console.error('[NestedRouter] Error rendering child view:', error);
        targetOutlet.innerHTML = '<div>Error rendering view</div>';
      }
    }
  };

  // Auto-manage outlet if configured
  if (autoManageOutlet && outletElement) {
    const outlet: RouterOutlet = {
      element: outletElement,
      parentRouteId: parentRoute.id,
      render: (match) => renderChild(match, outletElement)
    };

    outlets.set('default', outlet);
  }

  return {
    parent: parentRoute,
    children: childRoutes,
    outlets,
    findChildMatch,
    renderChild,
    destroy: () => {
      cleanupFunctions.forEach(fn => fn());
      outlets.clear();
    }
  };
}

/**
 * Creates a router outlet that automatically renders child routes
 *
 * @example
 * ```typescript
 * const outlet = createRouterOutlet(router, {
 *   element: document.querySelector('#outlet'),
 *   parentRouteId: dashboardRoute.id,
 *   transition: {
 *     enter: 'fade-in',
 *     leave: 'fade-out',
 *     duration: 300
 *   }
 * });
 * ```
 */
export function createRouterOutlet(
  router: ComposableRouter<any>,
  config: OutletConfig
): RouterOutlet & {
  update: (match: RouteMatch | null) => void;
  clear: () => void;
  destroy: () => void;
} {
  const {
    element,
    parentRouteId,
    render: customRender,
    transition,
    preserveScroll = false,
    loadingView,
    errorView
  } = config;

  let currentMatch: RouteMatch | null = null;
  let currentView: Node | null = null;
  let isTransitioning = false;

  /**
   * Apply transition classes to an element
   */
  const applyTransition = (el: Element, type: 'enter' | 'leave'): Promise<void> => {
    return new Promise(resolve => {
      if (!transition || !transition[type]) {
        resolve();
        return;
      }

      const className = transition[type];
      const duration = transition.duration || 300;

      el.classList.add(className);

      setTimeout(() => {
        el.classList.remove(className);
        resolve();
      }, duration);
    });
  };

  /**
   * Default render function
   */
  const defaultRender = async (match: RouteMatch | null): Promise<void> => {
    // Handle loading state
    if (router.isFetching && loadingView) {
      const loading = loadingView();
      if (typeof loading === 'string') {
        element.innerHTML = loading;
      } else {
        element.innerHTML = '';
        element.appendChild(loading);
      }
      return;
    }

    // Clear if no match
    if (!match) {
      if (currentView && transition?.leave) {
        await applyTransition(element, 'leave');
      }
      element.innerHTML = '';
      currentView = null;
      return;
    }

    // Find the relevant child match
    let childMatch: RouteMatch | null = null;

    if (parentRouteId) {
      let current: RouteMatch | null = match;
      while (current) {
        if (current.route.parent?.id === parentRouteId) {
          childMatch = current;
          break;
        }
        current = current.child || null;
      }
    } else {
      childMatch = match;
    }

    if (!childMatch) {
      element.innerHTML = '';
      currentView = null;
      return;
    }

    // Get the view factory
    const viewFactory = childMatch.route.metadata?.view as EnhancedViewFactory | undefined;

    if (!viewFactory) {
      console.warn(`[RouterOutlet] No view factory for route ${childMatch.route.id}`);
      return;
    }

    try {
      // Apply leave transition to old content
      if (currentView && transition?.leave) {
        isTransitioning = true;
        await applyTransition(element, 'leave');
      }

      // Render new content
      const content = await viewFactory({ match: childMatch });

      // Clear and update
      element.innerHTML = '';

      if (typeof content === 'string') {
        element.innerHTML = content;
        currentView = element.firstChild as Node;
      } else if (content instanceof Node) {
        element.appendChild(content);
        currentView = content;
      }

      // Apply enter transition
      if (transition?.enter && currentView) {
        await applyTransition(element, 'enter');
      }

      isTransitioning = false;

      // Restore scroll if needed
      if (!preserveScroll) {
        element.scrollTop = 0;
      }

    } catch (error) {
      console.error('[RouterOutlet] Error rendering view:', error);

      if (errorView) {
        const errorContent = errorView(error instanceof Error ? error : new Error(String(error)));
        if (typeof errorContent === 'string') {
          element.innerHTML = errorContent;
        } else {
          element.innerHTML = '';
          element.appendChild(errorContent);
        }
      } else {
        element.innerHTML = '<div>Error rendering view</div>';
      }

      isTransitioning = false;
    }
  };

  /**
   * The render function called by the router
   */
  const render = (match: RouteMatch | null): void => {
    currentMatch = match;

    if (customRender) {
      customRender(match, element);
    } else {
      defaultRender(match);
    }
  };

  /**
   * Update the outlet with a new match
   */
  const update = (match: RouteMatch | null): void => {
    if (!isTransitioning) {
      render(match);
    }
  };

  /**
   * Clear the outlet content
   */
  const clear = (): void => {
    element.innerHTML = '';
    currentView = null;
    currentMatch = null;
  };

  /**
   * Destroy the outlet and clean up
   */
  const destroy = (): void => {
    clear();
  };

  // Subscribe to router changes
  const unsubscribe = router.subscribe(update);

  // Initial render
  update(router.currentMatch);

  return {
    element,
    parentRouteId,
    render,
    update,
    clear,
    destroy: () => {
      unsubscribe();
      destroy();
    }
  };
}

/**
 * Helper to find all outlets in a container
 */
export function findOutlets(
  container: HTMLElement,
  attribute: string = 'router-outlet'
): HTMLElement[] {
  return Array.from(container.querySelectorAll(`[${attribute}]`));
}

/**
 * Helper to automatically set up outlets for a route hierarchy
 */
export function setupAutoOutlets(
  router: ComposableRouter<any>,
  routes: Route<any>[],
  container: HTMLElement = document.body,
  attribute: string = 'router-outlet'
): () => void {
  const outlets: RouterOutlet[] = [];
  const cleanupFunctions: (() => void)[] = [];

  // Find all outlet elements
  const outletElements = findOutlets(container, attribute);

  outletElements.forEach(element => {
    const parentId = element.getAttribute(`${attribute}-parent`);
    const parentRouteId = parentId ? parseInt(parentId) : undefined;

    const outlet = createRouterOutlet(router, {
      element,
      parentRouteId,
      transition: {
        enter: element.getAttribute(`${attribute}-enter`) || undefined,
        leave: element.getAttribute(`${attribute}-leave`) || undefined,
        duration: parseInt(element.getAttribute(`${attribute}-duration`) || '300')
      },
      preserveScroll: element.hasAttribute(`${attribute}-preserve-scroll`)
    });

    outlets.push(outlet);
    cleanupFunctions.push(outlet.destroy);
  });

  // Return cleanup function
  return () => {
    cleanupFunctions.forEach(fn => fn());
  };
}

/**
 * Creates a route group with shared configuration
 */
export function createRouteGroup(
  parentRoute: Route<any>,
  childConfigs: Array<{
    path: string;
    view: EnhancedViewFactory<any>;
    loader?: (context: any) => Promise<any>;
    guards?: any[];
  }>
): Route<any>[] {
  // This would need the actual route building functions
  // Simplified version for demonstration
  return childConfigs.map(config => {
    // In practice, you'd use extend() and other route builders here
    const childRoute = Object.create(parentRoute);
    childRoute.metadata = {
      ...parentRoute.metadata,
      view: config.view,
      loader: config.loader,
      guards: config.guards
    };
    return childRoute;
  });
}

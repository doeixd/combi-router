// =================================================================
//
//      Combi-Router: Framework-Agnostic Integration Helpers
//
//      This module provides vanilla JavaScript functions to connect
//      your router with the DOM, creating navigable links and
//      implementing conditional logic based on the active route.
//
// =================================================================

import {
  CombiRouter,
  Route,
  RouteMatch,
} from './index'; // Adjust path if necessary

// =================================================================
// -------------------- LINK & NAVIGATION HELPERS ------------------
// =================================================================

/** Options for creating a navigable link element. */
export interface LinkOptions {
  /** Text, an HTML Element, or an array of them to be the link's content. */
  children?: string | Node | (string | Node)[];
  /** A CSS class name to apply to the link. */
  className?: string;
  /** A key-value map of additional HTML attributes to set on the element. */
  attributes?: Record<string, string>;
}

/** Options for creating a link that can show an 'active' state. */
export interface ActiveLinkOptions extends LinkOptions {
    /** A CSS class name to apply only when the link's route is active. */
    activeClassName?: string;
    /** If true, the link is only "active" on an exact match. If false, it's active for child routes too. @default false */
    exact?: boolean;
}

/**
 * Creates a fully functional `<a>` element that navigates using the router.
 * It handles the `href` and intercepts click events for client-side navigation.
 * For a link that also tracks its active state, use `createActiveLink`.
 *
 * @param router The router instance.
 * @param route The `Route` object to navigate to.
 * @param params The type-safe parameters for the route.
 * @param options Configuration for the link's appearance and content.
 * @returns An object containing the created `element` and a `destroy` function for cleanup.
 *
 * @example
 * const { element, destroy } = createLink(
 *   router,
 *   userRoute,
 *   { id: 123 },
 *   { children: 'View Profile' }
 * );
 * document.body.appendChild(element);
 * // Later, when the element is removed from the DOM:
 * // destroy();
 */
export function createLink<T>(
  router: CombiRouter,
  route: Route<T>,
  params: T,
  options: LinkOptions = {}
): { element: HTMLAnchorElement; destroy: () => void } {
  const element = document.createElement('a');
  const href = router.build(route, params);

  if (href === null) {
    throw new Error(`[createLink] Failed to build href for route. A required parameter may be missing.`);
  }

  element.href = href;

  if (options.className) element.className = options.className;
  if (options.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      element.setAttribute(key, value);
    }
  }
  if (options.children) {
    const children = Array.isArray(options.children) ? options.children : [options.children];
    element.append(...children);
  }

  const handleClick = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    router.navigate(route, params);
  };

  element.addEventListener('click', handleClick);

  return { element, destroy: () => element.removeEventListener('click', handleClick) };
}

/**
 * Creates an `<a>` element that automatically updates its CSS class based on the active route.
 * This is the primary helper for building navigation menus.
 *
 * @param router The router instance.
 * @param route The `Route` object this link points to.
 * @param params The type-safe parameters for the route.
 * @param options Configuration including the `activeClassName`.
 * @returns An object with the `element` and a `destroy` function.
 *
 * @example
 * const { element } = createActiveLink(router, dashboardRoute, {}, {
 *   children: 'Dashboard',
 *   activeClassName: 'font-bold' // This class is applied when on /dashboard or /dashboard/users
 * });
 */
export function createActiveLink<T>(
  router: CombiRouter,
  route: Route<T>,
  params: T,
  options: ActiveLinkOptions
): { element: HTMLAnchorElement; destroy: () => void } {
    const { element, destroy: destroyLink } = createLink(router, route, params, options);

    const handleRouteChange = (match: RouteMatch | null) => {
        if (!options.activeClassName) return;

        let isActive = false;
        if (match) {
            // Check if the link's route is an ancestor of (or is) the current route.
            let current: RouteMatch | undefined = match;
            while(current) {
                if (current.route.id === route.id) {
                    // It's a match. If `exact` is required, it must be the top-level match.
                    isActive = options.exact ? current === match : true;
                    break;
                }
                current = current.child;
            }
        }
        element.classList.toggle(options.activeClassName, isActive);
    };

    const unsubscribe = router.subscribe(handleRouteChange);
    
    return {
        element,
        destroy: () => {
            destroyLink();
            unsubscribe();
        }
    };
}

/**
 * Attaches a navigation click listener to any existing HTML element.
 * @param element The DOM element to make clickable.
 * @param router The router instance.
 * @param route The `Route` object to navigate to.
 * @param params The type-safe parameters for the route.
 * @returns An object containing a `destroy` function to remove the listener.
 *
 * @example
 * const myButton = document.getElementById('my-button');
 * const { destroy } = attachNavigator(myButton, router, homeRoute, {});
 */
export function attachNavigator<T>(
  element: HTMLElement,
  router: CombiRouter,
  route: Route<T>,
  params: T
): { destroy: () => void } {
  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    router.navigate(route, params);
  };

  element.addEventListener('click', handleClick);
  return { destroy: () => element.removeEventListener('click', handleClick) };
}

// =================================================================
// -------------------- CONDITIONAL RENDERING ----------------------
// =================================================================

/** A function that creates a DOM Node, receiving the type-safe route match context. */
export type ElementFactory<TParams> = (match: RouteMatch<TParams>) => Node;

/**
 * A declarative "outlet" for nested routing in vanilla JS. It listens to route
 * changes and renders the view for the appropriate child route within a parent container.
 *
 * @param router The router instance.
 * @param parentRoute The route of the component that *contains* this outlet.
 * @param container The DOM element where child views will be rendered.
 * @param viewMap A map where keys are `Route` objects and values are `ElementFactory` functions.
 * @returns An object with a `destroy` function to stop listening and clean up.
 *
 * @example
 * // In dashboard-layout.js
 * const outletContainer = document.querySelector('#outlet');
 * createOutlet(router, dashboardRoute, outletContainer, [
 *   [usersRoute, (match) => new UserListPage(match.data)],
 *   [settingsRoute, () => new SettingsPage()],
 * ]);
 */
export function createOutlet(
    router: CombiRouter,
    parentRoute: Route<any>,
    container: HTMLElement,
    viewMap: Array<[Route<any>, ElementFactory<any>]>
): { destroy: () => void } {
    let currentElement: Node | null = null;
    let currentRouteId: number | null = null;
    
    const handleRouteChange = (match: RouteMatch<any> | null) => {
        let childMatch: RouteMatch | undefined;
        
        let current: RouteMatch | undefined | null = match;
        while(current) {
            if (current.route.id === parentRoute.id) {
                childMatch = current.child;
                break;
            }
            current = current.child;
        }

        const newRouteId = childMatch?.route.id ?? null;

        if (newRouteId !== currentRouteId) {
            if (currentElement) container.removeChild(currentElement);
            currentElement = null;
            
            if (childMatch) {
                const viewEntry = viewMap.find(entry => entry[0].id === childMatch.route.id);
                if (viewEntry) {
                    const factory = viewEntry[1];
                    currentElement = factory(childMatch);
                    container.appendChild(currentElement);
                }
            }
            currentRouteId = newRouteId;
        }
    };

    const unsubscribe = router.subscribe(handleRouteChange);
    return { destroy: unsubscribe };
}

/**
 * Creates a fluent, type-safe conditional matcher that reacts to route changes.
 * This is a powerful tool for declarative logic outside of rendering.
 *
 * @param router The router instance.
 * @returns A `Matcher` instance to define conditions.
 *
 * @example
 * // Example: Update the document title based on the active route
 * createMatcher(router)
 *   .when(homeRoute, () => { document.title = 'Home'; })
 *   .when(userRoute, (match) => { document.title = `User: ${match.params.id}`; })
 *   .otherwise(() => { document.title = 'My App'; });
 */
export function createMatcher(router: CombiRouter) {
  const conditions: { route: Route<any>; callback: (match: RouteMatch<any>) => any }[] = [];
  
  const matcherInstance = {
    when<P>(route: Route<P>, callback: (match: RouteMatch<P>) => any) {
      conditions.push({ route, callback: callback as any });
      return this;
    },
    otherwise(otherwiseCallback: (match: RouteMatch<any> | null) => any): { destroy: () => void } {
      const runMatch = (currentMatch: RouteMatch<any> | null) => {
        if (currentMatch) {
          for (const condition of conditions) {
            if (currentMatch.route.id === condition.route.id) {
              condition.callback(currentMatch);
              return;
            }
          }
        }
        otherwiseCallback(currentMatch);
      };
      const unsubscribe = router.subscribe(runMatch);
      return { destroy: unsubscribe };
    },
  };

  return matcherInstance;
}

// =================================================================
// ----------------- STATE MANAGEMENT & STORES ---------------------
// =================================================================

/** A minimal, framework-agnostic reactive store for router state. */
export interface RouterStore {
    /** Subscribe to changes in the store. */
    subscribe: (listener: () => void) => () => void;
    /** Get a non-reactive snapshot of the current state. */
    getSnapshot: () => {
        match: RouteMatch<any> | null;
        isNavigating: boolean;
        isFetching: boolean;
    };
}

/**
 * Creates a reactive store that synchronizes with the router's state.
 * This is useful for integrating with UI libraries like Svelte or for building
 * custom reactive hooks in vanilla JS.
 *
 * @param router The router instance.
 * @returns A `RouterStore` object.
 *
 * @example
 * const store = createRouterStore(router);
 *
 * const unsubscribe = store.subscribe(() => {
 *   const { match, isNavigating } = store.getSnapshot();
 *   console.log('Is navigating?', isNavigating);
 *   document.body.style.cursor = isNavigating ? 'wait' : 'default';
 * });
 */
export function createRouterStore(router: CombiRouter): RouterStore {
  const listeners = new Set<() => void>();
  
  // The store's internal state, kept in sync with the router.
  let state = {
    match: router.currentMatch,
    isNavigating: router.isNavigating,
    isFetching: router.isFetching,
  };

  // The function that updates the store state and notifies listeners.
  const update = () => {
    state = {
        match: router.currentMatch,
        isNavigating: router.isNavigating,
        isFetching: router.isFetching,
    };
    listeners.forEach(l => l());
  };

  // Subscribe to the main router match changes.
  const unsubscribeMatch = router.subscribe(update);
  
  // To accurately track isNavigating/isFetching, we need to tap into the
  // navigation lifecycle. The easiest way is to wrap the router's navigate method.
  // A more advanced router might provide `onNavStart` and `onNavEnd` events.
  const originalNavigate = router.navigate.bind(router);
  (router as any).navigate = async (...args: any[]) => {
      // Set navigating state to true and immediately update the store.
      router.isNavigating = true;
      update();
      try {
          return await originalNavigate(args?.[0], args?.[1]);
      } finally {
          // Once navigation completes (or fails), set state back to false and update.
          router.isNavigating = false;
          router.isFetching = false; // isFetching is reset at the end of nav
          update();
      }
  };

  const destroy = () => {
    unsubscribeMatch();
    (router as any).navigate = originalNavigate; // Restore original method on cleanup
  };

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      // Return an unsubscribe function specific to this listener
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return state;
    },
    // Note: The store itself doesn't need to be destroyed, but if the app architecture
    // requires it, the `destroy` function could be exposed here.
    // @ts-ignore
    destroy
  };
}
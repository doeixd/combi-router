/**
 * @file A standalone version of the @doeixd/combi-router Web Components that can be imported independently.
 * This version imports from the published '@doeixd/combi-router' package instead of relative paths.
 *
 * @copyright 2025
 * @license MIT
 * 
 * @example
 * // Import the standalone components
 * import '@doeixd/combi-router/components-standalone';
 * 
 * // Use in HTML
 * <view-area match="/users/:id" view-id="user-detail"></view-area>
 * <template is="view-template" view-id="user-detail">
 *   <h1>User Details</h1>
 * </template>
 */

import {
  createRouter,
  route,
  path,
  param,
  CombiRouter,
  RouteMatch,
  StandardSchemaV1,
  Route as CombiRoute,
} from './index';

// --- Shared Router Manager ---

/**
 * A singleton Mediator that manages the global router instance, discovers routes from
 * DOM elements, and orchestrates communication between components.
 * @internal
 */
const RouterManager = (() => {
  let routerInstance: CombiRouter | undefined;
  const routeDefinitions = new Map<ViewArea, CombiRoute>();
  const guardDefinitions = new Map<string, () => Promise<(match: RouteMatch) => boolean | string>>();
  const loaderDefinitions = new Map<string, () => Promise<(match: RouteMatch) => any>>();
  let isInitialized = false;

  /**
   * Rebuilds or updates the central @doeixd/combi-router instance with the current set of routes.
   * This is called whenever a <view-area> is added or removed from the DOM.
   */
  const rebuildRouter = () => {
    const allRoutes = Array.from(routeDefinitions.values());
    if (routerInstance) {
      // Router now supports dynamic route management
      // Clear existing routes and add new ones
      const existingRoutes = routerInstance.routes.slice();
      for (const route of existingRoutes) {
        routerInstance.removeRoute(route);
      }
      for (const route of allRoutes) {
        routerInstance.addRoute(route);
      }
    } else {
      routerInstance = createRouter(allRoutes);
      // Attach global listeners only on the very first initialization.
      attachGlobalListeners();
    }
  };
  
  /**
   * Attaches the global click interceptor and performs the initial navigation.
   */
  const attachGlobalListeners = () => {
    // Expose for debugging and external use.
    (window as any).myAppRouter = routerInstance;

    // Match the current URL to display the appropriate view
    const currentMatch = routerInstance!.match(window.location.pathname + window.location.search);
    if (currentMatch) {
      routerInstance!.navigate(currentMatch.route, currentMatch.params);
    }
    
    // Intercept all <a> clicks for SPA navigation.
    document.documentElement.addEventListener('click', (event) => {
      const link = (event.target as HTMLElement).closest('a');
      // Ignore modified clicks, external links, or download links.
      if (!link || link.origin !== window.location.origin || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      const href = link.getAttribute('href');
      if (routerInstance && href) {
        const match = routerInstance.match(href);
        if (match) {
          routerInstance.navigate(match.route, match.params);
        }
      }
    });
  };

  /**
   * Creates a CombiRoute object for a given <view-area>, incorporating its
   * associated guard and loader functions.
   * @param {ViewArea} viewArea - The component defining the route.
   * @returns {CombiRoute} The configured route object.
   */
  const createRouteForViewArea = (viewArea: ViewArea): CombiRoute => {
      const matchPattern = viewArea.getAttribute('match') || '';
      const matchers = parseMatchAttribute(matchPattern);
      
      const template = document.querySelector(`template[is="view-template"][view-id="${viewArea.getAttribute('view-id')}"]`);
      const loaderId = template?.getAttribute('loader-id');
      const loaderFn = loaderId ? loaderDefinitions.get(loaderId) : undefined;
      
      const guardId = viewArea.getAttribute('guard-id');
      const guardFnLoader = guardId ? guardDefinitions.get(guardId) : undefined;

      const routeConfig: any = {};
      if (loaderFn) {
          routeConfig.loader = async (match: RouteMatch) => (await loaderFn())(match);
      }
      if (guardFnLoader) {
          routeConfig.guard = async (match: RouteMatch) => {
            try {
              const canActivate = await guardFnLoader();
              return await canActivate(match);
            } catch(e) {
              console.error(`Error executing guard '${guardId}':`, e);
              return false; // Fail securely by blocking navigation.
            }
          };
      }
      return route(...matchers, routeConfig);
  };

  return {
    /**
     * Retrieves the central router instance.
     * @returns {CombiRouter | undefined}
     */
    getRouter: () => routerInstance,

    /**
     * Registers a <view-area> component, creates its route, and rebuilds the router.
     * @param {ViewArea} viewArea - The view area element being registered.
     * @returns {CombiRoute} The newly created route.
     */
    registerViewArea: (viewArea: ViewArea): CombiRoute => {
      const newRoute = createRouteForViewArea(viewArea);
      routeDefinitions.set(viewArea, newRoute);
      if (isInitialized) {
        rebuildRouter();
      } else { 
        isInitialized = true;
        // Batch all initial registrations from the first DOM paint.
        setTimeout(rebuildRouter, 0); 
      }
      return newRoute;
    },

    /**
     * Unregisters a <view-area> when it's removed from the DOM and rebuilds the router.
     * @param {ViewArea} viewArea - The view area element being unregistered.
     */
    unregisterViewArea: (viewArea: ViewArea): void => {
      routeDefinitions.delete(viewArea);
      if(isInitialized) rebuildRouter();
    },

    /**
     * Registers a guard function loader.
     * @param {string} guardId - The unique identifier for the guard.
     * @param {string} src - The path to the JavaScript module.
     */
    registerGuard: (guardId: string, src: string): void => {
      let module: any;
      guardDefinitions.set(guardId, async () => {
        if (!module) module = await import(src);
        if (typeof module.canActivate !== 'function') throw new Error(`Guard module ${src} must export a 'canActivate' function.`);
        return module.canActivate;
      });
    },

    /**
     * Registers a data loader function.
     * @param {string} loaderId - The unique identifier for the loader.
     * @param {string} src - The path to the JavaScript module.
     */
    registerLoader: (loaderId: string, src: string): void => {
      let module: any;
      loaderDefinitions.set(loaderId, async () => {
        if (!module) module = await import(src);
        if (typeof module.load !== 'function') throw new Error(`Loader module ${src} must export a 'load' function.`);
        return module.load;
      });
    }
  };
})();

// --- Helper Functions ---

/** A minimal Standard Schema for validating URL parameters as strings. */
const StringSchema: StandardSchemaV1<unknown, string> = { '~standard': { version: 1, vendor: 'example', validate: v => ({ value: String(v) }), types: {input: '', output: ''} } };

/**
 * Parses a URL-like pattern string into an array of @doeixd/combi-router matchers.
 * @param {string} pattern - The pattern from the `match` attribute (e.g., "/users/:id").
 * @returns {Array<Function>} An array of matcher functions.
 */
function parseMatchAttribute(pattern: string): any[] {
  if (pattern === '*') return [(path as any).wildcard('wildcard')];
  const parts = pattern.split('/').filter(p => p.length > 0);
  // Do not add `end()` here, as it would prevent nested routing.
  return parts.map(part => part.startsWith(':') ? param(part.substring(1), StringSchema) : path(part));
}

// --- Web Components ---

/**
 * Declares route authorization logic. It is linked to a <view-area> by `guard-id`.
 * @element guard-element
 * @attr {string} guard-id - A unique ID to reference this guard.
 * @attr {string} src - Path to the JS module exporting a `canActivate` function.
 */
class Guard extends HTMLElement {
  connectedCallback() {
    this.style.display = 'none';
    const id = this.getAttribute('guard-id'), src = this.getAttribute('src');
    if (id && src) RouterManager.registerGuard(id, src);
  }
}

/**
 * Declares data-fetching logic. It is linked to a <view-template> by `loader-id`.
 * @element loader-element
 * @attr {string} loader-id - A unique ID to reference this loader.
 * @attr {string} src - Path to the JS module exporting a `load` function.
 */
class Loader extends HTMLElement {
  connectedCallback() {
    this.style.display = 'none';
    const id = this.getAttribute('loader-id'), src = this.getAttribute('src');
    if (id && src) RouterManager.registerLoader(id, src);
  }
}

/**
 * A container that activates when its `match` pattern corresponds to the URL.
 * It renders the appropriate view and manages its lifecycle.
 * @element view-area
 * @attr {string} match - The URL pattern for this view boundary (e.g., "/users/:id").
 * @attr {string} view-id - An ID that links this area to a <view-template>.
 * @attr {boolean} [transition=false] - If true, use the View Transitions API for animations.
 * @attr {boolean} [cache-nodes=false] - If true, preserve the view's DOM nodes in memory when inactive.
 * @attr {'top'|'bottom'|'none'} [scroll] - Controls scroll behavior on update.
 */
class ViewArea extends HTMLElement {
  private viewId = '';
  private route: CombiRoute | null = null;
  private unsubscribe: (() => void) | null = null;
  private nodeCache = new Map<string, DocumentFragment>();
  private activeNode: ChildNode | null = null;
  private _srcCache = new Map<string, string>();

  connectedCallback() {
    this.viewId = this.getAttribute('view-id') || `view-${Math.random().toString(36).substr(2, 9)}`;
    this.route = RouterManager.registerViewArea(this);
    setTimeout(() => {
      const router = RouterManager.getRouter();
      if (router) this.unsubscribe = router.subscribe(this.handleRouteChange);
    }, 0);
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
    RouterManager.unregisterViewArea(this);
    this.nodeCache.clear(); // Clear cache on removal
  }
  
  /**
   * Main router subscription handler. Determines if this view area should be active.
   * @param {RouteMatch | null} matchTree - The current route match tree from the router.
   */
  private handleRouteChange = (matchTree: RouteMatch | null) => {
    if (!this.route) return;
    let myMatch: RouteMatch | null = null;
    for (let m = matchTree; m; m = m.child || null) {
      if (m.route.id === this.route.id) { myMatch = m; break; }
    }
    
    if (myMatch && !this.activeNode) {
      this.render(myMatch);
    } else if (!myMatch && this.activeNode) {
      this.clear();
    }
  };

  /**
   * Renders the view content into the DOM, handling transitions.
   * @param {RouteMatch} match - The route match data for this view.
   */
  private async render(match: RouteMatch) {
    const template = document.querySelector(`template[is="view-template"][view-id="${this.viewId}"]`);
    if (!template) return;

    const useTransition = this.hasAttribute('transition') && 'startViewTransition' in document;
    
    const updateDOM = async () => {
      const mode = template.getAttribute('mode') || 'replace';
      if (mode === 'replace') this.clearAllViews();

      const cacheKey = template.getAttribute('src') || `inline_${template.innerHTML}`;
      
      if (this.hasAttribute('cache-nodes') && this.nodeCache.has(cacheKey)) {
        const cachedFragment = this.nodeCache.get(cacheKey);
        if (cachedFragment) {
          this.appendChild(cachedFragment);
          this.activeNode = this.lastChild;
        }
      } else {
        const src = template.getAttribute('src');
        this.activeNode = src 
            ? await this._streamViewFromSrc(src)
            : this._renderInlineView(template);
      }
      
      // Pass route data (including loaded data) to the new view.
      if (this.activeNode) {
        this.activeNode.dispatchEvent(new CustomEvent('match-changed', { detail: { match }, bubbles: true, composed: true }));
      }
      this._performScroll(this.activeNode);
    };

    if (useTransition) {
        (document as any).startViewTransition(updateDOM);
    } else {
        updateDOM();
    }
  }
  
  /**
   * Clears the currently active view, caching its nodes if required.
   */
  private clear() {
    if (!this.activeNode) return;
    const template = document.querySelector(`template[is="view-template"][view-id="${this.viewId}"]`);
    if (!template) return;

    if (this.hasAttribute('cache-nodes')) {
        const cacheKey = template.getAttribute('src') || `inline_${template.innerHTML}`;
        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.activeNode);
        this.nodeCache.set(cacheKey, fragment);
    } else {
        this.activeNode.parentElement?.removeChild(this.activeNode);
    }
    this.activeNode = null;
  }

  /** Clears all content, ignoring the node cache. Used in 'replace' mode. */
  private clearAllViews() {
      this.innerHTML = '';
      this.activeNode = null;
  }
  
  /** Renders an inline <template> into the DOM. */
  private _renderInlineView(template: any) {
    const content = template.content.cloneNode(true);
    this.appendChild(content);
    return this.lastChild;
  }
  
  /** Fetches, streams, and renders remote HTML content. */
  private async _streamViewFromSrc(src: string) {
    const streamWrapper = document.createElement('div');
    this.appendChild(streamWrapper);
    if (this._srcCache.has(src)) {
        streamWrapper.innerHTML = this._srcCache.get(src)!;
    } else {
      try {
        const response = await fetch(src);
        if (!response.ok || !response.body) throw new Error(`Fetch failed`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });
          streamWrapper.innerHTML = fullContent;
        }
        this._srcCache.set(src, fullContent);
      } catch (e) { streamWrapper.innerHTML = `<p style="color: red;">Error loading view.</p>`; }
    }
    return streamWrapper;
  }

  /** Scrolls the view area or a new element into view based on the `scroll` attribute. */
  private _performScroll(element: any) {
    if (!(element instanceof HTMLElement)) return;
    const scrollMode = this.getAttribute('scroll');
    const options: any = { behavior: 'smooth' };
    switch (scrollMode) {
      case 'top': options.block = 'start'; break;
      case 'bottom': options.block = 'end'; break;
      case 'none': return;
      default: return;
    }
    element.scrollIntoView(options);
  }
}

/**
 * Defines the content for a view, linked to a <view-area> by `view-id`.
 * Can optionally specify a `loader-id` to associate with a data loader.
 * @element view-template
 * @attr {string} view-id - Links this template to a <view-area>.
 * @attr {string} [loader-id] - Links this template to a <loader-element>.
 * @attr {'replace'|'append'} [mode=replace] - The rendering mode.
 * @attr {string} [src] - URL to fetch/stream HTML content from.
 */
class ViewTemplate extends HTMLElement { 
  connectedCallback() { this.style.display = 'none'; }
}

// --- Define Custom Elements ---
customElements.define('view-guard', Guard);
customElements.define('view-loader', Loader);
customElements.define('view-area', ViewArea);
customElements.define('view-template', ViewTemplate, { extends: 'template' });

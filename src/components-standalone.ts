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
import { HeadManager, resolveHeadData, mergeHeadData } from './features/head.js';

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
  const headDefinitions = new Map<string, any>();
  const headManager = new HeadManager();
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

    // Subscribe to router changes for head management
    routerInstance!.subscribe((matchTree) => {
      RouterManager.updateHead(matchTree);
    });

    // Match the current URL to display the appropriate view
    const currentMatch = routerInstance!.match(window.location.pathname + window.location.search);
    if (currentMatch) {
      routerInstance!.navigate(currentMatch.route, currentMatch.params);
    }
    
    // Intercept all <a> clicks for SPA navigation.
    document.documentElement.addEventListener('click', (event) => {
      const link = (event.target as HTMLElement).closest('a');
      // Ignore modified clicks, external links, download links, or no-intercept attribute.
      if (!link || link.origin !== window.location.origin || link.hasAttribute('download') || link.hasAttribute('no-intercept') || event.metaKey || event.ctrlKey || event.shiftKey) {
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
    },

    /**
     * Registers a head definition for a view.
     * @param {string} headId - The unique identifier for the head.
     * @param {any} headData - The head data configuration.
     */
    registerHead: (headId: string, headData: any): void => {
      headDefinitions.set(headId, headData);
    },

    /**
     * Registers a head definition directly with a view-area by view-id.
     * @param {string} viewId - The view-id to register the head with.
     * @param {any} headData - The head data configuration.
     */
    registerHeadForViewId: (viewId: string, headData: any): void => {
      // Find all view-areas with this view-id and register head data
      const viewAreas = Array.from(routeDefinitions.keys()).filter(
        viewArea => viewArea.getAttribute('view-id') === viewId
      );
      
      viewAreas.forEach(viewArea => {
        // Create a unique head-id for this automatic registration
        const autoHeadId = `auto-${viewId}-${Math.random().toString(36).substr(2, 9)}`;
        headDefinitions.set(autoHeadId, headData);
        
        // Set the head-id on the view-area so it gets picked up in updateHead
        viewArea.setAttribute('head-id', autoHeadId);
      });
    },

    /**
     * Updates the document head based on the current route match.
     * @param {RouteMatch | null} matchTree - The current route match tree.
     */
    updateHead: (matchTree: RouteMatch | null): void => {
      const activeHeadData: any[] = [];
      
      // Collect head data from all active routes in the hierarchy
      for (let match = matchTree; match; match = match.child || null) {
        const viewAreas = Array.from(routeDefinitions.entries()).filter(([_, route]) => route.id === match.route.id);
        for (const [viewArea] of viewAreas) {
          const headId = viewArea.getAttribute('head-id');
          if (headId && headDefinitions.has(headId)) {
            const headData = headDefinitions.get(headId);
            if (typeof headData === 'function') {
              activeHeadData.push(headData(match));
            } else {
              activeHeadData.push(headData);
            }
          }
        }
      }

      // Merge all head data and apply to DOM
      if (activeHeadData.length > 0) {
        const resolvedHeadData = activeHeadData.map(data => 
          typeof data === 'function' 
            ? resolveHeadData(data, matchTree!) 
            : resolveHeadData(data, matchTree!)
        );
        const mergedHead = mergeHeadData(...resolvedHeadData);
        headManager.apply(mergedHead);
      }
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
 * @attr {string} [head-id] - An ID that links this area to a <view-head> for document head management.
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

    // Emit loading start event for suspense components
    this.dispatchEvent(new CustomEvent('route-loading-start', { bubbles: true }));

    const useTransition = this.hasAttribute('transition') && 'startViewTransition' in document;
    
    const updateDOM = async () => {
      try {
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

        // Emit loading end event
        this.dispatchEvent(new CustomEvent('route-loading-end', { bubbles: true }));
      } catch (error) {
        // Emit error event for error boundary to catch
        this.dispatchEvent(new CustomEvent('route-error', { detail: { error }, bubbles: true }));
        console.error('Error rendering view:', error);
      }
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

/**
 * Defines document head management for a view. Can be linked manually via `head-id` 
 * or automatically discovered when placed inside a `view-template`.
 * Supports dynamic head content based on route parameters and nested head composition.
 * @element view-head
 * @attr {string} [head-id] - Manual linking: unique ID to reference this head configuration.
 * @attr {string} title - Static page title.
 * @attr {string} title-template - Template for the title (e.g., "Site | %s").
 * @attr {string} description - Meta description content.
 * @attr {string} keywords - Meta keywords (comma-separated).
 * @attr {string} canonical - Canonical URL for the page.
 * @attr {string} og-title - Open Graph title.
 * @attr {string} og-description - Open Graph description.
 * @attr {string} og-image - Open Graph image URL.
 * @attr {string} og-url - Open Graph URL.
 * @attr {string} og-type - Open Graph type (default: 'website').
 * @attr {string} twitter-card - Twitter card type (default: 'summary_large_image').
 * @attr {string} twitter-title - Twitter card title.
 * @attr {string} twitter-description - Twitter card description.
 * @attr {string} twitter-image - Twitter card image URL.
 * @attr {string} robots - Robots meta tag content.
 * @attr {string} [src] - URL to fetch head configuration from a JSON/JS module.
 * 
 * @example
 * <!-- Automatic discovery: place inside view-template -->
 * <template is="view-template" view-id="user-profile">
 *   <view-head title="User Profile" description="User details page"></view-head>
 *   <h1>User Profile</h1>
 * </template>
 * 
 * @example
 * <!-- Manual linking: use head-id -->
 * <view-area match="/users/:id" view-id="user-profile" head-id="user-head"></view-area>
 * <view-head head-id="user-head" title="User Profile"></view-head>
 */
class ViewHead extends HTMLElement {
  connectedCallback() {
    this.style.display = 'none';
    
    // Check if this view-head has an explicit head-id (manual linking)
    const headId = this.getAttribute('head-id');
    
    if (headId) {
      // Manual linking via head-id attribute
      const src = this.getAttribute('src');
      if (src) {
        this.loadHeadFromSrc(headId, src);
      } else {
        const headData = this.buildHeadFromAttributes();
        RouterManager.registerHead(headId, headData);
      }
    } else {
      // Automatic discovery: find parent view-template and register with its view-areas
      this.autoRegisterWithParentTemplate();
    }
  }

  /**
   * Automatically discovers the parent view-template and registers this head with its view-areas.
   */
  private autoRegisterWithParentTemplate() {
    // Find the closest parent view-template
    const parentTemplate = this.closest('template[is="view-template"]') as HTMLTemplateElement;
    
    if (!parentTemplate) {
      console.warn('view-head: No parent view-template found and no head-id specified. Head will not be registered.');
      return;
    }

    const viewId = parentTemplate.getAttribute('view-id');
    if (!viewId) {
      console.warn('view-head: Parent view-template has no view-id. Head will not be registered.');
      return;
    }

    // Get head data and register with all view-areas using this view-id
    const src = this.getAttribute('src');
    if (src) {
      this.loadHeadFromSrcForViewId(viewId, src);
    } else {
      const headData = this.buildHeadFromAttributes();
      RouterManager.registerHeadForViewId(viewId, headData);
    }
  }

  /**
   * Loads head configuration from an external module.
   * @param {string} headId - The head identifier.
   * @param {string} src - The module URL.
   */
  private async loadHeadFromSrc(headId: string, src: string) {
    try {
      const module = await import(src);
      const headData = module.default || module.head || module;
      RouterManager.registerHead(headId, headData);
    } catch (error) {
      console.error(`Failed to load head configuration from ${src}:`, error);
    }
  }

  /**
   * Loads head configuration from an external module and registers it with a view-id.
   * @param {string} viewId - The view identifier.
   * @param {string} src - The module URL.
   */
  private async loadHeadFromSrcForViewId(viewId: string, src: string) {
    try {
      const module = await import(src);
      const headData = module.default || module.head || module;
      RouterManager.registerHeadForViewId(viewId, headData);
    } catch (error) {
      console.error(`Failed to load head configuration from ${src}:`, error);
    }
  }

  /**
   * Builds head configuration from component attributes.
   * @returns {object} The head configuration object.
   */
  private buildHeadFromAttributes() {
    const attrs = this.attributes;
    const headData: any = {};

    // Basic meta tags
    if (attrs.getNamedItem('title')) {
      headData.title = this.getAttribute('title');
    }
    if (attrs.getNamedItem('title-template')) {
      headData.titleTemplate = this.getAttribute('title-template');
    }

    const meta: any[] = [];
    const link: any[] = [];

    // Standard meta tags
    if (attrs.getNamedItem('description')) {
      meta.push({ name: 'description', content: this.getAttribute('description') });
    }
    if (attrs.getNamedItem('keywords')) {
      meta.push({ name: 'keywords', content: this.getAttribute('keywords') });
    }
    if (attrs.getNamedItem('robots')) {
      meta.push({ name: 'robots', content: this.getAttribute('robots') });
    }

    // Open Graph tags
    if (attrs.getNamedItem('og-title')) {
      meta.push({ property: 'og:title', content: this.getAttribute('og-title') });
    }
    if (attrs.getNamedItem('og-description')) {
      meta.push({ property: 'og:description', content: this.getAttribute('og-description') });
    }
    if (attrs.getNamedItem('og-image')) {
      meta.push({ property: 'og:image', content: this.getAttribute('og-image') });
    }
    if (attrs.getNamedItem('og-url')) {
      meta.push({ property: 'og:url', content: this.getAttribute('og-url') });
    }
    meta.push({ 
      property: 'og:type', 
      content: this.getAttribute('og-type') || 'website' 
    });

    // Twitter Card tags
    meta.push({ 
      name: 'twitter:card', 
      content: this.getAttribute('twitter-card') || 'summary_large_image' 
    });
    if (attrs.getNamedItem('twitter-title')) {
      meta.push({ name: 'twitter:title', content: this.getAttribute('twitter-title') });
    }
    if (attrs.getNamedItem('twitter-description')) {
      meta.push({ name: 'twitter:description', content: this.getAttribute('twitter-description') });
    }
    if (attrs.getNamedItem('twitter-image')) {
      meta.push({ name: 'twitter:image', content: this.getAttribute('twitter-image') });
    }

    // Canonical link
    if (attrs.getNamedItem('canonical')) {
      link.push({ rel: 'canonical', href: this.getAttribute('canonical') });
    }

    if (meta.length > 0) headData.meta = meta;
    if (link.length > 0) headData.link = link;

    return headData;
  }
}

/**
 * Displays loading state during async route transitions and data loading.
 * Auto-links to view-areas via view-id attribute. Can contain view-fallback for custom loading content.
 * @element view-suspense
 * @attr {string} view-id - Links this suspense to specific view-area(s).
 * @attr {number} [delay=0] - Minimum delay in milliseconds before showing loading state.
 * @attr {number} [timeout=30000] - Timeout in milliseconds before showing error state.
 * 
 * @example
 * <view-suspense view-id="user-profile" delay="200">
 *   <view-fallback>
 *     <div class="spinner">Loading user profile...</div>
 *   </view-fallback>
 * </view-suspense>
 */
class ViewSuspense extends HTMLElement {
  private _isActive = false;
  private delayTimer: number | null = null;
  private timeoutTimer: number | null = null;
  private unsubscribeRoutes: (() => void)[] = [];
  private fallbackContent: ViewFallback | null = null;
  private defaultContent: DocumentFragment | null = null;

  connectedCallback() {
    const viewId = this.getAttribute('view-id');
    if (!viewId) {
      console.warn('view-suspense: view-id attribute is required');
      return;
    }

    // Store non-fallback content as default
    this.storeDefaultContent();

    // Find and monitor view-areas with matching view-id
    this.monitorViewAreas(viewId);
  }

  disconnectedCallback() {
    this.cleanup();
    this.unsubscribeRoutes.forEach(unsub => unsub());
  }

  private storeDefaultContent() {
    this.defaultContent = document.createDocumentFragment();
    const children = Array.from(this.children);
    
    children.forEach(child => {
      if (child.tagName.toLowerCase() !== 'view-fallback') {
        this.defaultContent!.appendChild(child.cloneNode(true));
      }
    });
  }

  private monitorViewAreas(viewId: string) {
    // Monitor existing and future view-areas
    const observer = new MutationObserver(() => {
      this.updateViewAreaBindings(viewId);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    this.updateViewAreaBindings(viewId);
  }

  private updateViewAreaBindings(viewId: string) {
    const viewAreas = document.querySelectorAll(`view-area[view-id="${viewId}"]`);
    
    viewAreas.forEach(viewArea => {
      // Listen for loading states
      const handleLoadingStart = () => this.showSuspense();
      const handleLoadingEnd = () => this.hideSuspense();
      const handleError = () => this.showError();

      viewArea.addEventListener('route-loading-start', handleLoadingStart);
      viewArea.addEventListener('route-loading-end', handleLoadingEnd);
      viewArea.addEventListener('route-error', handleError);

      this.unsubscribeRoutes.push(() => {
        viewArea.removeEventListener('route-loading-start', handleLoadingStart);
        viewArea.removeEventListener('route-loading-end', handleLoadingEnd);
        viewArea.removeEventListener('route-error', handleError);
      });
    });
  }

  private showSuspense() {
    const delay = parseInt(this.getAttribute('delay') || '0');
    const timeout = parseInt(this.getAttribute('timeout') || '30000');

    this.cleanup();

    if (delay > 0) {
      this.delayTimer = window.setTimeout(() => {
        this.setActive(true);
      }, delay);
    } else {
      this.setActive(true);
    }

    if (timeout > 0) {
      this.timeoutTimer = window.setTimeout(() => {
        this.showError();
      }, timeout);
    }
  }

  private hideSuspense() {
    this.cleanup();
    this.setActive(false);
  }

  private showError() {
    this.cleanup();
    this.setActive(false);
    // Dispatch error event for error boundary to catch
    this.dispatchEvent(new CustomEvent('view-timeout', { bubbles: true }));
  }

  private setActive(active: boolean) {
    this._isActive = active;
    
    if (active) {
      // Show fallback content if available
      if (this.fallbackContent) {
        this.fallbackContent.show();
      }
      // Hide default content
      this.hideDefaultContent();
    } else {
      // Hide fallback content
      if (this.fallbackContent) {
        this.fallbackContent.hide();
      }
      // Show default content
      this.showDefaultContent();
    }
  }

  private hideDefaultContent() {
    const children = Array.from(this.children);
    children.forEach(child => {
      if (child.tagName.toLowerCase() !== 'view-fallback') {
        (child as HTMLElement).style.display = 'none';
      }
    });
  }

  private showDefaultContent() {
    const children = Array.from(this.children);
    children.forEach(child => {
      if (child.tagName.toLowerCase() !== 'view-fallback') {
        (child as HTMLElement).style.display = '';
      }
    });
  }

  private cleanup() {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  // Called by ViewFallback when it detects suspense context
  _setFallbackContent(fallback: ViewFallback) {
    this.fallbackContent = fallback;
  }
}

/**
 * Smart fallback component that auto-detects its context and provides appropriate fallback content.
 * Can be used for route fallbacks (404), suspense loading states, or error boundaries.
 * @element view-fallback
 * @attr {string} [for] - Specific view-id to provide fallback for (route context only).
 * @attr {string} [match-pattern] - URL pattern that triggers this fallback (route context only, e.g., "*" for 404).
 * 
 * @example
 * <!-- Route fallback (404) -->
 * <view-fallback match-pattern="*">Page not found</view-fallback>
 * 
 * @example
 * <!-- Suspense fallback -->
 * <view-suspense view-id="user-profile">
 *   <view-fallback>Loading user profile...</view-fallback>
 * </view-suspense>
 * 
 * @example
 * <!-- Error fallback -->
 * <view-error-boundary>
 *   <view-fallback>Something went wrong. Please try again.</view-fallback>
 * </view-error-boundary>
 */
class ViewFallback extends HTMLElement {
  private unsubscribe: (() => void) | null = null;
  private context: 'route' | 'suspense' | 'error' | null = null;
  private parentSuspense: ViewSuspense | null = null;
  private parentErrorBoundary: ViewErrorBoundary | null = null;

  connectedCallback() {
    this.detectContext();
    this.initializeForContext();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  private detectContext() {
    // Check if nested inside view-suspense
    this.parentSuspense = this.closest('view-suspense') as ViewSuspense;
    if (this.parentSuspense) {
      this.context = 'suspense';
      return;
    }

    // Check if nested inside view-error-boundary
    this.parentErrorBoundary = this.closest('view-error-boundary') as ViewErrorBoundary;
    if (this.parentErrorBoundary) {
      this.context = 'error';
      return;
    }

    // Default to route fallback
    this.context = 'route';
  }

  private initializeForContext() {
    switch (this.context) {
      case 'suspense':
        this.initializeSuspenseFallback();
        break;
      case 'error':
        this.initializeErrorFallback();
        break;
      case 'route':
        this.initializeRouteFallback();
        break;
    }
  }

  private initializeSuspenseFallback() {
    // Initially hidden, will be shown by parent suspense component
    this.style.display = 'none';
    
    // Register with parent suspense
    if (this.parentSuspense) {
      (this.parentSuspense as any)._setFallbackContent(this);
    }
  }

  private initializeErrorFallback() {
    // Initially hidden, will be shown by parent error boundary
    this.style.display = 'none';
    
    // Register with parent error boundary  
    if (this.parentErrorBoundary) {
      (this.parentErrorBoundary as any)._setFallbackContent(this);
    }
  }

  private initializeRouteFallback() {
    const router = RouterManager.getRouter();
    if (router) {
      this.unsubscribe = router.subscribe(this.handleRouteChange);
    } else {
      // Wait for router initialization
      setTimeout(() => {
        const router = RouterManager.getRouter();
        if (router) this.unsubscribe = router.subscribe(this.handleRouteChange);
      }, 0);
    }
  }

  private handleRouteChange = (matchTree: RouteMatch | null) => {
    if (this.context !== 'route') return;

    const forViewId = this.getAttribute('for');
    const matchPattern = this.getAttribute('match-pattern');

    if (matchPattern === '*' && !matchTree) {
      // Global 404 fallback
      this.style.display = 'block';
      return;
    }

    if (forViewId) {
      // Check if specific view-id failed to match
      const hasMatchingView = this.findViewIdInMatchTree(matchTree, forViewId);
      this.style.display = hasMatchingView ? 'none' : 'block';
    } else if (!matchTree) {
      // Global fallback when no routes match
      this.style.display = 'block';
    } else {
      this.style.display = 'none';
    }
  };

  private findViewIdInMatchTree(matchTree: RouteMatch | null, viewId: string): boolean {
    for (let match = matchTree; match; match = match.child || null) {
      const viewAreas = document.querySelectorAll(`view-area[view-id="${viewId}"]`);
      for (const _viewArea of viewAreas) {
        const route = RouterManager.getRouter()?.routes.find(r => r.id === match.route.id);
        if (route) return true;
      }
    }
    return false;
  }

  // Public methods for parent components to control display
  show() {
    this.style.display = 'block';
  }

  hide() {
    this.style.display = 'none';
  }

  getContent() {
    return this.innerHTML;
  }
}

/**
 * Catches and displays errors that occur during view rendering or route navigation.
 * Automatically catches errors from child view-areas and provides error UI.
 * Works with nested view-fallback components for custom error content.
 * @element view-error-boundary
 * @attr {string} [view-id] - Specific view-id to monitor for errors.
 * @attr {boolean} [reset-on-route-change=true] - Whether to reset error state on route changes.
 * 
 * @example
 * <!-- Basic error boundary -->
 * <view-error-boundary>
 *   <view-area match="/users/:id" view-id="user-profile"></view-area>
 *   <view-fallback>
 *     <div class="error-message">
 *       <h2>Something went wrong</h2>
 *       <p>Please try refreshing the page.</p>
 *     </div>
 *   </view-fallback>
 * </view-error-boundary>
 * 
 * @example
 * <!-- Error boundary for specific view -->
 * <view-error-boundary view-id="user-profile">
 *   <view-area match="/users/:id" view-id="user-profile"></view-area>
 *   <view-fallback>User profile failed to load</view-fallback>
 * </view-error-boundary>
 */
class ViewErrorBoundary extends HTMLElement {
  private hasError = false;
  private errorContent: HTMLElement | null = null;
  private originalContent: DocumentFragment | null = null;
  private unsubscribe: (() => void) | null = null;
  private fallbackContent: ViewFallback | null = null;

  connectedCallback() {
    // Store original content
    this.originalContent = document.createDocumentFragment();
    while (this.firstChild) {
      this.originalContent.appendChild(this.firstChild);
    }

    // Listen for errors from child elements
    this.addEventListener('error', this.handleError, true);
    this.addEventListener('view-timeout', this.handleError, true);
    this.addEventListener('route-error', this.handleError, true);

    // Monitor route changes for reset
    if (this.getAttribute('reset-on-route-change') !== 'false') {
      const router = RouterManager.getRouter();
      if (router) {
        this.unsubscribe = router.subscribe(this.handleRouteChange);
      }
    }

    // Restore original content initially
    this.restoreContent();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  private handleError = (event: Event) => {
    const viewId = this.getAttribute('view-id');
    
    // If view-id is specified, only handle errors from that view
    if (viewId) {
      const target = event.target as Element;
      const targetViewArea = target.closest(`view-area[view-id="${viewId}"]`);
      if (!targetViewArea) return;
    }

    this.showError(event);
  };

  private handleRouteChange = () => {
    if (this.hasError) {
      this.resetError();
    }
  };

  private showError(event: Event) {
    if (this.hasError) return;

    this.hasError = true;
    this.innerHTML = '';

    // Use custom fallback content if available, otherwise default error UI
    if (this.fallbackContent) {
      this.appendChild(this.fallbackContent.cloneNode(true) as Element);
    } else {
      this.errorContent = document.createElement('div');
      this.errorContent.className = 'view-error-boundary';
      this.errorContent.innerHTML = `
        <div style="padding: 20px; border: 2px solid #ff6b6b; border-radius: 8px; background: #ffe0e0; color: #d63031;">
          <h3 style="margin: 0 0 10px 0; color: #d63031;">Something went wrong</h3>
          <p style="margin: 0 0 15px 0;">An error occurred while loading this view.</p>
          <button type="button" style="padding: 8px 16px; background: #d63031; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Try Again
          </button>
        </div>
      `;

      const retryButton = this.errorContent.querySelector('button');
      retryButton?.addEventListener('click', () => this.resetError());

      this.appendChild(this.errorContent);
    }

    // Log error details
    console.error('ViewErrorBoundary caught error:', event);
  }

  private resetError() {
    this.hasError = false;
    this.restoreContent();
  }

  private restoreContent() {
    this.innerHTML = '';
    if (this.originalContent) {
      this.appendChild(this.originalContent.cloneNode(true));
    }
  }

  // Called by ViewFallback when it detects error boundary context
  _setFallbackContent(fallback: ViewFallback) {
    this.fallbackContent = fallback;
  }
}

// --- Define Custom Elements ---
customElements.define('view-guard', Guard);
customElements.define('view-loader', Loader);
customElements.define('view-area', ViewArea);
customElements.define('view-template', ViewTemplate, { extends: 'template' });
customElements.define('view-head', ViewHead);
customElements.define('view-suspense', ViewSuspense);
customElements.define('view-fallback', ViewFallback);
customElements.define('view-error-boundary', ViewErrorBoundary);

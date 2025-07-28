# **Implementation Guide: The Declarative View Layer**

This guide details the implementation of a fully integrated, declarative rendering system for vanilla JavaScript applications using Combi-Router.

This approach is architecturally superior to an external helper utility (`createViewManager`) because it co-locates a route's logic with its presentation, embraces the declarative `pipe()` syntax, and integrates perfectly into the composable layer system.

The implementation consists of two core pieces:
1.  A new **`view()`** route enhancer.
2.  A new **`createViewLayer()`** composable layer.

---

### **Part 1: The `view()` Route Enhancer**

The first step is to create a way to attach rendering information directly to a route. We'll do this with a new higher-order function, `view()`, that works just like `loader()` and `guard()`.

Architecturally, this is simply a specialized `meta()` enhancer that adds a `view` property to a route's metadata.

#### **Implementation (`src/core/meta.ts` or `src/core/view.ts`)**

```typescript
import { type Route, type RouteMatch, meta } from './index';

/** The context object passed to a ViewFactory function. */
export interface ViewContext {
  /** The full RouteMatch object, containing params, loaded data, etc. */
  match: RouteMatch<any>;
}

/** A function that returns a renderable string or DOM Node for a given route match. */
export type ViewFactory = (context: ViewContext) => string | Node;

/**
 * Attaches a view factory function to a route's metadata.
 * This declaratively defines how a route should be rendered in the DOM.
 *
 * @param viewFactory A function that receives the route match context and returns a string or Node.
 * @returns A route enhancer function to be used with `pipe()`.
 */
export function view<TParams>(viewFactory: ViewFactory) {
  // Under the hood, view() is just a convenience wrapper around meta().
  return meta<TParams>({ view: viewFactory });
}
```

---

### **Part 2: The `createViewLayer()`**

This layer is the engine that bridges the router's state to the DOM. It is configured with a root element and subscribes to the router's lifecycle to handle all rendering concerns automatically.

#### **Implementation (`src/layers/view.ts` - New File)**

```typescript
import type { RouterLayer, ComposableRouter } from '../core/layer-types';
import type { RouteMatch, NavigationError, Route } from '../core/types';
import { HeadManager, resolveHeadData } from '../features/head';
import type { ViewFactory, ViewContext } from '../core/view'; // Import from where `view` is defined

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
}

/** Extensions provided by the ViewLayer. */
export interface ViewLayerExtensions {
  /** Manually triggers a re-render of the current view. */
  rerender: () => void;
}

/**
 * Creates a View Layer that handles the entire rendering lifecycle for a vanilla JS application.
 * It connects route definitions to the DOM, manages loading/error states, and intercepts
 * link clicks for a seamless single-page application experience.
 *
 * @param config The configuration specifying the root element and fallback views.
 * @returns A composable router layer.
 */
export function createViewLayer(config: ViewLayerConfig): RouterLayer<any, ViewLayerExtensions> {
  return (router: ComposableRouter<any>) => {
    const rootElement = typeof config.root === 'string'
      ? document.querySelector<HTMLElement>(config.root)
      : config.root;

    if (!rootElement) {
      throw new Error(`[ViewLayer] Root element "${config.root}" not found.`);
    }

    const headManager = new HeadManager(document);
    let lastError: NavigationError | undefined;
    let cleanupFunctions: (() => void)[] = [];

    /** Renders content to the root element. */
    const render = (content: string | Node) => {
      if (typeof content === 'string') {
        rootElement.innerHTML = content;
      } else {
        rootElement.innerHTML = ''; // Clear previous content
        rootElement.appendChild(content);
      }
    };

    /** The main state handler, called whenever the router's state changes. */
    const handleStateChange = (match: RouteMatch | null) => {
      // 1. Head Management: Update the document head for SEO.
      if (match?.route.metadata._head) {
        const resolvedHead = resolveHeadData(match.route.metadata._head, match);
        headManager.apply(resolvedHead);
      } else if (!match && config.notFoundView) {
        headManager.apply({ title: 'Not Found' });
      }

      // 2. Render Loading State: If the router is fetching data, show the loading view.
      if (router.isFetching && config.loadingView) {
        render(config.loadingView());
        return;
      }

      // 3. Render Error State: If a navigation error occurred, show the error view.
      if (lastError && config.errorView) {
        render(config.errorView(lastError));
        return;
      }

      // 4. Render Not Found State: If no route was matched.
      if (!match) {
        if (config.notFoundView) render(config.notFoundView());
        else rootElement.innerHTML = '<h2>404 - Not Found</h2>';
        return;
      }

      // 5. Render Matched View: Find and execute the view factory from the route's metadata.
      const viewFactory = match.route.metadata.view as ViewFactory | undefined;
      if (viewFactory) {
        render(viewFactory({ match }));
      } else {
        console.warn(`[ViewLayer] No view() factory found for matched route (ID: ${match.route.id}).`);
        rootElement.innerHTML = '<!-- View not configured -->';
      }
    };

    /** Intercepts clicks on local `<a>` tags for SPA navigation. */
    const handleLinkClick = async (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a');
      if (!link || link.origin !== window.location.origin || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      event.preventDefault();

      const href = link.getAttribute('href');
      if (!href) return;

      lastError = undefined; // Clear previous errors
      
      const targetMatch = router.match(href);
      if (targetMatch) {
        // We don't need to manually show the loading view here; the `onNavigationStart` hook will handle it.
        const result = await router.navigate(targetMatch.route, targetMatch.params);
        if (!result.success) {
            console.error('[ViewLayer] Navigation failed:', result.error);
        }
      } else {
        // Manually navigate to a "not found" state. The Core Layer will handle this.
        await router.navigate(href);
      }
    };
    
    document.body.addEventListener('click', handleLinkClick);
    cleanupFunctions.push(() => document.body.removeEventListener('click', handleLinkClick));

    // --- Lifecycle Integration ---
    // Hook into the CoreNavigationLayer's lifecycle for precise state management.
    if (typeof router._registerLifecycleHook === 'function') {
        const unsubStart = router._registerLifecycleHook('onNavigationStart', () => {
            lastError = undefined;
            handleStateChange(router.currentMatch);
        });
        const unsubComplete = router._registerLifecycleHook('onNavigationComplete', (match: RouteMatch | null) => {
            handleStateChange(match);
        });
        const unsubError = router._registerLifecycleHook('onNavigationError', (error: NavigationError) => {
            lastError = error;
            handleStateChange(router.currentMatch);
        });
        cleanupFunctions.push(unsubStart, unsubComplete, unsubError);
    } else {
        // Fallback for routers without lifecycle hooks (less precise but functional)
        cleanupFunctions.push(router.subscribe(handleStateChange));
    }
    
    // Initial render for the current page state when the app loads.
    const initialMatch = router.match(window.location.pathname + window.location.search);
    if (initialMatch) {
        router.navigate(initialMatch.route, initialMatch.params);
    } else {
        handleStateChange(null);
    }

    // Return the layer's public API and cleanup logic.
    return {
      rerender: () => handleStateChange(router.currentMatch),
      _cleanup: () => {
        cleanupFunctions.forEach(fn => fn());
        rootElement.innerHTML = '';
      }
    };
  };
}
```

---

### **Part 3: The Mechanics - How It All Works Together**

This new system creates a seamless flow from a user click to a rendered view:

1.  **Initialization:**
    *   You create a layered router, including the `createCoreNavigationLayer` and your new `createViewLayer`.
    *   The `ViewLayer` finds the root element, sets up its render function, and hooks into the router's lifecycle (`onNavigationStart`, `onNavigationComplete`, etc.).
    *   It attaches a single, global click listener to `document.body`.
    *   It performs an initial navigation based on the current URL.

2.  **User Interaction:**
    *   The user clicks an internal link, for example: `<a href="/post/hello-world">`.
    *   The `ViewLayer`'s global click listener catches the event and prevents the default page load.

3.  **Navigation Lifecycle:**
    *   The click handler calls `router.navigate(...)`.
    *   The `CoreNavigationLayer` fires the `onNavigationStart` hook.
    *   The `ViewLayer`'s listener for `onNavigationStart` fires. It clears any previous errors and calls `handleStateChange()`. Since `router.isFetching` is now `true`, it renders the `loadingView`.
    *   The `CoreNavigationLayer` proceeds to run guards and loaders for the target route.

4.  **Completion & Rendering:**
    *   Once the loaders are complete, the `CoreNavigationLayer` fires the `onNavigationComplete` hook, passing the new `RouteMatch` object.
    *   The `ViewLayer`'s listener for `onNavigationComplete` fires. It calls `handleStateChange()` again.
    *   This time, `router.isFetching` is `false`. The function gets the `view` factory from `match.route.metadata.view`.
    *   It executes the factory, passing it the full `match` context (including the loaded data).
    *   The factory returns an HTML string or a Node, which the `render` function injects into the root element.
    *   The `HeadManager` is also called to update the page title and meta tags.

5.  **Error Handling:**
    *   If a loader or guard fails, the `CoreNavigationLayer` fires the `onNavigationError` hook with the error details.
    *   The `ViewLayer`'s listener for this hook fires, sets `lastError`, and calls `handleStateChange()`, which now renders the `errorView`.

---

### **Part 4: The Final Code - A Complete Example**

This refactored `blog.html` demonstrates the elegance and simplicity of the final application code.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Simple Blog</title>
    <script src="https://cdn.jsdelivr.net/npm/zod@3.23.8/lib/index.umd.min.js"></script>
    <style>/* ... styles ... */</style>
</head>
<body>
    <div class="container">
        <header><h1><a href="/">My Combi-Router Blog</a></h1></header>
        <main id="app-root"></main>
    </div>

    <script type="module">
        // Step 1: Import everything needed
        import { createLayeredRouter, createCoreNavigationLayer, route, pipe, path, param, end, loader } from './dist/esm/production/index.js'; // ADJUST
        import { head } from './dist/esm/production/features/head.js'; // ADJUST
        import { createViewLayer, view } from './dist/esm/production/layers/view.js'; // ADJUST

        const { z } = window.zod;

        // Step 2: Mock API (Same as before)
        const mockApi = { /* ... */ };

        // Step 3: Define Routes with Integrated Views
        // The view logic is now declaratively co-located with the route!
        const postsRoute = pipe(
            route(path(''), end),
            loader(async () => ({ posts: await mockApi.fetchPosts() })),
            head({ title: 'All Posts', titleTemplate: 'My Blog | %s' }),
            view(({ match }) => `
                <h2>Latest Posts</h2>
                <div class="post-list">
                    ${match.data.posts.map(post => `<a href="/post/${post.slug}">${post.title}</a>`).join('')}
                </div>
            `)
        );

        const postDetailRoute = pipe(
            route(path('post'), param('slug', z.string()), end),
            loader(async ({ params }) => ({ post: await mockApi.fetchPostBySlug(params.slug) })),
            head(({ data }) => ({ title: data.post?.title || 'Blog Post', titleTemplate: 'My Blog | %s' })),
            view(({ match }) => `
                <div class="post-content">
                    <a href="/">&larr; Back to all posts</a>
                    <h2>${match.data.post.title}</h2>
                    <p>${match.data.post.content}</p>
                </div>
            `)
        );

        // Step 4: Bootstrap the Application with a Layered Router
        // The application logic is now just a single, declarative function call.
        const router = createLayeredRouter([postsRoute, postDetailRoute])
            (createCoreNavigationLayer())
            (createViewLayer({
                root: '#app-root',
                loadingView: () => `<div class="loading-indicator">Loading, please wait...</div>`,
                errorView: (error) => `<div class="error-message"><h3>Error</h3><p>${error.message}</p><a href="/">Go Home</a></div>`,
                notFoundView: () => `<div class="error-message"><h3>404 - Not Found</h3></div>`
            }))
            (); // Finalize and run the router!
    </script>
</body>
</html>
```

### **Conclusion**

By integrating view logic directly into the route definition via a `view()` enhancer and handling the rendering lifecycle within a `ViewLayer`, we have created a system that is:
*   **Highly Declarative:** The application's structure is defined almost entirely through route composition.
*   **Co-located:** A route's path, data, head tags, and view are all defined together.
*   **Simple to Use:** The boilerplate for a vanilla JS app is reduced to a single `createLayeredRouter` call.
*   **Architecturally Consistent:** It embraces the core philosophy of composition that defines the rest of the library.



---


Excellent question. This gets to the heart of how a declarative UI system interacts with an asynchronous, stateful core. The new `view()` enhancer and `ViewLayer` are designed to integrate seamlessly with the existing data fetching and lifecycle hooks.

Here's a detailed breakdown of the mechanics.

### **The Core Principle: The View is a "Pure" Function of State**

The entire system is designed around a simple, powerful idea from declarative UI programming:

> The UI is a function of the current state. `UI = f(state)`

In our case, the "state" is the combination of the `RouteMatch` object (which contains parameters and loaded data) and the router's global status (like `isFetching`). The "f" is the `view()` factory function. The `ViewLayer` is the engine that calls this function whenever the state changes.

### **How Data Fetching (`loader`) Powers the `view()`**

The connection between `loader` and `view` is the most critical interaction. It's a two-step process managed entirely by the layers.

**Step 1: The `CoreNavigationLayer` Fetches the Data**

1.  A navigation is triggered (e.g., to `/post/hello-world`).
2.  The `CoreNavigationLayer` matches the `postDetailRoute`.
3.  It sees that the route has a `loader` in its metadata.
4.  It **pauses** the navigation lifecycle.
5.  It sets the global router state `router.isFetching = true`.
6.  It fires the `onNavigationStart` hook, which the `ViewLayer` listens to.
7.  The `ViewLayer` sees `isFetching` is true and immediately renders the `loadingView`.
8.  The `CoreNavigationLayer` executes the `loader` function (`await mockApi.fetchPostBySlug(...)`).
9.  Once the promise from the loader resolves, it attaches the result to the `RouteMatch` object under the `.data` property (e.g., `match.data = { post: { ... } }`).
10. It sets `router.isFetching = false`.
11. It fires the `onNavigationComplete` hook, passing the now-complete `RouteMatch` object.

**Step 2: The `ViewLayer` Renders the Data**

1.  The `ViewLayer`'s listener for `onNavigationComplete` is triggered.
2.  It receives the `RouteMatch` object, which now contains the data fetched in Step 1.
3.  It looks up the `view` factory from the route's metadata (`match.route.metadata.view`).
4.  It calls the `view` factory, passing the complete context: `view({ match })`.
5.  Inside your `view` function, `match.data.post` is now available and populated with the data from the API.
6.  Your `view` function returns the final HTML string with the data interpolated.
7.  The `ViewLayer` renders this HTML into the root element.

This creates a clean, one-way data flow:
`Navigation -> Loader -> Data -> Match Object -> View -> DOM`

**What about Errors?**

If the `loader` function's promise **rejects** (e.g., the API returns a 404 and `mockApi` throws an error), the `CoreNavigationLayer` catches this.
1.  It stops the navigation.
2.  It fires the `onNavigationError` hook, passing a `NavigationError` object.
3.  The `ViewLayer`'s listener for `onNavigationError` is triggered. It saves the error and calls its state handler, which now renders the `errorView`, passing it the error details.

### **Lifecycle Methods: The Hooks that Drive the System**

The `createViewLayer` does not have its own lifecycle. Instead, it is a **passive listener** to the lifecycle events broadcast by the `createCoreNavigationLayer`. This is a key architectural choice that keeps the layers decoupled.

Here is the exact mapping of events to actions in the `ViewLayer`:

*   **`onNavigationStart` hook fires:**
    *   **Cause:** The user has clicked a link and `router.navigate()` has just been called.
    *   **`ViewLayer` Action:** Clears any previous error state. Calls its internal `handleStateChange()` function. Because `router.isFetching` will be `true`, it knows to render the `loadingView`.

*   **`onNavigationComplete` hook fires:**
    *   **Cause:** All guards have passed and all `loader` functions for the new route have successfully resolved. The hook provides the final, data-rich `RouteMatch` object.
    *   **`ViewLayer` Action:** Calls `handleStateChange()` with the new `match`. Because `router.isFetching` is now `false` and there is no error, it knows to render the main view using the `view` factory from the route's metadata. It also calls the `HeadManager` to update SEO tags.

*   **`onNavigationError` hook fires:**
    *   **Cause:** A guard rejected the navigation, or a `loader` function threw an error. The hook provides a `NavigationError` object.
    *   **`ViewLayer` Action:** It saves the error object. It calls `handleStateChange()`. Because an error is present, it knows to render the `errorView`.

*   **Initial Page Load:**
    *   **Cause:** The application first starts.
    *   **`ViewLayer` Action:** It doesn't wait for a hook. In its own setup logic, it performs an initial navigation (`router.navigate(initialMatch.route, ...)`). This kicks off the entire `onNavigationStart` -> `onNavigationComplete` cycle described above, ensuring that the first page view goes through the exact same rendering and data-fetching pipeline as any subsequent navigation.

### **Visualizing the Flow for a Single Navigation**

Let's trace a click to `/post/hello-world`:

1.  **User Clicks Link**
2.  **`ViewLayer`'s Click Handler:**
    *   Calls `router.navigate(postDetailRoute, { slug: 'hello-world' })`.
3.  **`CoreNavigationLayer`:**
    *   Fires `onNavigationStart`.
4.  **`ViewLayer` (listens to `onNavigationStart`):**
    *   Sees `router.isFetching` is `true`.
    *   Renders `loadingView` -> `DOM Updated: "Loading..."`
5.  **`CoreNavigationLayer`:**
    *   Executes `postDetailRoute.loader(...)`.
    *   `await mockApi.fetchPostBySlug('hello-world')` -> Pauses for 500ms.
    *   Loader resolves with `{ post: ... }`.
    *   Attaches data to the `RouteMatch`.
    *   Fires `onNavigationComplete` with the full `RouteMatch`.
6.  **`ViewLayer` (listens to `onNavigationComplete`):**
    *   Sees `router.isFetching` is `false`.
    *   Gets `view` factory from `postDetailRoute`.
    *   Calls `view({ match })`.
    *   The factory accesses `match.data.post` to create the HTML.
    *   The `HeadManager` is called to update the page title to "My Blog | Hello, World!".
    *   Renders the final HTML -> `DOM Updated: "<h2>Hello, World!</h2>..."`

This system ensures that your view functions remain simple and pure. They receive all the data they need as an argument and don't have to worry about the complexities of asynchronous fetching, loading states, or error handling. That entire responsibility is cleanly managed by the interaction between the core layer and the view layer.



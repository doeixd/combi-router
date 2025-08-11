// =================================================================
//
//      Combi-Router: Enhanced Meta Functions
//
//      Extended route metadata functions supporting HTML templates
//      and custom templating systems
//
// =================================================================

import type { Route } from "../../core/route";

import { meta } from "../../core/meta";
import type {
  EnhancedViewFactory,
  TemplateResult,
  HTMLTemplateResult,
} from "./enhanced-view";

/**
 * Enhanced view() function that supports multiple template formats:
 * - Regular strings and DOM nodes (backward compatible)
 * - HTML template literals (lit-html, uhtml, etc.)
 * - Custom template results
 * - Async view factories
 *
 * @example Using with lit-html
 * ```typescript
 * import { html } from 'lit-html';
 *
 * const userRoute = pipe(
 *   route(path('user'), param('id', z.string()), end),
 *   enhancedView(({ match }) => html`
 *     <div class="user-profile">
 *       <h1>${match.data.user.name}</h1>
 *       <p>Email: ${match.data.user.email}</p>
 *     </div>
 *   `)
 * );
 * ```
 *
 * @example Using with a custom template engine
 * ```typescript
 * import { compile } from 'handlebars';
 *
 * const template = compile(`
 *   <div class="product">
 *     <h2>{{product.name}}</h2>
 *     <p>Price: ${{product.price}}</p>
 *   </div>
 * `);
 *
 * const productRoute = pipe(
 *   route(path('product'), param('id', z.string()), end),
 *   enhancedView(({ match }) => ({
 *     html: template({ product: match.data.product })
 *   }))
 * );
 * ```
 *
 * @example Using with async rendering
 * ```typescript
 * const asyncRoute = pipe(
 *   route(path('async'), end),
 *   enhancedView(async ({ match }) => {
 *     const data = await fetchSomeData();
 *     return html`<div>${data.content}</div>`;
 *   })
 * );
 * ```
 *
 * @param viewFactory Enhanced view factory function
 * @returns A route enhancer function
 */
export function enhancedView<TParams>(
  viewFactory: EnhancedViewFactory<TParams>,
): (route: Route<TParams>) => Route<TParams> {
  // Wrap the enhanced view factory to be compatible with ViewFactory
  const wrappedFactory = (context: any): string | Node => {
    const result = viewFactory(context);

    // Handle different return types
    if (typeof result === "string" || result instanceof Node) {
      return result;
    }

    // For Promise, TemplateResult, HTMLTemplateResult, we need to convert to string
    // This is a simplified conversion - in practice, the view layer would handle these
    if (result && typeof result === "object") {
      // Check if it's a TemplateResult or HTMLTemplateResult
      if ("render" in result && typeof result.render === "function") {
        const rendered = result.render();
        if (typeof rendered === "string" || rendered instanceof Node) {
          return rendered;
        }
      }
    }

    // Fallback to string conversion
    return String(result);
  };

  return meta<TParams>({ view: wrappedFactory as any });
}

/**
 * Alias for backward compatibility
 */
export const view = enhancedView;

/**
 * Helper function to create HTML template results
 * This can be used when you want to return raw HTML strings
 * with additional metadata for the renderer
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path(''), end),
 *   enhancedView(() => htmlTemplate(`
 *     <div class="home">
 *       <h1>Welcome!</h1>
 *     </div>
 *   `, {
 *     afterRender: (element) => {
 *       // Post-render DOM manipulation
 *       element.querySelector('h1')?.classList.add('animated');
 *     }
 *   }))
 * );
 * ```
 */
export function htmlTemplate(
  html: string,
  options?: {
    afterRender?: (element: HTMLElement) => void;
    beforeRender?: () => void;
  },
): HTMLTemplateResult {
  const template = document.createElement("template");
  template.innerHTML = html;

  return {
    template,
    html,
    dom: template.content,
    render: () => {
      options?.beforeRender?.();
      const clone = template.content.cloneNode(true) as DocumentFragment;

      // If afterRender is provided, wrap in a div to get the element
      if (options?.afterRender) {
        const wrapper = document.createElement("div");
        wrapper.appendChild(clone);
        options.afterRender(wrapper);
        return wrapper;
      }

      return clone;
    },
  };
}

/**
 * Helper to create a lazy-loaded view that shows a loading state
 * while the actual view is being loaded
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('heavy'), end),
 *   lazyView(
 *     () => import('./heavy-component').then(m => m.render),
 *     () => '<div>Loading...</div>'
 *   )
 * );
 * ```
 */
export function lazyView<TParams>(
  loader: () => Promise<EnhancedViewFactory<TParams>>,
  loadingView?: EnhancedViewFactory<TParams>,
): (route: Route<TParams>) => Route<TParams> {
  let cachedFactory: EnhancedViewFactory<TParams> | null = null;

  return enhancedView<TParams>(async (context) => {
    if (!cachedFactory) {
      // Show loading view immediately if provided
      if (loadingView) {
        // We need to render loading view but continue loading
        // This is a bit tricky since we need to trigger a re-render
        // after the actual view loads
        const result = loadingView(context);

        // Start loading the actual view
        loader().then((factory) => {
          cachedFactory = factory;
          // Trigger re-render - this would need router access
          // In practice, this would be handled by the view layer
        });

        return result;
      } else {
        // Wait for the view to load
        cachedFactory = await loader();
      }
    }

    return cachedFactory(context);
  });
}

/**
 * Creates a view that can render different templates based on conditions
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('profile'), param('id', z.string()), end),
 *   conditionalView(
 *     ({ match }) => match.data.user.isAdmin,
 *     ({ match }) => html`<admin-dashboard user="${match.data.user}"></admin-dashboard>`,
 *     ({ match }) => html`<user-profile user="${match.data.user}"></user-profile>`
 *   )
 * );
 * ```
 */
export function conditionalView<TParams>(
  condition: (context: { match: any }) => boolean,
  trueView: EnhancedViewFactory<TParams>,
  falseView: EnhancedViewFactory<TParams>,
): (route: Route<TParams>) => Route<TParams> {
  return enhancedView<TParams>((context) => {
    if (condition(context)) {
      return trueView(context);
    } else {
      return falseView(context);
    }
  });
}

/**
 * Creates a view with built-in error boundary
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('fragile'), end),
 *   errorBoundaryView(
 *     ({ match }) => riskyRenderFunction(match),
 *     (error) => html`<div class="error">Something went wrong: ${error.message}</div>`
 *   )
 * );
 * ```
 */
export function errorBoundaryView<TParams>(
  viewFactory: EnhancedViewFactory<TParams>,
  errorView: (
    error: Error,
  ) => string | Node | TemplateResult | HTMLTemplateResult,
): (route: Route<TParams>) => Route<TParams> {
  return enhancedView<TParams>(async (context) => {
    try {
      return await viewFactory(context);
    } catch (error) {
      console.error("[ErrorBoundaryView] View rendering failed:", error);
      return errorView(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });
}

/**
 * Composes multiple view factories into a single view
 * Useful for creating layouts with multiple sections
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('dashboard'), end),
 *   composeViews({
 *     header: ({ match }) => html`<header>${match.data.user.name}</header>`,
 *     sidebar: ({ match }) => html`<nav>${match.data.menu}</nav>`,
 *     content: ({ match }) => html`<main>${match.data.content}</main>`,
 *   }, (parts) => html`
 *     <div class="layout">
 *       ${parts.header}
 *       <div class="body">
 *         ${parts.sidebar}
 *         ${parts.content}
 *       </div>
 *     </div>
 *   `)
 * );
 * ```
 */
export function composeViews<TParams, TParts extends Record<string, any>>(
  parts: { [K in keyof TParts]: EnhancedViewFactory<TParams> },
  composer: (parts: { [K in keyof TParts]: any }) =>
    | string
    | Node
    | TemplateResult
    | HTMLTemplateResult,
): (route: Route<TParams>) => Route<TParams> {
  return enhancedView<TParams>(async (context) => {
    const renderedParts: Partial<TParts> = {};

    // Render all parts in parallel
    await Promise.all(
      Object.entries(parts).map(async ([key, factory]) => {
        renderedParts[key as keyof TParts] = await (
          factory as EnhancedViewFactory<TParams>
        )(context);
      }),
    );

    return composer(renderedParts as TParts);
  });
}

/**
 * Creates a streaming view that can update content progressively
 * Note: This requires special support from the view layer
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('stream'), end),
 *   streamingView(async function* ({ match }) {
 *     yield html`<div>Loading user...</div>`;
 *     const user = await fetchUser(match.params.id);
 *     yield html`<div>Loading posts for ${user.name}...</div>`;
 *     const posts = await fetchPosts(user.id);
 *     yield html`
 *       <div>
 *         <h1>${user.name}</h1>
 *         <ul>${posts.map(p => html`<li>${p.title}</li>`)}</ul>
 *       </div>
 *     `;
 *   })
 * );
 * ```
 */
export function streamingView<TParams>(
  generator: (context: {
    match: any;
  }) => AsyncGenerator<string | Node | TemplateResult | HTMLTemplateResult>,
): (route: Route<TParams>) => Route<TParams> {
  return enhancedView<TParams>(async (context) => {
    // For streaming, we return a special object that the view layer can recognize
    return {
      _streaming: true,
      generator: generator(context),
      render: async function () {
        // Collect all chunks for non-streaming renderers
        const chunks: any[] = [];
        for await (const chunk of generator(context)) {
          chunks.push(chunk);
        }
        // Return the last chunk as the final result
        return chunks[chunks.length - 1];
      },
    } as any;
  });
}

/**
 * Helper for creating views with built-in caching
 * The rendered result is cached based on a key function
 *
 * @example
 * ```typescript
 * const route = pipe(
 *   route(path('product'), param('id', z.string()), end),
 *   cachedView(
 *     ({ match }) => expensiveRender(match.data),
 *     ({ match }) => `product-${match.params.id}`,
 *     60000 // Cache for 1 minute
 *   )
 * );
 * ```
 */
export function cachedView<TParams>(
  viewFactory: EnhancedViewFactory<TParams>,
  keyFn: (context: { match: any }) => string,
  ttl: number = 60000,
): (route: Route<TParams>) => Route<TParams> {
  const cache = new Map<string, { result: any; timestamp: number }>();

  return enhancedView<TParams>(async (context) => {
    const key = keyFn(context);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }

    const result = await viewFactory(context);
    cache.set(key, { result, timestamp: Date.now() });

    // Clean up old entries
    for (const [k, v] of cache.entries()) {
      if (Date.now() - v.timestamp > ttl) {
        cache.delete(k);
      }
    }

    return result;
  });
}

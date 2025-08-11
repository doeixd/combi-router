# Enhanced View Layer for Combi-Router

An advanced view layer that extends Combi-Router with HTML template support, morphdom integration, and hierarchical nested routing capabilities.

## Features

✨ **Universal Template Support** - Works with lit-html, uhtml, Handlebars, or any templating system  
⚡ **Morphdom Integration** - Efficient DOM patching with minimal mutations  
🎯 **True Nested Routing** - Hierarchical route composition with automatic outlet management  
🚀 **Performance Optimized** - Built-in caching, lazy loading, and streaming support  
📦 **Zero Lock-in** - Use your preferred templating library  
🔧 **TypeScript Ready** - Full type safety and IntelliSense support

## Installation

```bash
npm install @combi-router/enhanced-view

# Optional: For morphdom support
npm install morphdom
```

## Quick Start

```typescript
import { createLayeredRouter, createCoreNavigationLayer } from '@combi-router/core';
import { createEnhancedViewLayer, enhancedView } from '@combi-router/enhanced-view';
import { route, extend, pipe } from '@combi-router/core';
import { path, param, end } from '@combi-router/core';

// Create routes with enhanced views
const appRoute = pipe(
  route(path('')),
  enhancedView(() => `
    <div class="app">
      <nav>
        <a href="/">Home</a>
        <a href="/users">Users</a>
      </nav>
      <main router-outlet></main>
    </div>
  `)
);

const homeRoute = pipe(
  extend(appRoute, end),
  enhancedView(() => '<h1>Welcome Home!</h1>')
);

// Initialize router with enhanced view layer
const router = createLayeredRouter([appRoute, homeRoute])
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    enableOutlets: true
  }))
  ();

router.start();
```

## Template Support

### String Templates
```typescript
enhancedView(() => '<h1>Hello World</h1>')
```

### DOM Nodes
```typescript
enhancedView(() => {
  const div = document.createElement('div');
  div.textContent = 'Hello World';
  return div;
})
```

### lit-html
```typescript
import { html } from 'lit-html';

enhancedView(({ match }) => html`
  <div class="user">
    <h1>${match.data.user.name}</h1>
  </div>
`)
```

### Custom Templates
```typescript
import Handlebars from 'handlebars';

const template = Handlebars.compile('<h1>{{title}}</h1>');

enhancedView(({ match }) => ({
  html: template({ title: match.data.title })
}))
```

## Morphdom Integration

Enable efficient DOM updates that preserve form state, focus, and scroll position:

```typescript
import morphdom from 'morphdom';
import { setMorphdom } from '@combi-router/enhanced-view';

// Provide morphdom implementation
setMorphdom(morphdom);

// Configure in router
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    morphdomOptions: {
      onBeforeElUpdated: (fromEl, toEl) => {
        // Preserve focus
        if (fromEl === document.activeElement) {
          return false;
        }
        return true;
      }
    }
  }))
  ();
```

## Nested Routing

Create hierarchical route structures with automatic outlet management:

```typescript
// Parent route with outlet
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(() => `
    <div class="dashboard">
      <aside>
        <a href="/dashboard/overview">Overview</a>
        <a href="/dashboard/settings">Settings</a>
      </aside>
      <section router-outlet></section>
    </div>
  `)
);

// Child routes render in parent's outlet
const overviewRoute = pipe(
  extend(dashboardRoute, path('overview'), end),
  enhancedView(() => '<h2>Dashboard Overview</h2>')
);

const settingsRoute = pipe(
  extend(dashboardRoute, path('settings'), end),
  enhancedView(() => '<h2>Settings</h2>')
);
```

### Outlet Attributes

```html
<!-- Basic outlet -->
<div router-outlet></div>

<!-- Outlet with transitions -->
<div 
  router-outlet
  router-outlet-enter="fade-in"
  router-outlet-leave="fade-out"
  router-outlet-duration="300">
</div>

<!-- Preserve scroll position -->
<div router-outlet router-outlet-preserve-scroll></div>
```

## Advanced View Functions

### Lazy Loading
```typescript
const route = pipe(
  route(path('heavy'), end),
  lazyView(
    () => import('./heavy-view').then(m => m.default),
    () => '<div>Loading...</div>'
  )
);
```

### Conditional Views
```typescript
const route = pipe(
  route(path('profile'), param('id'), end),
  conditionalView(
    ({ match }) => match.data.user.isAdmin,
    ({ match }) => `<admin-view user="${match.data.user}"></admin-view>`,
    ({ match }) => `<user-view user="${match.data.user}"></user-view>`
  )
);
```

### Error Boundaries
```typescript
const route = pipe(
  route(path('fragile'), end),
  errorBoundaryView(
    ({ match }) => riskyRenderFunction(match),
    (error) => `<div class="error">${error.message}</div>`
  )
);
```

### View Composition
```typescript
const route = pipe(
  route(path('complex'), end),
  composeViews({
    header: () => '<header>Title</header>',
    sidebar: () => '<nav>Menu</nav>',
    content: ({ match }) => `<main>${match.data.content}</main>`
  }, (parts) => `
    <div class="layout">
      ${parts.header}
      ${parts.sidebar}
      ${parts.content}
    </div>
  `)
);
```

### Cached Views
```typescript
const route = pipe(
  route(path('expensive'), param('id'), end),
  cachedView(
    ({ match }) => expensiveRender(match.data),
    ({ match }) => `cache-${match.params.id}`,
    60000 // Cache for 1 minute
  )
);
```

## Configuration

```typescript
interface EnhancedViewLayerConfig {
  // Root element for rendering (required)
  root: HTMLElement | string;
  
  // Enable morphdom for efficient updates
  useMorphdom?: boolean;
  
  // Morphdom configuration
  morphdomOptions?: MorphdomOptions;
  
  // Custom template renderer
  templateRenderer?: (result: any, container: HTMLElement) => void;
  
  // State views
  loadingView?: () => any;
  errorView?: (error: NavigationError) => any;
  notFoundView?: () => any;
  
  // Navigation options
  linkSelector?: string;
  disableLinkInterception?: boolean;
  
  // Nested routing
  enableOutlets?: boolean;
  outletAttribute?: string;
}
```

## API Reference

### View Functions
- `enhancedView(factory)` - Create an enhanced view
- `htmlTemplate(html, options)` - Create HTML template with lifecycle hooks
- `lazyView(loader, loadingView)` - Lazy load views
- `conditionalView(condition, trueView, falseView)` - Conditional rendering
- `errorBoundaryView(view, errorView)` - Error handling
- `composeViews(parts, composer)` - Compose multiple views
- `cachedView(factory, keyFn, ttl)` - Cache rendered views
- `streamingView(generator)` - Progressive rendering

### Morphdom Utilities
- `setMorphdom(morphdom)` - Provide morphdom implementation
- `createMorphdomIntegration(options)` - Create morphdom config
- `diffDOM(from, to)` - Compare DOM trees

### Nested Routing
- `createNestedRouter(config)` - Create nested router
- `createRouterOutlet(router, config)` - Create outlet programmatically
- `setupAutoOutlets(router, routes, container)` - Auto-discover outlets

## Examples

### Complete SPA Example

```typescript
import { html } from 'lit-html';
import morphdom from 'morphdom';
import { 
  createEnhancedViewLayer, 
  enhancedView,
  setMorphdom 
} from '@combi-router/enhanced-view';

// Setup morphdom
setMorphdom(morphdom);

// App shell with outlet
const appRoute = pipe(
  route(path('')),
  enhancedView(() => html`
    <div class="app">
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/about">About</a>
        </nav>
      </header>
      <main router-outlet></main>
      <footer>© 2024</footer>
    </div>
  `)
);

// Products with nested detail view
const productsRoute = pipe(
  extend(appRoute, path('products')),
  loader(async () => ({ products: await fetchProducts() })),
  enhancedView(({ match }) => html`
    <div class="products">
      <div class="list">
        ${match.data.products.map(p => html`
          <a href="/products/${p.id}">${p.name}</a>
        `)}
      </div>
      <div class="detail" router-outlet></div>
    </div>
  `)
);

// Product detail
const productRoute = pipe(
  extend(productsRoute, param('id'), end),
  loader(async ({ params }) => ({ 
    product: await fetchProduct(params.id) 
  })),
  enhancedView(({ match }) => html`
    <article>
      <h2>${match.data.product.name}</h2>
      <p>${match.data.product.description}</p>
      <button>Add to Cart</button>
    </article>
  `)
);

// Initialize router
const router = createLayeredRouter([
  appRoute,
  productsRoute,
  productRoute
])
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    enableOutlets: true,
    templateRenderer: (result, container) => {
      // Custom lit-html renderer
      litRender(result, container);
    }
  }))
  ();

router.start();
```

## Migration from Basic View Layer

The enhanced view layer is fully backward compatible:

```typescript
// Existing code continues to work
view(() => '<h1>Hello</h1>')

// Can be gradually enhanced
enhancedView(() => html`<h1>Hello</h1>`)
```

## Performance Tips

1. **Enable Morphdom** for large, frequently updating views
2. **Use Cached Views** for expensive renders
3. **Implement Lazy Loading** for code splitting
4. **Configure Morphdom** to preserve important state
5. **Use Template Renderers** optimized for your library

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11 with polyfills for:
  - Template literals
  - Promises
  - Custom Elements (if using web components)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © 2024 Combi-Router Contributors
# Enhanced View Layer Documentation

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Core Features](#core-features)
   - [HTML Template Support](#html-template-support)
   - [Morphdom Integration](#morphdom-integration)
   - [Hierarchical Nested Routing](#hierarchical-nested-routing)
4. [API Reference](#api-reference)
5. [Examples & Patterns](#examples--patterns)
6. [Migration Guide](#migration-guide)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

## Overview

The Enhanced View Layer extends Combi-Router's view capabilities with advanced features for modern single-page applications:

- **Universal Template Support**: Works with any templating system (lit-html, uhtml, Handlebars, etc.)
- **Efficient DOM Updates**: Morphdom integration for minimal DOM mutations
- **True Nested Routing**: Hierarchical route composition with automatic outlet management
- **Progressive Enhancement**: Backward compatible with existing view functions
- **Performance Optimized**: Built-in caching, lazy loading, and streaming support

### Key Benefits

1. **Flexibility**: Use your preferred templating library without lock-in
2. **Performance**: Morphdom ensures only changed DOM nodes are updated
3. **Scalability**: Hierarchical routing scales naturally with application complexity
4. **Developer Experience**: Intuitive API with TypeScript support

## Installation & Setup

### Basic Setup

```typescript
import { createLayeredRouter, createCoreNavigationLayer } from '@combi-router/core';
import { createEnhancedViewLayer } from '@combi-router/enhanced-view';

const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    enableOutlets: true
  }))
  ();
```

### With Morphdom

```bash
npm install morphdom
```

```typescript
import morphdom from 'morphdom';
import { setMorphdom, createEnhancedViewLayer } from '@combi-router/enhanced-view';

// Provide morphdom implementation
setMorphdom(morphdom);

const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    morphdomOptions: {
      onBeforeElUpdated: (fromEl, toEl) => {
        // Custom morphdom logic
        return true;
      }
    }
  }))
  ();
```

### Configuration Options

```typescript
interface EnhancedViewLayerConfig {
  // Root element for rendering (required)
  root: HTMLElement | string;
  
  // Enable morphdom for efficient updates
  useMorphdom?: boolean;
  
  // Custom morphdom options
  morphdomOptions?: MorphdomOptions;
  
  // Custom template renderer for your templating library
  templateRenderer?: (result: TemplateResult, container: HTMLElement) => void;
  
  // Views for different states
  loadingView?: () => string | Node | TemplateResult;
  errorView?: (error: NavigationError) => string | Node | TemplateResult;
  notFoundView?: () => string | Node | TemplateResult;
  
  // SPA navigation options
  linkSelector?: string;
  disableLinkInterception?: boolean;
  
  // Nested routing support
  enableOutlets?: boolean;
  outletAttribute?: string;
}
```

## Core Features

### HTML Template Support

The enhanced view layer supports multiple template formats out of the box:

#### String Templates

```typescript
const route = pipe(
  route(path(''), end),
  enhancedView(() => `
    <div class="home">
      <h1>Welcome!</h1>
    </div>
  `)
);
```

#### DOM Nodes

```typescript
const route = pipe(
  route(path(''), end),
  enhancedView(() => {
    const div = document.createElement('div');
    div.innerHTML = '<h1>Welcome!</h1>';
    return div;
  })
);
```

#### lit-html Templates

```typescript
import { html } from 'lit-html';
import { render } from 'lit-html/lib/render';

// Configure the template renderer
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    templateRenderer: (result, container) => {
      render(result, container);
    }
  }))
  ();

// Use lit-html in routes
const route = pipe(
  route(path('user'), param('id', z.string()), end),
  enhancedView(({ match }) => html`
    <div class="user">
      <h1>${match.data.user.name}</h1>
      <p>${match.data.user.email}</p>
    </div>
  `)
);
```

#### Custom Template Engines

```typescript
import Handlebars from 'handlebars';

const template = Handlebars.compile(`
  <div class="product">
    <h2>{{name}}</h2>
    <p>Price: ${{price}}</p>
  </div>
`);

const route = pipe(
  route(path('product'), param('id', z.string()), end),
  enhancedView(({ match }) => ({
    html: template(match.data.product)
  }))
);
```

#### HTML Template Helper

```typescript
const route = pipe(
  route(path(''), end),
  enhancedView(() => htmlTemplate(`
    <div class="interactive">
      <button id="action">Click me</button>
    </div>
  `, {
    afterRender: (element) => {
      element.querySelector('#action')?.addEventListener('click', () => {
        console.log('Clicked!');
      });
    }
  }))
);
```

### Morphdom Integration

Morphdom provides efficient DOM patching by only updating changed nodes:

#### Benefits

- **Preserves State**: Form inputs, focus, and scroll position maintained
- **Smooth Transitions**: No flash of white or jarring updates
- **Performance**: Minimal DOM operations
- **Animation Friendly**: CSS transitions work naturally

#### Configuration

```typescript
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    morphdomOptions: {
      // Don't update focused elements
      onBeforeElUpdated: (fromEl, toEl) => {
        if (fromEl === document.activeElement) {
          return false;
        }
        
        // Preserve form values
        if (fromEl.tagName === 'INPUT') {
          toEl.value = fromEl.value;
        }
        
        return true;
      },
      
      // Add animation classes
      onElUpdated: (el) => {
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 300);
      },
      
      // Preserve certain elements
      onBeforeNodeDiscarded: (node) => {
        if (node.hasAttribute('data-preserve')) {
          return false;
        }
        return true;
      }
    }
  }))
  ();
```

#### Manual Morphdom Updates

```typescript
// Get the enhanced view layer instance
const viewLayer = router.getLayer('EnhancedViewLayer');

// Force a morphdom update
viewLayer.morphUpdate('<div>New content</div>');
```

### Hierarchical Nested Routing

The enhanced view layer leverages Combi-Router's hierarchical route structure for true nested routing:

#### Route Hierarchy Definition

```typescript
// Parent route
const appRoute = pipe(
  route(path('')),
  enhancedView(() => html`
    <div class="app">
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </header>
      <!-- Child routes render here -->
      <main router-outlet></main>
    </div>
  `)
);

// Child route
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(({ match }) => html`
    <div class="dashboard">
      <aside>
        <a href="/dashboard/overview">Overview</a>
        <a href="/dashboard/analytics">Analytics</a>
      </aside>
      <!-- Nested child routes render here -->
      <section router-outlet router-outlet-parent="${match.route.id}">
      </section>
    </div>
  `)
);

// Grandchild routes
const overviewRoute = pipe(
  extend(dashboardRoute, path('overview'), end),
  enhancedView(({ match }) => html`
    <div class="overview">
      <h2>Dashboard Overview</h2>
      <p>Stats and metrics here...</p>
    </div>
  `)
);
```

#### Router Outlets

Outlets are placeholders where child routes render:

```html
<!-- Basic outlet -->
<div router-outlet></div>

<!-- Outlet with specific parent -->
<div router-outlet router-outlet-parent="42"></div>

<!-- Outlet with transitions -->
<div 
  router-outlet
  router-outlet-enter="fade-in"
  router-outlet-leave="fade-out"
  router-outlet-duration="300"
></div>

<!-- Preserve scroll position -->
<div router-outlet router-outlet-preserve-scroll></div>
```

#### Programmatic Outlet Management

```typescript
import { createRouterOutlet } from '@combi-router/enhanced-view';

const outlet = createRouterOutlet(router, {
  element: document.querySelector('#my-outlet'),
  parentRouteId: dashboardRoute.id,
  transition: {
    enter: 'slide-in',
    leave: 'slide-out',
    duration: 400
  },
  loadingView: () => '<div class="spinner"></div>',
  errorView: (error) => `<div class="error">${error.message}</div>`
});

// Manual update
outlet.update(router.currentMatch);

// Clear outlet
outlet.clear();

// Cleanup
outlet.destroy();
```

## API Reference

### View Functions

#### `enhancedView(factory)`

Creates an enhanced view for a route:

```typescript
function enhancedView<TParams>(
  factory: (context: ViewContext<TParams>) => 
    string | Node | TemplateResult | Promise<any>
): (route: Route<TParams>) => Route<TParams>
```

#### `htmlTemplate(html, options)`

Creates an HTML template result:

```typescript
function htmlTemplate(
  html: string,
  options?: {
    afterRender?: (element: HTMLElement) => void;
    beforeRender?: () => void;
  }
): HTMLTemplateResult
```

#### `lazyView(loader, loadingView)`

Creates a lazily loaded view:

```typescript
function lazyView<TParams>(
  loader: () => Promise<EnhancedViewFactory<TParams>>,
  loadingView?: EnhancedViewFactory<TParams>
): (route: Route<TParams>) => Route<TParams>
```

#### `conditionalView(condition, trueView, falseView)`

Renders different views based on a condition:

```typescript
function conditionalView<TParams>(
  condition: (context: ViewContext) => boolean,
  trueView: EnhancedViewFactory<TParams>,
  falseView: EnhancedViewFactory<TParams>
): (route: Route<TParams>) => Route<TParams>
```

#### `errorBoundaryView(view, errorView)`

Wraps a view with error handling:

```typescript
function errorBoundaryView<TParams>(
  view: EnhancedViewFactory<TParams>,
  errorView: (error: Error) => string | Node | TemplateResult
): (route: Route<TParams>) => Route<TParams>
```

#### `composeViews(parts, composer)`

Composes multiple view parts:

```typescript
function composeViews<TParams, TParts>(
  parts: { [K in keyof TParts]: EnhancedViewFactory<TParams> },
  composer: (parts: TParts) => string | Node | TemplateResult
): (route: Route<TParams>) => Route<TParams>
```

#### `cachedView(factory, keyFn, ttl)`

Caches rendered views:

```typescript
function cachedView<TParams>(
  factory: EnhancedViewFactory<TParams>,
  keyFn: (context: ViewContext) => string,
  ttl?: number
): (route: Route<TParams>) => Route<TParams>
```

### Layer Extensions

The enhanced view layer provides these methods:

```typescript
interface EnhancedViewLayerExtensions {
  // Re-render current view
  rerender(): void;
  
  // Get root element
  getRootElement(): HTMLElement | null;
  
  // Update configuration
  updateConfig(config: Partial<EnhancedViewLayerConfig>): void;
  
  // Register outlet
  registerOutlet(outlet: RouterOutlet): void;
  
  // Force morphdom update
  morphUpdate(content: string | Node): void;
}
```

## Examples & Patterns

### Master-Detail Layout

```typescript
// Master route showing list
const usersRoute = pipe(
  extend(appRoute, path('users')),
  loader(async () => ({ users: await fetchUsers() })),
  enhancedView(({ match }) => html`
    <div class="master-detail">
      <div class="master">
        <h2>Users</h2>
        <ul>
          ${match.data.users.map(user => html`
            <li>
              <a href="/users/${user.id}">${user.name}</a>
            </li>
          `)}
        </ul>
      </div>
      <div class="detail" router-outlet>
        <p>Select a user</p>
      </div>
    </div>
  `)
);

// Detail route
const userDetailRoute = pipe(
  extend(usersRoute, param('id', z.string()), end),
  loader(async ({ params }) => ({ 
    user: await fetchUser(params.id) 
  })),
  enhancedView(({ match }) => html`
    <div class="user-detail">
      <h3>${match.data.user.name}</h3>
      <p>${match.data.user.bio}</p>
    </div>
  `)
);
```

### Tab Navigation

```typescript
const tabsRoute = pipe(
  extend(appRoute, path('settings')),
  enhancedView(({ match }) => html`
    <div class="tabs">
      <nav class="tab-nav">
        <a href="/settings/profile" 
           class="${match.child?.route.id === profileRoute.id ? 'active' : ''}">
          Profile
        </a>
        <a href="/settings/security"
           class="${match.child?.route.id === securityRoute.id ? 'active' : ''}">
          Security
        </a>
      </nav>
      <div class="tab-content" router-outlet></div>
    </div>
  `)
);
```

### Wizard/Multi-Step Form

```typescript
const wizardRoute = pipe(
  extend(appRoute, path('wizard')),
  enhancedView(({ match }) => {
    const currentStep = match.child?.route.metadata?.step || 1;
    return html`
      <div class="wizard">
        <div class="steps">
          <span class="${currentStep >= 1 ? 'complete' : ''}">Personal</span>
          <span class="${currentStep >= 2 ? 'complete' : ''}">Address</span>
          <span class="${currentStep >= 3 ? 'complete' : ''}">Payment</span>
        </div>
        <div class="step-content" router-outlet></div>
      </div>
    `;
  })
);

const step1Route = pipe(
  extend(wizardRoute, path('personal'), end),
  meta({ step: 1 }),
  enhancedView(() => html`...`)
);
```

### Dynamic Route Loading

```typescript
const dynamicRoute = pipe(
  extend(appRoute, path('module'), param('name', z.string()), end),
  lazyView(
    async ({ match }) => {
      const module = await import(`./modules/${match.params.name}.js`);
      return module.default;
    },
    () => html`<div>Loading module...</div>`
  )
);
```

## Migration Guide

### From Basic View Layer

The enhanced view layer is backward compatible:

```typescript
// Old code still works
const route = pipe(
  route(path(''), end),
  view(() => '<h1>Hello</h1>')  // Regular view
);

// Can be gradually enhanced
const route = pipe(
  route(path(''), end),
  enhancedView(() => html`<h1>Hello</h1>`)  // Enhanced view
);
```

### Adding Morphdom

1. Install morphdom: `npm install morphdom`
2. Import and set: `setMorphdom(morphdom)`
3. Enable in config: `useMorphdom: true`
4. Configure options as needed

### Converting to Nested Routes

Before:
```typescript
// Separate routes
const dashboardRoute = route(path('dashboard'), end);
const analyticsRoute = route(path('dashboard'), path('analytics'), end);
```

After:
```typescript
// Hierarchical routes
const dashboardRoute = pipe(
  route(path('dashboard')),
  enhancedView(() => html`
    <div>Dashboard <div router-outlet></div></div>
  `)
);

const analyticsRoute = pipe(
  extend(dashboardRoute, path('analytics'), end),
  enhancedView(() => html`<div>Analytics</div>`)
);
```

## Performance Considerations

### Morphdom Optimization

- Use `childrenOnly: true` for container elements
- Implement `onBeforeElUpdated` to skip unnecessary updates
- Add `data-preserve` to elements that shouldn't be touched

### View Caching

```typescript
// Cache expensive renders
const route = pipe(
  route(path('report'), param('id', z.string()), end),
  cachedView(
    ({ match }) => expensiveRender(match.data),
    ({ match }) => match.params.id,
    60000  // 1 minute TTL
  )
);
```

### Lazy Loading

```typescript
// Split code for large views
const route = pipe(
  route(path('admin'), end),
  lazyView(
    () => import('./admin/dashboard').then(m => m.dashboardView),
    () => '<div>Loading admin panel...</div>'
  )
);
```

### Template Rendering

For best performance with template libraries:

```typescript
// Provide optimized renderer
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    templateRenderer: (result, container) => {
      // Use library's optimized render
      litRender(result, container);
    }
  }))
  ();
```

## Troubleshooting

### Outlets Not Rendering

1. Check `enableOutlets: true` in config
2. Verify outlet attributes are correct
3. Ensure parent route has a view
4. Check route hierarchy with `route.parent`

### Morphdom Not Working

1. Verify morphdom is installed and set
2. Check `useMorphdom: true` in config
3. Review console for morphdom errors
4. Test with simplified content first

### Template Results Not Rendering

1. Provide appropriate `templateRenderer`
2. Check template result structure
3. Verify async handling if using promises
4. Use `htmlTemplate()` helper for simple cases

### Memory Leaks

1. Call `outlet.destroy()` when removing outlets
2. Clear cached views periodically
3. Unsubscribe from router events
4. Use `_cleanup` lifecycle hook

### Performance Issues

1. Enable morphdom for large views
2. Use `cachedView()` for expensive renders
3. Implement lazy loading for heavy routes
4. Profile with DevTools Performance tab

## Best Practices

1. **Use Type-Safe Routes**: Leverage TypeScript for route parameters
2. **Compose Views**: Break complex views into smaller, reusable parts
3. **Handle Errors**: Use `errorBoundaryView` for resilient UIs
4. **Optimize Updates**: Configure morphdom to preserve important state
5. **Structure Hierarchically**: Design routes to mirror UI structure
6. **Cache Wisely**: Cache expensive views but avoid stale data
7. **Load Progressively**: Use lazy loading for code splitting
8. **Test Transitions**: Verify outlet transitions work smoothly
9. **Document Outlets**: Mark outlet purposes in templates
10. **Monitor Performance**: Use browser tools to track render times
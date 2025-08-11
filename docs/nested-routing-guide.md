# Nested Routing Guide

A comprehensive guide to implementing hierarchical routing patterns with Combi-Router's nested routing system.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Building Route Hierarchies](#building-route-hierarchies)
4. [Understanding Route Matching](#understanding-route-matching)
5. [Router Outlets](#router-outlets)
6. [Implementation Patterns](#implementation-patterns)
7. [Common Use Cases](#common-use-cases)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

Combi-Router's nested routing system leverages the natural parent-child relationships created by the `extend()` function to provide true hierarchical routing. This approach makes nested routing feel intuitive because your route definitions mirror your application's structure.

### Why Nested Routing?

Nested routing allows you to:
- **Structure Complex UIs**: Build layouts with multiple levels of nested content
- **Share Common Layouts**: Parent routes can define shared layouts for their children
- **Maintain State**: Parent components remain mounted while child routes change
- **Improve Code Organization**: Routes are organized hierarchically, matching your UI structure
- **Enable Progressive Rendering**: Load and render parts of your UI independently

### Key Benefits

- **Reference-Based Hierarchy**: Routes maintain explicit parent-child relationships
- **Automatic Propagation**: Changes to parent routes automatically affect all children
- **Type Safety**: Full TypeScript inference through the entire hierarchy
- **Natural API**: The routing structure matches your mental model of the UI

## Core Concepts

### Parent-Child Relationships

In Combi-Router, routes form a tree structure through the `extend()` function:

```typescript
// Parent route
const appRoute = route(path(''));

// Child route extends parent
const dashboardRoute = extend(appRoute, path('dashboard'));

// Grandchild route extends child
const settingsRoute = extend(dashboardRoute, path('settings'));
```

This creates a hierarchy:
```
appRoute (/)
  └── dashboardRoute (/dashboard)
      └── settingsRoute (/dashboard/settings)
```

### The Route Tree

Every route knows its position in the hierarchy:

```typescript
console.log(settingsRoute.parent === dashboardRoute);  // true
console.log(settingsRoute.depth);                      // 2
console.log(settingsRoute.ancestors);                  // [appRoute, dashboardRoute]
console.log(settingsRoute.routeChain);                 // [appRoute, dashboardRoute, settingsRoute]
```

### Match Tree Structure

When a URL is matched, Combi-Router creates a `RouteMatch` tree that mirrors the route hierarchy:

```typescript
interface RouteMatch<TParams = any> {
  route: Route<TParams>;
  params: TParams;
  pathname: string;
  search: string;
  hash: string;
  data?: any;
  child?: RouteMatch<any>;  // Nested match
}
```

## Building Route Hierarchies

### Basic Hierarchy

```typescript
import { route, extend, path, param, end } from '@combi-router';
import { z } from 'zod';

// Root application route
const appRoute = route(path(''));

// Main sections extend the root
const productsRoute = extend(appRoute, path('products'));
const usersRoute = extend(appRoute, path('users'));

// Nested routes extend their parents
const productDetailRoute = extend(
  productsRoute, 
  param('id', z.string()), 
  end
);

const userProfileRoute = extend(
  usersRoute,
  param('userId', z.string()),
  path('profile'),
  end
);
```

### Route Metadata Inheritance

Child routes can access and override parent metadata:

```typescript
const apiRoute = pipe(
  route(path('api'), path('v1')),
  meta({ 
    requiresAuth: true,
    rateLimit: 100 
  })
);

const publicEndpoint = pipe(
  extend(apiRoute, path('public')),
  meta({ 
    requiresAuth: false  // Override parent setting
  })
);
```

### Parameter Inheritance

Parameters from parent routes are automatically available to children:

```typescript
const workspaceRoute = route(
  path('workspace'),
  param('workspaceId', z.string())
);

const projectRoute = extend(
  workspaceRoute,
  path('project'),
  param('projectId', z.string())
);

// When matching /workspace/abc/project/123
// params will be: { workspaceId: 'abc', projectId: '123' }
```

## Understanding Route Matching

### How Matching Works

When a URL is matched, Combi-Router:

1. **Finds all matching routes** in order of specificity
2. **Identifies parent-child relationships** based on path length
3. **Builds a match tree** with parent and child matches
4. **Merges parameters** from all levels of the hierarchy
5. **Executes loaders in parallel** for all matched routes

```typescript
const router = createRouter([appRoute, dashboardRoute, settingsRoute]);

const match = router.match('/dashboard/settings');
// Returns:
// {
//   route: dashboardRoute,
//   pathname: '/dashboard',
//   params: {},
//   child: {
//     route: settingsRoute,
//     pathname: '/dashboard/settings',
//     params: {},
//     child: undefined
//   }
// }
```

## Parallel Data Fetching

One of the most powerful features of Combi-Router's nested routing is **automatic parallel data fetching**. When navigating to a nested route, all loaders in the hierarchy execute simultaneously, not sequentially.

### How It Works

When you navigate to a deeply nested route like `/workspace/123/project/456/task/789`, Combi-Router:

1. **Identifies all routes in the hierarchy** that have loaders
2. **Starts all loaders simultaneously** using `Promise.all()`
3. **Waits for all loaders to complete** before rendering
4. **Provides each route with its loaded data** in the match tree

### Example: Parallel Loading in Action

```typescript
// Each route has its own loader
const workspaceRoute = pipe(
  extend(appRoute, path('workspace'), param('workspaceId', z.string())),
  loader(async ({ params }) => {
    console.log('Loading workspace...');
    const workspace = await fetchWorkspace(params.workspaceId); // Takes 500ms
    return { workspace };
  })
);

const projectRoute = pipe(
  extend(workspaceRoute, path('project'), param('projectId', z.string())),
  loader(async ({ params }) => {
    console.log('Loading project...');
    const project = await fetchProject(params.projectId); // Takes 400ms
    return { project };
  })
);

const taskRoute = pipe(
  extend(projectRoute, path('task'), param('taskId', z.string())),
  loader(async ({ params }) => {
    console.log('Loading task...');
    const task = await fetchTask(params.taskId); // Takes 300ms
    return { task };
  })
);

// When navigating to /workspace/123/project/456/task/789:
// Console output (note they start simultaneously):
// Loading workspace...
// Loading project...
// Loading task...
// Total time: ~500ms (the longest loader), NOT 1200ms!
```

### Performance Benefits

Without parallel loading, nested routes would load sequentially:
- Sequential: 500ms + 400ms + 300ms = **1200ms total**
- Parallel: max(500ms, 400ms, 300ms) = **500ms total**

This can result in **2-3x faster page loads** for deeply nested routes!

### Configuring Parallel Loading

The loader layer enables parallel loading by default, but you can configure it:

```typescript
import { createLoaderLayer } from '@combi-router/layers';

const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createLoaderLayer({
    parallelLoading: true,  // Default: true
    loaderTimeout: 10000,   // Timeout applies to each loader individually
  }))
  ();
```

### Accessing Parent Data in Child Routes

Even though loaders run in parallel, child routes can access parent data after loading:

```typescript
const projectRoute = pipe(
  extend(workspaceRoute, path('project'), param('projectId', z.string())),
  loader(async ({ params }) => {
    // This loader runs in parallel with the workspace loader
    const project = await fetchProject(params.projectId);
    return { project };
  }),
  enhancedView(({ match }) => {
    // After loading, can access parent's data
    const workspace = match.parent?.data?.workspace;
    const project = match.data.project;
    
    return `
      <div>
        <h1>${workspace.name} / ${project.name}</h1>
      </div>
    `;
  })
);
```

### Dependent Data Loading

If you need sequential loading (child depends on parent data), you have options:

```typescript
// Option 1: Access parent match in loader (if available)
const projectRoute = pipe(
  extend(workspaceRoute, path('project'), param('projectId', z.string())),
  loader(async ({ params }, { parentMatch }) => {
    // Note: This pattern requires custom loader implementation
    const workspace = parentMatch?.data?.workspace;
    if (workspace) {
      // Use parent data if available
      const project = await fetchProjectInWorkspace(workspace.id, params.projectId);
      return { project };
    }
    // Fallback to independent fetch
    const project = await fetchProject(params.projectId);
    return { project };
  })
);

// Option 2: Disable parallel loading for specific routes
const router = createLayeredRouter(routes)
  (createLoaderLayer({
    parallelLoading: false,  // Sequential loading
  }))
  ();

// Option 3: Use route metadata to control loading
const sequentialRoute = pipe(
  extend(parentRoute, path('child')),
  meta({ sequential: true }),  // Custom metadata
  loader(async (context) => {
    // Custom sequential loading logic
  })
);
```

### Best Practices for Parallel Loading

1. **Design Independent Loaders**: Write loaders that don't depend on parent data when possible
2. **Use IDs from Params**: Extract necessary IDs from URL parameters rather than parent data
3. **Cache Strategically**: Use caching to avoid redundant fetches
4. **Handle Errors Gracefully**: One loader failure shouldn't break the entire page

```typescript
// Good: Independent loaders using params
const teamRoute = pipe(
  extend(orgRoute, path('team'), param('teamId', z.string())),
  loader(async ({ params }) => {
    // Uses teamId from URL, not parent data
    const team = await fetchTeam(params.teamId);
    return { team };
  })
);

// Good: Error boundaries for resilience
const riskyRoute = pipe(
  extend(parentRoute, path('risky')),
  loader(async () => {
    try {
      return { data: await riskyFetch() };
    } catch (error) {
      return { data: null, error: error.message };
    }
  })
);
```

### Monitoring Parallel Loading

In development, you can monitor parallel loading behavior:

```typescript
const router = createLayeredRouter(routes)
  (createLoaderLayer({
    debug: true,  // Enable debug logging
  }))
  ();

// You'll see in console:
// [LoaderLayer] Loading data for route 1
// [LoaderLayer] Loading data for route 2
// [LoaderLayer] Loading data for route 3
// [LoaderLayer] Loader for route 2 completed in 234.56ms
// [LoaderLayer] Loader for route 3 completed in 345.67ms
// [LoaderLayer] Loader for route 1 completed in 456.78ms
```

### Accessing Nested Matches

```typescript
function walkMatchTree(match: RouteMatch | null) {
  let current = match;
  while (current) {
    console.log(`Route: ${current.route.staticPath}`);
    console.log(`Params:`, current.params);
    current = current.child;
  }
}
```

## Router Outlets

Router outlets are placeholders in parent views where child routes render their content.

### Basic Outlet Usage

With the enhanced view layer:

```typescript
import { enhancedView } from '@combi-router/enhanced-view';

const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(() => `
    <div class="dashboard">
      <nav class="sidebar">
        <a href="/dashboard/overview">Overview</a>
        <a href="/dashboard/reports">Reports</a>
      </nav>
      <!-- Child routes render here -->
      <main router-outlet></main>
    </div>
  `)
);

const overviewRoute = pipe(
  extend(dashboardRoute, path('overview'), end),
  enhancedView(() => `
    <div class="overview">
      <h2>Dashboard Overview</h2>
      <p>Your content here...</p>
    </div>
  `)
);
```

### Outlet Attributes

```html
<!-- Basic outlet -->
<div router-outlet></div>

<!-- Outlet for specific parent route -->
<div router-outlet router-outlet-parent="42"></div>

<!-- Outlet with transitions -->
<div 
  router-outlet
  router-outlet-enter="slide-in"
  router-outlet-leave="slide-out"
  router-outlet-duration="300">
</div>

<!-- Preserve scroll position -->
<div router-outlet router-outlet-preserve-scroll></div>
```

### Programmatic Outlets

For frameworks or vanilla JS:

```typescript
import { createOutlet } from '@combi-router/utils';

const outlet = createOutlet(
  router,
  dashboardRoute,
  document.querySelector('#outlet'),
  [
    [overviewRoute, (match) => createOverviewElement(match)],
    [reportsRoute, (match) => createReportsElement(match)]
  ]
);

// Cleanup when done
outlet.destroy();
```

### Multiple Outlets

You can have multiple outlets at different levels:

```typescript
const appRoute = pipe(
  route(path('')),
  enhancedView(() => `
    <div class="app">
      <header>App Header</header>
      <div router-outlet></div>  <!-- Level 1 outlet -->
    </div>
  `)
);

const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(({ match }) => `
    <div class="dashboard">
      <aside>Dashboard Menu</aside>
      <main router-outlet router-outlet-parent="${match.route.id}"></main>  <!-- Level 2 outlet -->
    </div>
  `)
);
```

## Implementation Patterns

### Layout Pattern

Share common layouts across multiple child routes:

```typescript
// Shared layout
const adminLayout = pipe(
  extend(appRoute, path('admin')),
  guard(async () => await isAdmin() || '/login'),
  enhancedView(() => `
    <div class="admin-layout">
      <header class="admin-header">
        <h1>Admin Panel</h1>
        <nav>
          <a href="/admin/users">Users</a>
          <a href="/admin/settings">Settings</a>
          <a href="/admin/logs">Logs</a>
        </nav>
      </header>
      <main class="admin-content" router-outlet></main>
    </div>
  `)
);

// Child routes share the admin layout
const adminUsersRoute = pipe(
  extend(adminLayout, path('users'), end),
  loader(async () => ({ users: await fetchUsers() })),
  enhancedView(({ match }) => `
    <div class="users-management">
      ${match.data.users.map(user => `
        <div>${user.name}</div>
      `).join('')}
    </div>
  `)
);
```

### Master-Detail Pattern

Common pattern for list/detail views:

```typescript
const productsRoute = pipe(
  extend(appRoute, path('products')),
  loader(async () => ({ products: await fetchProducts() })),
  enhancedView(({ match }) => `
    <div class="products-layout">
      <aside class="product-list">
        <h2>Products</h2>
        ${match.data.products.map(product => `
          <a href="/products/${product.id}">${product.name}</a>
        `).join('')}
      </aside>
      <main class="product-detail" router-outlet>
        <p>Select a product to view details</p>
      </main>
    </div>
  `)
);

const productDetailRoute = pipe(
  extend(productsRoute, param('id', z.string()), end),
  loader(async ({ params }) => ({ 
    product: await fetchProduct(params.id) 
  })),
  enhancedView(({ match }) => `
    <article class="product">
      <h1>${match.data.product.name}</h1>
      <p>${match.data.product.description}</p>
      <span>$${match.data.product.price}</span>
    </article>
  `)
);
```

### Tab Navigation Pattern

```typescript
const settingsRoute = pipe(
  extend(appRoute, path('settings')),
  enhancedView(({ match }) => {
    const activeTab = match.child?.route.staticPath.split('/').pop() || 'general';
    return `
      <div class="settings">
        <nav class="tabs">
          <a href="/settings/general" class="${activeTab === 'general' ? 'active' : ''}">
            General
          </a>
          <a href="/settings/security" class="${activeTab === 'security' ? 'active' : ''}">
            Security
          </a>
          <a href="/settings/notifications" class="${activeTab === 'notifications' ? 'active' : ''}">
            Notifications
          </a>
        </nav>
        <div class="tab-content" router-outlet></div>
      </div>
    `;
  })
);

const generalSettingsRoute = pipe(
  extend(settingsRoute, path('general'), end),
  enhancedView(() => `<div>General settings content...</div>`)
);
```

### Wizard/Multi-Step Form Pattern

```typescript
const checkoutRoute = pipe(
  extend(appRoute, path('checkout')),
  enhancedView(({ match }) => {
    const currentStep = match.child?.route.metadata?.step || 1;
    const steps = ['Shipping', 'Payment', 'Review'];
    
    return `
      <div class="checkout-wizard">
        <div class="steps">
          ${steps.map((step, i) => `
            <div class="step ${i + 1 <= currentStep ? 'completed' : ''}">
              ${i + 1}. ${step}
            </div>
          `).join('')}
        </div>
        <div class="step-content" router-outlet></div>
        <div class="navigation">
          ${currentStep > 1 ? '<button onclick="history.back()">Previous</button>' : ''}
          ${currentStep < 3 ? '<button onclick="nextStep()">Next</button>' : ''}
        </div>
      </div>
    `;
  })
);

const shippingRoute = pipe(
  extend(checkoutRoute, path('shipping'), end),
  meta({ step: 1 }),
  enhancedView(() => `<form>Shipping information...</form>`)
);
```

### Modal Pattern

Modals as nested routes:

```typescript
const photosRoute = pipe(
  extend(appRoute, path('photos')),
  enhancedView(({ match }) => `
    <div class="photo-gallery">
      <div class="photos">
        <!-- Photo grid -->
      </div>
      ${match.child ? `
        <div class="modal-backdrop" onclick="closeModal()">
          <div class="modal" router-outlet onclick="event.stopPropagation()"></div>
        </div>
      ` : ''}
    </div>
  `)
);

const photoModalRoute = pipe(
  extend(photosRoute, param('photoId', z.string()), end),
  enhancedView(({ match }) => `
    <div class="photo-modal">
      <img src="/photos/${match.params.photoId}/full" />
      <button onclick="history.back()">Close</button>
    </div>
  `)
);
```

## Common Use Cases

### Dashboard with Multiple Sections

```typescript
// Main dashboard structure
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  guard(requireAuth),
  loader(async () => ({ user: await getCurrentUser() })),
  enhancedView(({ match }) => `
    <div class="dashboard">
      <header>Welcome, ${match.data.user.name}</header>
      <nav>
        <a href="/dashboard/home">Home</a>
        <a href="/dashboard/analytics">Analytics</a>
        <a href="/dashboard/settings">Settings</a>
      </nav>
      <main router-outlet></main>
    </div>
  `)
);

// Dashboard sections
const dashboardHomeRoute = pipe(
  extend(dashboardRoute, path('home'), end),
  enhancedView(() => `<div>Dashboard home content</div>`)
);

const analyticsRoute = pipe(
  extend(dashboardRoute, path('analytics')),
  enhancedView(() => `
    <div class="analytics">
      <h2>Analytics</h2>
      <nav>
        <a href="/dashboard/analytics/traffic">Traffic</a>
        <a href="/dashboard/analytics/revenue">Revenue</a>
      </nav>
      <div router-outlet></div>
    </div>
  `)
);

// Nested analytics sections
const trafficRoute = pipe(
  extend(analyticsRoute, path('traffic'), end),
  loader(async () => ({ traffic: await fetchTrafficData() })),
  enhancedView(({ match }) => `
    <div>Traffic data: ${JSON.stringify(match.data.traffic)}</div>
  `)
);
```

### E-commerce Product Catalog

```typescript
const catalogRoute = pipe(
  extend(appRoute, path('catalog')),
  enhancedView(() => `
    <div class="catalog">
      <aside class="filters">
        <h3>Filters</h3>
        <!-- Filter controls -->
      </aside>
      <main router-outlet></main>
    </div>
  `)
);

const categoryRoute = pipe(
  extend(catalogRoute, param('category', z.string())),
  loader(async ({ params }) => ({
    category: await fetchCategory(params.category),
    products: await fetchCategoryProducts(params.category)
  })),
  enhancedView(({ match }) => `
    <div class="category">
      <h1>${match.data.category.name}</h1>
      <div class="products-grid">
        ${match.data.products.map(p => `
          <a href="/catalog/${match.params.category}/${p.id}">
            ${p.name}
          </a>
        `).join('')}
      </div>
      <div router-outlet></div>
    </div>
  `)
);

const productRoute = pipe(
  extend(categoryRoute, param('productId', z.string()), end),
  loader(async ({ params }) => ({
    product: await fetchProduct(params.productId)
  })),
  enhancedView(({ match }) => `
    <div class="product-overlay">
      <div class="product-detail">
        <h2>${match.data.product.name}</h2>
        <img src="${match.data.product.image}" />
        <p>${match.data.product.description}</p>
        <button>Add to Cart</button>
      </div>
    </div>
  `)
);
```

### Admin Panel with Role-Based Access

```typescript
const adminRoute = pipe(
  extend(appRoute, path('admin')),
  guard(async () => {
    const user = await getCurrentUser();
    return user.role === 'admin' || '/unauthorized';
  }),
  enhancedView(() => `
    <div class="admin-panel">
      <aside class="admin-sidebar">
        <h2>Admin</h2>
        <nav>
          <a href="/admin/users">Users</a>
          <a href="/admin/content">Content</a>
          <a href="/admin/settings">Settings</a>
        </nav>
      </aside>
      <main class="admin-main" router-outlet></main>
    </div>
  `)
);

const usersManagementRoute = pipe(
  extend(adminRoute, path('users')),
  enhancedView(() => `
    <div class="users-management">
      <h2>User Management</h2>
      <div class="users-layout">
        <div class="users-list">
          <!-- User list -->
        </div>
        <div class="user-detail" router-outlet></div>
      </div>
    </div>
  `)
);

const userEditRoute = pipe(
  extend(usersManagementRoute, param('userId', z.string()), path('edit'), end),
  guard(async () => {
    const user = await getCurrentUser();
    return user.permissions.includes('edit_users') || '/admin/users';
  }),
  loader(async ({ params }) => ({
    user: await fetchUser(params.userId)
  })),
  enhancedView(({ match }) => `
    <form class="user-edit">
      <h3>Edit User: ${match.data.user.name}</h3>
      <!-- Edit form fields -->
    </form>
  `)
);
```

## API Reference

### Route Building

#### `extend(baseRoute, ...matchers)`

Creates a child route that extends a parent route.

```typescript
function extend<TBase, TExtension extends RouteMatcher[]>(
  baseRoute: Route<TBase>,
  ...additionalMatchers: TExtension
): Route<TBase & InferMatcherParams<TExtension>>
```

### Route Properties

```typescript
interface Route<TParams> {
  // Hierarchy properties
  parent?: Route<any>;          // Parent route reference
  depth: number;                 // Depth in the route tree
  ancestors: Route<any>[];       // All ancestor routes
  routeChain: Route<any>[];      // Complete chain from root
  
  // Route properties
  id: number;                    // Unique route identifier
  staticPath: string;            // Static path segments
  paramNames: string[];          // Parameter names
  isDynamic: boolean;            // Has dynamic segments
}
```

### Match Structure

```typescript
interface RouteMatch<TParams> {
  route: Route<TParams>;         // Matched route
  params: TParams;                // Route parameters
  pathname: string;               // Matched pathname
  search: string;                 // Query string
  hash: string;                   // URL hash
  data?: any;                     // Loaded data
  child?: RouteMatch<any>;        // Child match (nested)
}
```

### Enhanced View Layer

#### `createRouterOutlet(router, config)`

```typescript
function createRouterOutlet(
  router: ComposableRouter<any>,
  config: OutletConfig
): RouterOutlet

interface OutletConfig {
  element: HTMLElement;
  parentRouteId?: number;
  transition?: {
    enter?: string;
    leave?: string;
    duration?: number;
  };
  preserveScroll?: boolean;
  loadingView?: () => string | Node;
  errorView?: (error: Error) => string | Node;
}
```

### Utilities

#### `createOutlet(router, parentRoute, container, viewMap)`

```typescript
function createOutlet(
  router: ComposableRouter,
  parentRoute: Route<any>,
  container: HTMLElement,
  viewMap: Array<[Route<any>, ElementFactory<any>]>
): { destroy: () => void }
```

## Best Practices

### 1. Structure Routes Hierarchically

Organize routes to mirror your UI structure:

```typescript
// Good: Clear hierarchy
const appRoute = route(path(''));
const dashboardRoute = extend(appRoute, path('dashboard'));
const settingsRoute = extend(dashboardRoute, path('settings'));

// Avoid: Flat structure
const dashboardRoute = route(path('dashboard'));
const settingsRoute = route(path('dashboard'), path('settings'));
```

### 2. Use Type-Safe Parameters

Always validate parameters with schemas:

```typescript
// Good: Validated parameters
const userRoute = extend(
  appRoute,
  path('user'),
  param('id', z.string().uuid())
);

// Avoid: Unvalidated parameters
const userRoute = extend(
  appRoute,
  path('user'),
  param('id', z.any())
);
```

### 3. Keep Views Focused

Parent views should only contain layout, not child-specific logic:

```typescript
// Good: Parent focuses on layout
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(() => `
    <div class="dashboard-layout">
      <nav>...</nav>
      <main router-outlet></main>
    </div>
  `)
);

// Avoid: Parent contains child logic
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  enhancedView(({ match }) => `
    <div class="dashboard-layout">
      <nav>...</nav>
      <main>
        ${match.child?.route.id === overviewRoute.id ? 
          '<div>Overview content</div>' : ''}
      </main>
    </div>
  `)
);
```

### 4. Handle Loading States

Provide loading views for async content:

```typescript
const dataRoute = pipe(
  extend(appRoute, path('data')),
  loader(async () => {
    // Slow operation
    return await fetchLargeDataset();
  }),
  enhancedView(() => `
    <div router-outlet></div>
  `)
);

// Configure loading view
const router = createLayeredRouter(routes)
  (createEnhancedViewLayer({
    root: '#app',
    loadingView: () => '<div class="spinner">Loading...</div>'
  }))();
```

### 5. Use Guards at Appropriate Levels

Apply guards at the highest appropriate level:

```typescript
// Good: Guard on parent affects all children
const adminRoute = pipe(
  extend(appRoute, path('admin')),
  guard(requireAdmin)
);

// All child routes automatically protected
const usersRoute = extend(adminRoute, path('users'));
const logsRoute = extend(adminRoute, path('logs'));
```

### 6. Optimize Data Loading

Load data at the appropriate level to avoid redundant fetches:

```typescript
// Load user once at parent level
const userRoute = pipe(
  extend(appRoute, path('user'), param('id', z.string())),
  loader(async ({ params }) => ({
    user: await fetchUser(params.id)
  })),
  enhancedView(({ match }) => `
    <div class="user-layout">
      <h1>${match.data.user.name}</h1>
      <nav>
        <a href="/user/${match.params.id}/profile">Profile</a>
        <a href="/user/${match.params.id}/posts">Posts</a>
      </nav>
      <div router-outlet></div>
    </div>
  `)
);

// Child routes can access parent's loaded data
const userProfileRoute = pipe(
  extend(userRoute, path('profile'), end),
  enhancedView(({ match }) => {
    // Access user from parent match
    const parentMatch = router.currentMatch;
    const user = parentMatch?.data?.user;
    return `<div>Profile for ${user.name}</div>`;
  })
);
```

## Troubleshooting

### Outlets Not Rendering

**Problem**: Child routes not appearing in outlets

**Solutions**:
1. Ensure `enableOutlets: true` in enhanced view layer config
2. Verify outlet has correct `router-outlet` attribute
3. Check parent route has a view defined
4. Confirm child route extends the correct parent

```typescript
// Debug outlet issues
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createEnhancedViewLayer({
    root: '#app',
    enableOutlets: true  // Must be enabled
  }))();

// Check route hierarchy
console.log('Parent:', childRoute.parent);
console.log('Route chain:', childRoute.routeChain);
```

### Parameters Not Available

**Problem**: Child routes can't access parent parameters

**Solution**: Parameters are merged automatically, check the match structure:

```typescript
router.subscribe((match) => {
  console.log('Current match:', match);
  console.log('Params at this level:', match?.params);
  
  // Walk the match tree
  let current = match;
  while (current) {
    console.log(`Level ${current.route.depth} params:`, current.params);
    current = current.child;
  }
});
```

### Incorrect Route Matching

**Problem**: Wrong route being matched

**Solution**: Check route order and use `end` matcher:

```typescript
// Be specific with route endings
const usersRoute = extend(appRoute, path('users'));  // Matches /users*
const usersExactRoute = extend(appRoute, path('users'), end);  // Matches only /users
```

### View Not Updating

**Problem**: View doesn't update when navigating between child routes

**Solutions**:
1. Enable morphdom for efficient updates
2. Ensure views return different content
3. Check for JavaScript errors in view functions

```typescript
// Enable morphdom
import morphdom from 'morphdom';
import { setMorphdom } from '@combi-router/enhanced-view';

setMorphdom(morphdom);

const router = createLayeredRouter(routes)
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true
  }))();
```

### Memory Leaks

**Problem**: Outlets not cleaning up properly

**Solution**: Always destroy outlets when done:

```typescript
const outlet = createRouterOutlet(router, {
  element: document.querySelector('#outlet')
});

// Clean up when component unmounts
window.addEventListener('beforeunload', () => {
  outlet.destroy();
});
```

## Summary

Combi-Router's nested routing system provides a powerful, intuitive way to build complex hierarchical UIs. By leveraging the natural parent-child relationships created through the `extend()` function, you can:

- Build routes that mirror your UI structure
- Share layouts and logic between related routes
- Maintain parent state while child routes change
- Create type-safe, refactorable navigation
- Implement complex patterns like master-detail, tabs, and wizards

The combination of hierarchical route definitions and router outlets makes nested routing feel natural and maintainable, while the enhanced view layer provides all the tools needed for efficient rendering and state management.
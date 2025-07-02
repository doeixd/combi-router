[![npm version](https://badge.fury.io/js/@doeixd%2Fcombi-router.svg)](https://badge.fury.io/js/@doeixd%2Fcombi-router) [![TypeScript](https://img.shields.io/badge/-TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/) [![Build Status](https://img.shields.io/github/actions/workflow/status/doeixd/combi-router/ci.yml?branch=main)](https://github.com/doeixd/combi-router/actions)

# Combi-Router 🛤️

A composable, type-safe router built on parser combinators that thinks in trees. Routes are defined functionally and composed by reference, creating natural hierarchies that mirror your application structure.

<br />

## 📦 Installation

```bash
npm install @doeixd/combi-router @doeixd/combi-parse zod
```

Combi-Router is built on `@doeixd/combi-parse` for robust URL parsing and uses `zod` for powerful, type-safe parameter validation.

<br />

## ✨ Key Features

### **Core Routing**
- **Reference-Based Navigation**: Navigate using route objects for perfect type safety.
- **Functional Composition**: Build routes by composing pure functions instead of method chaining.
- **Hierarchical Matching**: Routes extend each other by reference, creating intuitive, nested trees.
- **Route Introspection**: Built-in utilities for analyzing route structure (depth, ancestors, static paths).
- **Advanced Navigation**: Detailed NavigationResult with error handling and cancellation support.
- **Typed Guards**: Type-safe route protection with full parameter and context access.

### **Data Loading & Resources**
- **Parallel Data Loading**: Loaders for all active nested routes run concurrently for maximum speed.
- **Suspense & Resources**: Elegant, built-in support for handling asynchronous data states.
- **Advanced Resource System**: Enhanced resources with retry logic, caching, and invalidation strategies.
- **Cache Tags & Invalidation**: Powerful cache management with tag-based invalidation.
- **Global Resource State**: Centralized resource monitoring and observability.

### **Modular Architecture**
- **Tree-Shaking Optimized**: Import only what you need with granular module exports.
- **Core Module**: Essential routing functionality (`@doeixd/combi-router/core`).
- **Data Module**: Advanced resource and caching features (`@doeixd/combi-router/data`).
- **Features Module**: Production optimizations (`@doeixd/combi-router/features`).
- **Dev Module**: Development tools and debugging (`@doeixd/combi-router/dev`).
- **Utils Module**: Framework-agnostic utilities (`@doeixd/combi-router/utils`).

### **Developer Experience**
- **Dev Mode Warnings**: Comprehensive development-time validation and conflict detection.
- **Enhanced Debugging**: Advanced debugging utilities with performance monitoring.
- **Route Analysis**: Detailed route structure analysis and optimization suggestions.
- **Type Safety Improvements**: Better StandardSchema integration and parameter inference.

### **Production Features**
- **Performance Optimizations**: Intelligent prefetching, viewport-aware loading, and memory management.
- **Scroll Restoration**: Configurable scroll position management with state preservation.
- **Enhanced Code Splitting**: Advanced lazy loading strategies with priority-based prefetching.
- **Advanced Transition System**: Sophisticated page transitions with proper lifecycle management.
- **View Transitions**: App-like animated page transitions enabled by default in supported browsers.

### **Framework Support**
- **End-to-End Type Safety**: Full TypeScript inference from route definition to data access.
- **Production Ready**: Caching, preloading, guards, lazy-loading, and error boundaries.
- **Framework Agnostic**: Works with React, Vue, Svelte, or vanilla JavaScript.
- **Web Components**: Ready-to-use declarative routing components.

<br />

## 🚀 Quick Start

Let's start simple and build up your understanding step by step.

### Understanding Routes

A **route** in Combi-Router is a blueprint that describes a URL's structure and behavior.

```typescript
import { route, path } from '@doeixd/combi-router';

// This route matches the exact path "/users"
export const usersRoute = route(path('users'));
```

The `route()` function creates a new route from **matchers**. Matchers are small building blocks that each handle one part of a URL.

**Why export routes?** Routes are first-class objects you'll reference throughout your app for navigation, so treating them as exportable values makes them reusable and type-safe.

### Basic Matchers

```typescript
import { route, path, param } from '@doeixd/combi-router';
import { z } from 'zod';

// Static path segment
export const aboutRoute = route(path('about'));  // matches "/about"

// Dynamic parameter with validation
export const userRoute = route(
  path('users'),
  param('id', z.number())  // matches "/users/123" -> params.id is a number
);
```

**Why validation?** URLs are just strings. By validating during route matching, you catch errors early and get proper TypeScript types for your parameters.

### Building Route Trees

The real power comes from **composing routes by reference**. Instead of redefining common parts, you `extend` existing routes:

```typescript
import { extend } from '@doeixd/combi-router';

// Base route
export const dashboardRoute = route(path('dashboard'));

// Extend the base route
export const usersRoute = extend(dashboardRoute, path('users'));
export const userRoute = extend(usersRoute, param('id', z.number()));

// This creates a natural tree:
// /dashboard           <- dashboardRoute
// /dashboard/users     <- usersRoute  
// /dashboard/users/123 <- userRoute
```

**Why extend?** When you change the base route (e.g., to `/admin`), all extended routes automatically update. Your route structure mirrors your application structure.

### Adding Behavior with Higher-Order Functions

Enhance routes with additional behavior using `pipe()` and higher-order functions:

```typescript
import { meta, loader, layout, pipe } from '@doeixd/combi-router';

export const enhancedUserRoute = pipe(
  userRoute,
  meta({ title: 'User Profile' }),
  loader(async ({ params }) => {
    const user = await fetchUser(params.id);
    return { user };
  }),
  layout(ProfileLayout)
);
```

**Why higher-order functions?** They're composable and reusable. You can create your own enhancers and mix them with built-in ones.

### Creating the Router

Once you have routes, create a router instance from an array of all your routes:

```typescript
import { createRouter } from '@doeixd/combi-router';

const router = createRouter([
  dashboardRoute,
  usersRoute,
  enhancedUserRoute
]);

// Reference-based navigation with detailed results
const result = await router.navigate(enhancedUserRoute, { id: 123 });
if (result.success) {
  console.log('Navigation successful');
} else {
  console.error('Navigation failed:', result.error);
}

// Simple navigation for backward compatibility  
const success = await router.navigateSimple(enhancedUserRoute, { id: 123 });

// Type-safe URL building
const userUrl = router.build(enhancedUserRoute, { id: 123 }); // "/dashboard/users/123"
```

**Why route references?** Using actual route objects instead of string names provides perfect type inference and makes refactoring safe. TypeScript knows exactly what parameters each route needs.

<br />

## 🏗️ Core Concepts

### Route Building Improvements

#### Route Introspection Utilities

Routes now provide powerful introspection capabilities to analyze their structure:

```typescript
import { route, extend, path, param } from '@doeixd/combi-router';
import { z } from 'zod';

const dashboardRoute = route(path('dashboard'));
const usersRoute = extend(dashboardRoute, path('users'));
const userRoute = extend(usersRoute, param('id', z.number()));

// Analyze route structure
console.log(userRoute.depth);        // 2 (dashboard -> users -> user)
console.log(userRoute.ancestors);    // [dashboardRoute, usersRoute]
console.log(userRoute.staticPath);   // "/dashboard/users"
console.log(userRoute.paramNames);   // ["id"]
console.log(userRoute.isDynamic);    // true
console.log(userRoute.routeChain);   // [dashboardRoute, usersRoute, userRoute]
```

#### Route Validation at Creation Time

Routes are now validated when created, catching common configuration errors early:

```typescript
import { RouteValidationError } from '@doeixd/combi-router';

try {
  // This will throw if there are duplicate parameter names
  const problematicRoute = extend(
    route(param('id', z.string())),
    param('id', z.number()) // Error: Duplicate parameter name 'id'
  );
} catch (error) {
  if (error instanceof RouteValidationError) {
    console.error('Route configuration error:', error.message);
  }
}
```

#### Parent-Child Relationships

Routes maintain explicit parent-child relationships for better debugging and tooling:

```typescript
console.log(userRoute.parent === usersRoute);     // true
console.log(usersRoute.parent === dashboardRoute); // true
console.log(dashboardRoute.parent);               // null (root route)

// Walk up the hierarchy
let current = userRoute;
while (current) {
  console.log(current.staticPath);
  current = current.parent;
}
// Output: "/dashboard/users", "/dashboard", "/"
```

### Route Matchers

Matchers are the building blocks of routes. Each matcher handles one aspect of URL parsing:

```typescript
// Path segments
path('users')                    // matches "/users"
path.optional('category')        // matches "/category" or ""
path.wildcard('segments')        // matches "/any/number/of/segments"

// Parameters with validation
param('id', z.number())          // matches "/123" and validates as number
param('slug', z.string().min(3)) // matches "/hello" with minimum length

// Query parameters
query('page', z.number().default(1)) // matches "?page=5"
query.optional('search', z.string()) // matches "?search=term"

// Other components
end                              // ensures no remaining path segments
// subdomain(...) and hash(...) can be added with similar patterns
```

### Route Composition

Routes are composed functionally using `extend()`:

```typescript
export const apiRoute = route(path('api'), path('v1'));
export const usersRoute = extend(apiRoute, path('users'));
export const userRoute = extend(usersRoute, param('id', z.number()));

// userRoute now matches /api/v1/users/123
```

Parameters from parent routes are automatically inherited and merged into a single `params` object.

### Higher-Order Route Enhancers

Enhance routes with additional functionality:

```typescript
import { pipe, meta, loader, guard, cache, lazy } from '@doeixd/combi-router';

export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  meta({ title: (params) => `User ${params.id}` }),
  loader(async ({ params }) => ({ user: await fetchUser(params.id) })),
  guard(async () => await isAuthenticated() || '/login'),
  cache({ ttl: 5 * 60 * 1000 }), // Cache for 5 minutes
  lazy(() => import('./UserProfile'))
);
```

<br />

## 🔧 Modular Architecture

Combi-Router now features a modular architecture optimized for tree-shaking and selective feature adoption.

### Import Paths

```typescript
// Core routing functionality (always included)
import { route, extend, createRouter } from '@doeixd/combi-router';

// Advanced data loading and caching
import { createAdvancedResource, resourceState } from '@doeixd/combi-router/data';

// Production features and optimizations
import { 
  PerformanceManager,
  ScrollRestorationManager,
  TransitionManager 
} from '@doeixd/combi-router/features';

// Development tools and debugging
import { 
  createWarningSystem, 
  analyzeRoutes,
  DebugUtils 
} from '@doeixd/combi-router/dev';

// Framework-agnostic utilities
import { 
  createLink, 
  createActiveLink,
  createOutlet 
} from '@doeixd/combi-router/utils';
```

### Module Breakdown

#### Core Module (`@doeixd/combi-router`)
Essential routing functionality including route definition, matching, navigation, and basic data loading.

```typescript
import { 
  route, extend, path, param, query,
  createRouter, pipe, meta, loader, guard
} from '@doeixd/combi-router';
```

#### Data Module (`@doeixd/combi-router/data`)
Advanced resource management with caching, retry logic, and global state management.

```typescript
import { 
  createAdvancedResource,
  resourceState,
  globalCache 
} from '@doeixd/combi-router/data';

// Enhanced resource with retry and caching
const userResource = createAdvancedResource(
  () => api.fetchUser(userId),
  {
    retry: { attempts: 3 },
    cache: { ttl: 300000, invalidateOn: ['user'] },
    staleTime: 60000,
    backgroundRefetch: true
  }
);
```

#### Features Module (`@doeixd/combi-router/features`)
Production-ready features for performance optimization and user experience.

```typescript
import { 
  PerformanceManager,
  ScrollRestorationManager,
  TransitionManager,
  CodeSplittingManager 
} from '@doeixd/combi-router/features';

// Initialize performance monitoring
const performanceManager = new PerformanceManager({
  prefetchOnHover: true,
  prefetchViewport: true,
  enablePerformanceMonitoring: true,
  connectionAware: true
});
```

#### Dev Module (`@doeixd/combi-router/dev`)
Development tools for debugging and route analysis.

```typescript
import { 
  createWarningSystem,
  analyzeRoutes,
  DebugUtils,
  ConflictDetector 
} from '@doeixd/combi-router/dev';

// Create warning system for development
const warningSystem = createWarningSystem(router, {
  runtimeWarnings: true,
  performanceWarnings: true
});

// Quick route analysis
analyzeRoutes(router);
```

#### Utils Module (`@doeixd/combi-router/utils`)
Framework-agnostic utilities for DOM integration.

```typescript
import { 
  createLink,
  createActiveLink,
  createOutlet,
  createMatcher,
  createRouterStore 
} from '@doeixd/combi-router/utils';
```

### Bundle Size Optimization

The modular architecture enables significant bundle size optimization:

```typescript
// Minimal bundle - only core routing
import { route, extend, createRouter } from '@doeixd/combi-router';
// ~12KB gzipped

// With advanced resources
import { createAdvancedResource } from '@doeixd/combi-router/data';
// +4KB gzipped

// With production features
import { PerformanceManager } from '@doeixd/combi-router/features';
// +6KB gzipped

// Development tools (excluded in production)
import { createWarningSystem } from '@doeixd/combi-router/dev';
// +3KB gzipped (dev only)
```

<br />

## 📊 Enhanced Resource System

The new resource system provides production-ready data loading with advanced features.

### Basic Resources

```typescript
import { createResource } from '@doeixd/combi-router';

// Simple suspense-based resource
const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  loader(({ params }) => ({
    user: createResource(() => fetchUser(params.id)),
    posts: createResource(() => fetchUserPosts(params.id))
  }))
);

// In your component
function UserProfile() {
  const { user, posts } = router.currentMatch.data;
  
  // These will suspend until data is ready
  const userData = user.read();
  const postsData = posts.read();
  
  return <div>...</div>;
}
```

### Advanced Resources

```typescript
import { createAdvancedResource, resourceState } from '@doeixd/combi-router/data';

// Enhanced resource with all features
const userResource = createAdvancedResource(
  () => api.fetchUser(userId),
  {
    // Retry configuration with exponential backoff
    retry: {
      attempts: 3,
      delay: (attempt) => Math.min(1000 * Math.pow(2, attempt - 1), 10000),
      shouldRetry: (error) => error.status >= 500,
      onRetry: (error, attempt) => console.log(`Retry ${attempt}:`, error)
    },
    
    // Caching with tags for invalidation
    cache: {
      ttl: 300000, // 5 minutes
      invalidateOn: ['user', 'profile'],
      priority: 'high'
    },
    
    // Stale-while-revalidate behavior
    staleTime: 60000, // 1 minute
    backgroundRefetch: true
  }
);

// Check state without suspending
if (userResource.isLoading) {
  console.log('Loading user...');
}

// Non-suspending peek at cached data
const cachedUser = userResource.peek();
if (cachedUser) {
  console.log('Cached user:', cachedUser);
}

// Force refresh
await userResource.refetch();

// Invalidate resource
userResource.invalidate();
```

### Cache Management

```typescript
import { resourceState } from '@doeixd/combi-router/data';

// Global resource state monitoring
const globalState = resourceState.getGlobalState();
console.log('Loading resources:', globalState.loadingCount);

// Event system for observability
const unsubscribe = resourceState.onEvent((event) => {
  switch (event.type) {
    case 'fetch-start':
      console.log('Started loading:', event.resource);
      break;
    case 'fetch-success':
      console.log('Loaded successfully:', event.data);
      break;
    case 'fetch-error':
      console.error('Loading failed:', event.error);
      break;
    case 'retry':
      console.log(`Retry attempt ${event.attempt}:`, event.error);
      break;
  }
});

// Cache invalidation by tags
resourceState.invalidateByTags(['user', 'profile']);
```

<br />

## 🚀 Performance Features

### Intelligent Prefetching

```typescript
import { PerformanceManager } from '@doeixd/combi-router/features';

const performanceManager = new PerformanceManager({
  // Prefetch on hover with delay
  prefetchOnHover: true,
  
  // Prefetch when links enter viewport
  prefetchViewport: true,
  
  // Adjust behavior based on connection
  connectionAware: true,
  
  // Monitor performance metrics
  enablePerformanceMonitoring: true,
  
  // Preload critical routes immediately
  preloadCriticalRoutes: ['dashboard', 'user-profile'],
  
  // Memory management
  memoryManagement: {
    enabled: true,
    maxCacheSize: 50,
    maxCacheAge: 30 * 60 * 1000,
    cleanupInterval: 5 * 60 * 1000
  }
});

// Setup hover prefetching for a link
const cleanup = performanceManager.setupHoverPrefetch(linkElement, 'user-route');

// Setup viewport prefetching
const cleanupViewport = performanceManager.setupViewportPrefetch(linkElement, 'user-route');

// Get performance report
const report = performanceManager.getPerformanceReport();
console.log('Prefetch hit rate:', report.prefetchHitRate);
```

### Scroll Restoration

```typescript
import { ScrollRestorationManager } from '@doeixd/combi-router/features';

const scrollManager = new ScrollRestorationManager({
  enabled: true,
  restoreOnBack: true,
  restoreOnForward: true,
  saveScrollState: true,
  smoothScrolling: true,
  scrollBehavior: 'smooth',
  debounceTime: 100,
  
  // Advanced configuration
  customScrollContainer: '#main-content',
  excludeRoutes: ['modal-routes'],
  persistScrollState: true
});

// Manual scroll position management
scrollManager.saveScrollPosition(routeId);
scrollManager.restoreScrollPosition(routeId);
scrollManager.scrollToTop();
scrollManager.scrollToElement('#section');
```

### Advanced Transitions

```typescript
import { TransitionManager } from '@doeixd/combi-router/features';

const transitionManager = new TransitionManager({
  enabled: true,
  duration: 300,
  easing: 'ease-in-out',
  type: 'fade',
  
  // Per-route transition configuration
  routeTransitions: {
    'user-profile': { type: 'slide-left', duration: 400 },
    'settings': { type: 'fade', duration: 200 }
  },
  
  // Custom transition classes
  transitionClasses: {
    enter: 'page-enter',
    enterActive: 'page-enter-active',
    exit: 'page-exit',
    exitActive: 'page-exit-active'
  }
});

// Manual transition control
await transitionManager.performTransition(fromRoute, toRoute, {
  direction: 'forward',
  customData: { userId: 123 }
});
```

<br />

## 🛠️ Development Experience

### Development Warnings

```typescript
import { createWarningSystem, analyzeRoutes } from '@doeixd/combi-router/dev';

// Create comprehensive warning system
const warningSystem = createWarningSystem(router, {
  runtimeWarnings: true,
  staticWarnings: true,
  performanceWarnings: true,
  severityFilter: ['warning', 'error']
});

// Quick route analysis
analyzeRoutes(router);

// Get warnings programmatically
const warnings = warningSystem.getWarnings();
const conflictWarnings = warningSystem.getWarningsByType('conflicting-routes');
const errorWarnings = warningSystem.getWarningsBySeverity('error');
```

### Debugging Tools

```typescript
import { DebugUtils } from '@doeixd/combi-router/dev';

// Route structure debugging
DebugUtils.logRouteTree(router);
DebugUtils.analyzeRoutePerformance(router);
DebugUtils.checkRouteConflicts(router);

// Navigation debugging
DebugUtils.enableNavigationLogging(router);
DebugUtils.logMatchDetails(currentMatch);

// Performance debugging
DebugUtils.enablePerformanceMonitoring(router);
const metrics = DebugUtils.getPerformanceMetrics();
```

### Enhanced Error Handling

```typescript
import { NavigationErrorType } from '@doeixd/combi-router';

const result = await router.navigate(userRoute, { id: 123 });

if (!result.success) {
  switch (result.error?.type) {
    case NavigationErrorType.RouteNotFound:
      console.error('Route not found');
      break;
    case NavigationErrorType.GuardRejected:
      console.error('Navigation blocked:', result.error.message);
      break;
    case NavigationErrorType.LoaderFailed:
      console.error('Data loading failed:', result.error.originalError);
      break;
    case NavigationErrorType.ValidationFailed:
      console.error('Parameter validation failed');
      break;
    case NavigationErrorType.Cancelled:
      console.log('Navigation was cancelled');
      break;
  }
}
```

<br />

## 🔄 Migration Guide

### From v1.x to v2.x

#### Modular Imports

**Before:**
```typescript
import { createRouter, createResource, createLink } from '@doeixd/combi-router';
```

**After:**
```typescript
// Core functionality
import { createRouter } from '@doeixd/combi-router';

// Advanced resources (optional)
import { createAdvancedResource } from '@doeixd/combi-router/data';

// Utilities (optional)
import { createLink } from '@doeixd/combi-router/utils';
```

#### Enhanced Resources

**Before:**
```typescript
const resource = createResource(() => fetchUser(id));
```

**After:**
```typescript
// Simple resource (same API)
const resource = createResource(() => fetchUser(id));

// Or enhanced resource with more features
const resource = createAdvancedResource(
  () => fetchUser(id),
  {
    retry: { attempts: 3 },
    cache: { ttl: 300000 },
    staleTime: 60000
  }
);
```

#### Navigation API

The navigation API is fully backward compatible. Enhanced error handling is opt-in:

```typescript
// Old way (still works)
const success = await router.navigateSimple(route, params);

// New way (detailed error information)
const result = await router.navigate(route, params);
if (result.success) {
  // Handle success
} else {
  // Handle specific error types
}
```

<br />

## 🗂️ Advanced Features

### Navigation Improvements

#### NavigationResult with Detailed Error Handling

The `navigate()` method now returns a `NavigationResult` object with comprehensive information about the navigation attempt:

```typescript
import { NavigationErrorType } from '@doeixd/combi-router';

const result = await router.navigate(userRoute, { id: 123 });

if (result.success) {
  console.log('Navigation completed successfully');
  console.log('Active match:', result.match);
} else {
  // Handle different types of navigation errors
  switch (result.error?.type) {
    case NavigationErrorType.RouteNotFound:
      console.error('Route not found');
      break;
    case NavigationErrorType.GuardRejected:
      console.error('Navigation blocked by guard:', result.error.message);
      break;
    case NavigationErrorType.LoaderFailed:
      console.error('Data loading failed:', result.error.originalError);
      break;
    case NavigationErrorType.ValidationFailed:
      console.error('Parameter validation failed');
      break;
    case NavigationErrorType.Cancelled:
      console.log('Navigation was cancelled');
      break;
  }
}
```

#### Navigation Cancellation with NavigationController

Long-running navigations can now be cancelled, which is especially useful for preventing race conditions:

```typescript
// Start a navigation and get a controller
const controller = router.currentNavigation;

if (controller) {
  console.log('Navigating to:', controller.route);
  
  // Cancel the navigation if needed
  setTimeout(() => {
    if (!controller.cancelled) {
      controller.cancel();
      console.log('Navigation cancelled');
    }
  }, 1000);
  
  // Wait for the result
  const result = await controller.promise;
  if (result.cancelled) {
    console.log('Navigation was cancelled');
  }
}
```

#### Backward Compatibility with navigateSimple()

For simple use cases, the `navigateSimple()` method provides the traditional boolean return value:

```typescript
// Simple boolean result for straightforward cases
const success = await router.navigateSimple(userRoute, { id: 123 });
if (success) {
  console.log('Navigation successful');
} else {
  console.log('Navigation failed');
}

// Still get full details when needed
const detailedResult = await router.navigate(userRoute, { id: 123 });
```

### Typed Guards

#### Enhanced Guard Context and Type Safety

The new `typedGuard()` function provides better type safety and more context for route protection:

```typescript
import { typedGuard, GuardContext } from '@doeixd/combi-router';
import { z } from 'zod';

// Define a route with parameters
const adminUserRoute = route(
  path('admin'), 
  path('users'), 
  param('userId', z.string())
);

// Create a typed guard with full context access
const adminGuard = typedGuard<{ userId: string }>(({ params, to, from, searchParams }) => {
  // Full type safety on params
  const userId = params.userId; // TypeScript knows this is a string
  
  // Access to route context
  console.log('Navigating to:', to.url);
  console.log('Coming from:', from?.url || 'initial load');
  console.log('Search params:', searchParams.get('redirect'));
  
  // Return boolean for allow/deny or string for redirect
  if (!isCurrentUserAdmin()) {
    return '/login?redirect=' + encodeURIComponent(to.url);
  }
  
  // Additional validation based on the user ID
  if (!canAccessUser(userId)) {
    return false; // Block navigation
  }
  
  return true; // Allow navigation
});

// Apply the guard to the route
const protectedRoute = pipe(
  adminUserRoute,
  guard(adminGuard)
);
```

### Nested Routes and Parallel Data Loading

When a nested route like `/dashboard/users/123` is matched, Combi-Router builds a tree of match objects. If both `dashboardRoute` and `userRoute` have a `loader`, they are executed **in parallel**, and you can access data from any level of the hierarchy.

```typescript
// dashboard-layout.ts
const dashboardRoute = pipe(
  route(path('dashboard')),
  loader(async () => ({ stats: await fetchDashboardStats() })),
  layout(DashboardLayout) // Layout component with <Outlet />
);

// user-profile.ts
const userRoute = pipe(
  extend(dashboardRoute, path('users'), param('id', z.number())),
  loader(async ({ params }) => ({ user: await fetchUser(params.id) }))
);

// In your view for the user route, you can access both sets of data:
const dashboardData = router.currentMatch.data; // { stats: ... }
const userData = router.currentMatch.child.data; // { user: ... }
```

### Predictive Preloading

Improve perceived performance by loading a route's code and data *before* the user clicks a link. The `router.peek()` method is perfect for this.

```typescript
// Preload on hover to make navigation feel instantaneous
myLink.addEventListener('mouseenter', () => {
  router.peek(userRoute, { id: 123 });
});

// Navigate as usual on click
myLink.addEventListener('click', (e) => {
  e.preventDefault();
  router.navigate(userRoute, { id: 123 });
});
```

### View Transitions

Combi-Router automatically uses the browser's native [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) for smooth, app-like page transitions. To enable it, simply add a CSS `view-transition-name` to elements that should animate between pages.

```css
/* On a list page */
.product-thumbnail {
  view-transition-name: product-image-123;
}

/* On a detail page */
.product-hero-image {
  view-transition-name: product-image-123; /* Same name! */
}
```

The router handles the rest. No JavaScript changes are needed.

<br />

## 🧩 Vanilla JS Utilities

Combi-Router is framework-agnostic at its core. To help you integrate it into a vanilla JavaScript project, we provide a set of utility functions. These helpers bridge the gap between the router's state and the DOM, making it easy to create navigable links, render nested views, and react to route changes.

### Link & Navigation Helpers

#### `createLink(router, route, params, options)`

Creates a fully functional `<a>` element that navigates using the router. It automatically sets the `href` and intercepts click events to trigger client-side navigation. Each created link comes with a `destroy` function to clean up its event listeners.

```typescript
import { createLink } from '@doeixd/combi-router/utils';

const { element, destroy } = createLink(
  router,
  userRoute,
  { id: 123 },
  { children: 'View Profile', className: 'btn' }
);
document.body.appendChild(element);

// Later, when the element is removed from the DOM:
// destroy();
```

#### `createActiveLink(router, route, params, options)`

Builds on `createLink` to create an `<a>` element that automatically updates its CSS class when its route is active. This is perfect for navigation menus.

- `activeClassName`: The CSS class to apply when the link is active.
- `exact`: If `true`, the class is applied only on an exact route match. If `false` (default), it's also applied for any active child routes.

```typescript
import { createActiveLink } from '@doeixd/combi-router/utils';

const { element } = createActiveLink(router, dashboardRoute, {}, {
  children: 'Dashboard',
  className: 'nav-link',
  activeClassName: 'font-bold' // Applied on /dashboard, /dashboard/users, etc.
});
document.querySelector('nav').appendChild(element);
```

#### `attachNavigator(element, router, route, params)`

Makes any existing HTML element navigable. This is useful for turning buttons, divs, or other non-anchor elements into type-safe navigation triggers.

```typescript
import { attachNavigator } from '@doeixd/combi-router/utils';

const myButton = document.getElementById('home-button');
const { destroy } = attachNavigator(myButton, router, homeRoute, {});
```

### Conditional Rendering

#### `createOutlet(router, parentRoute, container, viewMap)`

Provides a declarative "outlet" for nested routing, similar to `<Outlet>` in React Router or `<router-view>` in Vue. It listens for route changes and renders the correct child view into a specified container element.

- `parentRoute`: The route of the component that *contains* the outlet.
- `container`: The DOM element where child views will be rendered.
- `viewMap`: An object mapping `Route.id` to an `ElementFactory` function `(match) => Node`.

```typescript
// In your dashboard layout component
import { createOutlet } from '@doeixd/combi-router/utils';
import { dashboardRoute, usersRoute, settingsRoute } from './routes';
import { UserListPage, SettingsPage } from './views';

const outletContainer = document.querySelector('#outlet');
createOutlet(router, dashboardRoute, outletContainer, {
  [usersRoute.id]: (match) => new UserListPage(match.data), // Pass data to the view
  [settingsRoute.id]: () => new SettingsPage(),
});
```

#### `createMatcher(router)`

Creates a fluent, type-safe conditional tool that reacts to route changes. It's a powerful way to implement declarative logic that isn't tied directly to rendering.

```typescript
import { createMatcher } from '@doeixd/combi-router/utils';

// Update the document title based on the active route
createMatcher(router)
  .when(homeRoute, () => {
    document.title = 'My App | Home';
  })
  .when(userRoute, (match) => {
    document.title = `Profile for User ${match.params.id}`;
  })
  .otherwise(() => {
    document.title = 'My App';
  });
```

### State Management

#### `createRouterStore(router)`

Creates a minimal, framework-agnostic reactive store for the router's state (`currentMatch`, `isNavigating`, `isFetching`). This is useful for integrating with UI libraries or building your own reactive logic in vanilla JS.

```typescript
import { createRouterStore } from '@doeixd/combi-router/utils';

const store = createRouterStore(router);

const unsubscribe = store.subscribe(() => {
  const { isNavigating } = store.getSnapshot();
  // Show a global loading indicator while navigating
  document.body.style.cursor = isNavigating ? 'wait' : 'default';
});

// To clean up:
// unsubscribe();
```

<br />

## 🎨 Web Components

For even simpler integration, Combi-Router provides ready-to-use Web Components that handle routing declaratively in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        // Import standalone components (no setup required!)
        import '@doeixd/combi-router/components-standalone';
    </script>
</head>
<body>
    <!-- Define your routes declaratively -->
    <view-area match="/users/:id" view-id="user-detail"></view-area>
    <view-area match="/about" view-id="about-page"></view-area>

    <!-- Define your templates -->
    <template is="view-template" view-id="user-detail">
        <h1>User Details</h1>
        <p>User ID: <span class="user-id"></span></p>
    </template>

    <template is="view-template" view-id="about-page">
        <h1>About</h1>
        <p>This is the about page.</p>
    </template>

    <!-- Navigation works automatically -->
    <nav>
        <a href="/users/123">User 123</a>
        <a href="/about">About</a>
    </nav>
</body>
</html>
```

### Key Benefits

- **Zero JavaScript Configuration**: Just import and use
- **Declarative Routing**: Define routes in HTML attributes
- **Automatic Navigation**: Links work out of the box
- **Progressive Enhancement**: Works with or without JavaScript
- **Dynamic Route Management**: Add/remove routes programmatically when needed

[Learn more →](docs/COMPONENTS.md)

<br />

## ⚙️ Configuration & API

### Router Creation

```typescript
const router = createRouter(
  [homeRoute, usersRoute, userRoute], // An array of all routes
  {
    baseURL: 'https://myapp.com', // For running in a subdirectory
    hashMode: false, // Use `/#/path` style URLs
  }
);
```

### Error Handling

```typescript
// Define a fallback route for any URL that doesn't match
router.fallback(notFoundRoute);

// Define a global error handler for failures during navigation
router.onError(({ error, to, from }) => {
  console.error('Navigation error:', error);
  // Send to an error tracking service
});
```

### API Reference

#### Core Functions

- `route(...matchers)`: Creates a new base route.
- `extend(baseRoute, ...matchers)`: Creates a new child route from a base.
- `createRouter(routes, options?)`: Creates the router instance.
- `createResource(promiseFn)`: Wraps an async function in a suspense-ready resource.
- `createAdvancedResource(promiseFn, config?)`: Creates an enhanced resource with retry, caching, and state management.
- `typedGuard<TParams>(guardFn)`: Creates a type-safe guard function with enhanced context.

#### Route Matchers

- `path(segment)`: Matches a static path segment.
- `path.optional(segment)`: Matches an optional path segment.
- `path.wildcard(name?)`: Matches all remaining path segments into an array.
- `param(name, schema)`: Matches a dynamic parameter with Zod validation.
- `query(name, schema)`: Declares a required query parameter with Zod validation.
- `query.optional(name, schema)`: Declares an optional query parameter.
- `end`: Ensures the path has no remaining segments.

#### Higher-Order Enhancers

- `pipe(route, ...enhancers)`: Applies a series of enhancers to a route.
- `meta(metadata)`: Attaches arbitrary metadata to a route.
- `loader(loaderFn)`: Adds a data-loading function to a route.
- `layout(component)`: Associates a layout component with a route.
- `guard(...guardFns)`: Protects a route with one or more guard functions.
- `cache(options)`: Adds caching behavior to a route's loader.
- `lazy(importFn)`: Makes a route's component lazy-loaded.

#### Router Methods

- `navigate(route, params)`: Programmatically navigates to a route, returns `Promise<NavigationResult>`.
- `navigateSimple(route, params)`: Simple navigation that returns `Promise<boolean>` for backward compatibility.
- `build(route, params)`: Generates a URL string for a route.
- `match(url)`: Matches a URL and returns the corresponding `RouteMatch` tree.
- `peek(route, params)`: Proactively loads a route's code and data.
- `subscribe(listener)`: Subscribes to route changes.
- `addRoute(route)`: Dynamically adds a route to the router.
- `removeRoute(route)`: Dynamically removes a route from the router.
- `cancelNavigation()`: Cancels the current navigation if one is in progress.

#### Router Properties

- `currentMatch`: The currently active `RouteMatch` object tree, or `null`.
- `currentNavigation`: The active `NavigationController` if a navigation is in progress, or `null`.
- `isNavigating`: A boolean indicating if a navigation is in progress.
- `isFetching`: A boolean indicating if any route loaders are active.
- `routes`: A flat array of all registered route objects.

#### Route Properties (Introspection)

- `route.depth`: The depth of the route in the hierarchy (0 for root routes).
- `route.ancestors`: Array of all ancestor routes from root to parent.
- `route.staticPath`: The static path parts (non-parameter segments).
- `route.paramNames`: Array of all parameter names defined by the route.
- `route.isDynamic`: Boolean indicating if the route has dynamic parameters.
- `route.hasQuery`: Boolean indicating if the route has query parameters.
- `route.routeChain`: Array of routes from root to this route (including this route).
- `route.parent`: The parent route, or `null` for root routes.

#### Error Types

- `RouteValidationError`: Thrown when route validation fails during creation.
- `NavigationErrorType`: Enum of possible navigation error types (`RouteNotFound`, `GuardRejected`, `LoaderFailed`, `ValidationFailed`, `Cancelled`, `Unknown`).
- `NavigationError`: Interface describing detailed navigation error information.
- `NavigationResult`: Interface describing the result of a navigation attempt.
- `NavigationController`: Interface for managing ongoing navigation.
- `GuardContext<TParams>`: Context object passed to typed guard functions.
- `TypedRouteGuard<TParams>`: Type for typed guard functions.

<br />

## 🎁 Benefits of Reference-Based Approach

- **Perfect Type Safety**: Impossible to make typos in route names or pass incorrect parameter types.
- **Better IDE Support**: Get autocompletion for routes and `go-to-definition` that works.
- **Confident Refactoring**: Rename a route or change its parameters, and TypeScript will instantly show you everywhere that needs to be updated.
- **Functional Composition**: Routes are first-class values that can be imported, exported, and composed with pure functions.
- **Framework Agnostic**: The core logic is pure TypeScript, allowing for simple integration with any framework or vanilla JS.
- **Tree-Shakable**: Import only the features you need for optimal bundle size.
- **Production Ready**: Built-in performance optimizations, error handling, and monitoring.

<br />

## 📈 Performance

Combi-Router is designed for performance with several optimization strategies:

### Bundle Size
- **Core**: ~12KB gzipped (essential routing functionality)
- **+Data**: ~4KB gzipped (advanced resources and caching)
- **+Features**: ~6KB gzipped (performance optimizations)
- **+Utils**: ~3KB gzipped (DOM utilities)
- **Dev Tools**: ~3KB gzipped (excluded in production builds)

### Runtime Performance
- **Tree-shaking optimized**: Only bundle what you use
- **Lazy route loading**: Code splitting at the route level
- **Intelligent prefetching**: Connection-aware prefetching strategies
- **Memory management**: Automatic cleanup of unused cache entries
- **Performance monitoring**: Built-in Web Vitals tracking

### Best Practices
1. Use modular imports to minimize bundle size
2. Enable connection-aware prefetching for mobile users
3. Configure cache TTL based on data volatility
4. Use scroll restoration for better UX
5. Enable performance monitoring in development

<br />

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

<br />

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

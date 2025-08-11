# Combi-Router Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Core Design Principles](#core-design-principles)
4. [Layered Architecture](#layered-architecture)
5. [Core Components](#core-components)
6. [Available Layers](#available-layers)
7. [API Reference](#api-reference)
8. [Usage Examples](#usage-examples)
9. [Development Features](#development-features)
10. [Build System](#build-system)
11. [Testing Strategy](#testing-strategy)
12. [Performance Considerations](#performance-considerations)
13. [Best Practices](#best-practices)
14. [Migration Guide](#migration-guide)

## Overview

Combi-Router is a modern, composable, type-safe router built with functional programming principles. It provides a layered architecture that allows developers to compose exactly the features they need while maintaining excellent type safety and performance.

### Key Features
- **Layered Architecture**: Compose router functionality through layers
- **Type Safety**: Full TypeScript support with intelligent type inference
- **Framework Agnostic**: Works with any JavaScript framework
- **Performance Optimized**: Intelligent prefetching, caching, and memory management
- **Developer Experience**: Comprehensive dev tools and debugging capabilities
- **Web Components**: Standalone components that work without the router
- **Modern Features**: View Transitions API, scroll restoration, data management

## Architecture Philosophy

### Functional Composition
The router is built on the principle of functional composition, where each layer adds specific capabilities to the router. This allows for:
- **Modularity**: Each layer is independent and focused on a single concern
- **Flexibility**: Mix and match layers based on your needs
- **Maintainability**: Clear separation of concerns
- **Testability**: Each layer can be tested in isolation

### Type-First Design
Type safety is not an afterthought but a core design principle:
- **Inference**: Types flow through the system automatically
- **Validation**: Compile-time checking of route parameters
- **Documentation**: Types serve as living documentation
- **Refactoring**: Safe refactoring with TypeScript's help

## Core Design Principles

### 1. **Separation of Concerns**
Each layer handles a specific aspect of routing:
- Core navigation
- View rendering
- Data management
- Performance optimization
- Development tools

### 2. **Progressive Enhancement**
Start with basic routing and add features as needed:
```typescript
// Minimal setup
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  ();

// Full-featured setup
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createViewLayer({ root: '#app' }))
  (createDataLayer())
  (createPerformanceLayer())
  (createDevLayer())
  ();
```

### 3. **Immutability**
Routes and configuration are immutable, ensuring predictable behavior and enabling optimizations.

### 4. **Lazy Loading**
Support for code-splitting and lazy loading built into the core:
```typescript
const route = lazy(() => import('./routes/admin'));
```

## Layered Architecture

### Layer Composition Model
```
┌─────────────────────────────────────┐
│         Application Code            │
├─────────────────────────────────────┤
│         Dev Tools Layer             │ (Development only)
├─────────────────────────────────────┤
│      Performance Layer              │ (Optional)
├─────────────────────────────────────┤
│      Transitions Layer              │ (Optional)
├─────────────────────────────────────┤
│    Scroll Restoration Layer         │ (Optional)
├─────────────────────────────────────┤
│         Data Layer                  │ (Optional)
├─────────────────────────────────────┤
│         View Layer                  │ (Optional)
├─────────────────────────────────────┤
│    Core Navigation Layer            │ (Required)
├─────────────────────────────────────┤
│      Route Definitions              │
└─────────────────────────────────────┘
```

### Layer Interface
Each layer follows a consistent interface:
```typescript
type RouterLayer<TRouter, TExtensions> = 
  (router: TRouter) => TRouter & TExtensions;
```

## Core Components

### 1. **Route Builder**
Fluent API for building routes with type safety:
```typescript
const userRoute = route()
  .path('/users')
  .param('id', z.string().uuid())
  .loader(async ({ params }) => fetchUser(params.id))
  .view(({ match }) => `<h1>User ${match.data.name}</h1>`)
  .build();
```

### 2. **Route Matcher**
High-performance route matching with support for:
- Static paths
- Dynamic parameters
- Query parameters
- Wildcards
- Optional segments

### 3. **Navigation Manager**
Handles all navigation operations:
- Programmatic navigation
- Link interception
- History management
- Navigation guards

### 4. **State Management**
Reactive state management for:
- Current route
- Navigation state
- Loading state
- Error handling

## Available Layers

### Core Navigation Layer
**Purpose**: Provides fundamental routing capabilities
```typescript
createCoreNavigationLayer({
  errorStrategy: 'graceful',
  baseUrl: '/app',
  trailingSlash: 'remove'
})
```

**Features**:
- Route matching
- Navigation methods
- History management
- Error strategies

### View Layer
**Purpose**: Renders views based on route matches
```typescript
createViewLayer({
  root: '#app',
  transition: 'fade',
  loadingView: () => '<div>Loading...</div>',
  errorView: (error) => `<div>Error: ${error.message}</div>`,
  notFoundView: () => '<div>404 Not Found</div>'
})
```

**Features**:
- DOM rendering
- View transitions
- Loading states
- Error boundaries

### Enhanced View Layer
**Purpose**: Advanced view rendering with template support
```typescript
createEnhancedViewLayer({
  root: '#app',
  useMorphdom: true,
  templateRenderer: customRenderer,
  outletAttribute: 'router-outlet'
})
```

**Features**:
- Morphdom integration
- Template engine support
- Nested routing outlets
- Head management

### Data Layer
**Purpose**: Manages route data and resources
```typescript
createDataLayer({
  defaultCacheTTL: 5 * 60 * 1000,
  parallelLoading: true,
  retryStrategy: {
    maxAttempts: 3,
    backoff: 'exponential'
  }
})
```

**Features**:
- Resource management
- Suspense support
- Caching strategies
- Parallel data loading

### Performance Layer
**Purpose**: Optimizes navigation performance
```typescript
createPerformanceLayer({
  prefetchOnHover: true,
  prefetchViewport: true,
  connectionAware: true,
  memoryManagement: {
    enabled: true,
    maxCacheSize: 50,
    maxCacheAge: 10 * 60 * 1000
  }
})
```

**Features**:
- Intelligent prefetching
- Memory management
- Performance monitoring
- Connection awareness

### Transitions Layer
**Purpose**: Provides smooth page transitions
```typescript
createTransitionsLayer({
  type: 'view-transitions',
  duration: 300,
  easing: 'ease-in-out',
  respectPreferences: true
})
```

**Features**:
- View Transitions API
- Custom animations
- Motion preferences
- Transition queuing

### Scroll Restoration Layer
**Purpose**: Manages scroll position across navigations
```typescript
createScrollRestorationLayer({
  strategy: 'auto',
  smoothScrollBehavior: 'smooth',
  restoreOnBack: true,
  saveDelay: 100
})
```

**Features**:
- Automatic scroll saving
- Smooth scrolling
- Back button restoration
- Custom scroll positions

### Development Layer
**Purpose**: Provides debugging and development tools
```typescript
createDevLayer({
  enableWarnings: true,
  enableConflictDetection: true,
  enablePerformanceMonitoring: true,
  verboseLogging: true
})
```

**Features**:
- Route analysis
- Conflict detection
- Performance monitoring
- Visual debugging

## API Reference

### Router Creation
```typescript
// Layered Router (Recommended)
const router = createLayeredRouter(routes)
  (layer1)
  (layer2)
  ();

// Legacy CombiRouter (Backwards compatibility)
const router = createRouter({
  routes,
  errorStrategy: 'graceful'
});
```

### Route Building
```typescript
// Basic route
const homeRoute = route()
  .path('/')
  .view(() => '<h1>Home</h1>')
  .build();

// Advanced route
const userRoute = route()
  .path('/users')
  .param('id', z.string())
  .guard(authGuard)
  .loader(async ({ params }) => fetchUser(params.id))
  .view(({ match }) => renderUser(match.data))
  .meta({ title: 'User Profile' })
  .build();

// Nested routes
const adminRoute = route()
  .path('/admin')
  .children([
    route().path('/users').view(UsersView),
    route().path('/settings').view(SettingsView)
  ])
  .build();
```

### Navigation Methods
```typescript
// Programmatic navigation
await router.navigate('/users/123');
await router.navigate('/search', { query: { q: 'test' } });

// Navigation with options
await router.navigate('/users', {
  replace: true,
  state: { from: 'dashboard' }
});

// Route building
const url = router.build(userRoute, { id: '123' });

// Back/Forward
router.back();
router.forward();
```

### Lifecycle Hooks
```typescript
// Navigation lifecycle
router.beforeNavigate((context) => {
  console.log('Navigating from', context.from, 'to', context.to);
  // Return false to cancel navigation
  return true;
});

router.afterNavigate((match) => {
  console.log('Navigated to', match.pathname);
});

// Error handling
router.onError((error) => {
  console.error('Navigation error:', error);
});
```

### Resource Management
```typescript
// Create a resource
const userResource = createResource(
  () => fetchUser(id),
  { cache: true, ttl: 5 * 60 * 1000 }
);

// Use in component
const user = userResource.read(); // Throws promise if loading
```

## Usage Examples

### Basic Setup
```typescript
import { createLayeredRouter, createCoreNavigationLayer, createViewLayer } from '@doeixd/combi-router';
import { z } from 'zod';

// Define routes
const routes = [
  route()
    .path('/')
    .view(() => '<h1>Welcome</h1>')
    .build(),
    
  route()
    .path('/about')
    .view(() => '<h1>About Us</h1>')
    .build(),
    
  route()
    .path('/users')
    .param('id', z.string())
    .loader(async ({ params }) => fetchUser(params.id))
    .view(({ match }) => `<h1>${match.data.name}</h1>`)
    .build()
];

// Create router
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createViewLayer({ root: '#app' }))
  ();

// Start routing
router.start();
```

### Advanced Setup with All Features
```typescript
const router = createLayeredRouter(routes)
  // Core navigation
  (createCoreNavigationLayer({
    errorStrategy: 'selective',
    selectiveStrategyOptions: {
      throwNotFound: false,
      throwLoaderError: true
    }
  }))
  
  // View rendering with morphdom
  (createEnhancedViewLayer({
    root: '#app',
    useMorphdom: true,
    loadingView: LoadingComponent,
    errorView: ErrorComponent,
    notFoundView: NotFoundComponent
  }))
  
  // Data management
  (createDataLayer({
    defaultCacheTTL: 5 * 60 * 1000,
    parallelLoading: true
  }))
  
  // Performance optimizations
  (createPerformanceLayer({
    prefetchOnHover: true,
    prefetchViewport: true,
    connectionAware: true,
    preloadCriticalRoutes: ['/', '/dashboard']
  }))
  
  // Smooth transitions
  (createTransitionsLayer({
    type: 'view-transitions',
    duration: 250
  }))
  
  // Scroll restoration
  (createScrollRestorationLayer({
    strategy: 'auto',
    restoreOnBack: true
  }))
  
  // Development tools (stripped in production)
  (process.env.NODE_ENV !== 'production' ? createDevLayer() : (r) => r)
  ();
```

### Using Standalone Web Components
```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@doeixd/combi-router/components-standalone';
  </script>
</head>
<body>
  <!-- Navigation links -->
  <router-link href="/home">Home</router-link>
  <router-link href="/about" prefetch>About</router-link>
  
  <!-- View rendering -->
  <router-view id="main-view"></router-view>
  
  <!-- Loading states -->
  <view-suspense delay="200" timeout="10000">
    <div slot="loading">Loading...</div>
    <div slot="error">Failed to load</div>
    <div slot="content">
      <!-- Dynamic content here -->
    </div>
  </view-suspense>
</body>
</html>
```

### Framework Integration

#### React Integration
```typescript
import { useRouter, RouterProvider } from '@doeixd/combi-router/react';

function App() {
  return (
    <RouterProvider router={router}>
      <Navigation />
      <RouterView />
    </RouterProvider>
  );
}

function Navigation() {
  const { navigate, currentMatch } = useRouter();
  
  return (
    <nav>
      <a onClick={() => navigate('/')}>Home</a>
      <a onClick={() => navigate('/about')}>About</a>
    </nav>
  );
}
```

#### Vue Integration
```vue
<template>
  <div>
    <router-link to="/">Home</router-link>
    <router-link to="/about">About</router-link>
    <router-view />
  </div>
</template>

<script setup>
import { createRouterPlugin } from '@doeixd/combi-router/vue';

const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createViewLayer())
  ();

app.use(createRouterPlugin(router));
</script>
```

## Development Features

### Route Analysis
```typescript
// Enable dev mode
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createDevLayer())
  ();

// Access dev tools
const analysis = router.dev.analyzeRoutes();
console.log(analysis);
// Output: Detailed route complexity analysis

const conflicts = router.dev.detectConflicts();
console.log(conflicts);
// Output: List of conflicting routes

const report = router.dev.generateReport();
console.log(report);
// Output: Comprehensive development report
```

### Performance Monitoring
```typescript
// Monitor navigation performance
router.dev.performance.startMonitoring();

// Get metrics
const metrics = router.dev.performance.getMetrics();
console.log(metrics);
// Output: { averageLoadTime: 145, slowestRoute: '/users', ... }

// Get insights
const insights = router.dev.performance.getInsights();
console.log(insights);
// Output: Performance recommendations
```

### Visual Debugging
```typescript
// Generate route tree visualization
const tree = router.dev.visualizeRouteTree();
console.log(tree);
/*
Output:
/
├── home
├── about
└── users
    ├── :id
    └── :id/settings
*/

// Enable browser dev tools
router.dev.enableBrowserDevTools();
// Access via: window.combiRouterDev
```

## Build System

### Build Configuration
The project uses Pridepack for building:

```json
{
  "exports": {
    ".": {
      "development": {
        "require": "./dist/cjs/development/index.js",
        "import": "./dist/esm/development/index.js"
      },
      "require": "./dist/cjs/production/index.js",
      "import": "./dist/esm/production/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./components-standalone": {
      "development": {
        "require": "./dist/cjs/development/2.js",
        "import": "./dist/esm/development/2.js"
      },
      "require": "./dist/cjs/production/2.js",
      "import": "./dist/esm/production/2.js"
    }
  }
}
```

### Build Outputs
- **ESM**: Modern ES modules for tree-shaking
- **CommonJS**: For Node.js compatibility
- **TypeScript Declarations**: Full type definitions
- **Development/Production**: Optimized builds for each environment

### Bundle Sizes
- **Core**: ~15KB minified + gzipped
- **With All Layers**: ~45KB minified + gzipped
- **Standalone Components**: ~8KB minified + gzipped

## Testing Strategy

### Test Structure
```
test/
├── core.test.ts         # Core routing tests
├── layers.test.ts       # Layer composition tests
├── data.test.ts         # Data management tests
├── view-layer.test.ts   # View rendering tests
├── performance.test.ts  # Performance layer tests
├── dev.test.ts          # Development tools tests
└── integration/         # Integration tests
```

### Test Coverage
- **Unit Tests**: Each layer tested in isolation
- **Integration Tests**: Layer composition and interaction
- **E2E Tests**: Full router functionality
- **Performance Tests**: Benchmarking and optimization validation

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test core.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Performance Considerations

### Route Matching
- **O(n) complexity**: Linear search through routes
- **Early termination**: Stops on first match
- **Static route optimization**: Static routes checked first
- **Compiled patterns**: Regex patterns pre-compiled

### Memory Management
- **Automatic cleanup**: Unused resources freed
- **Cache limits**: Configurable cache sizes
- **Weak references**: For component instances
- **Memory monitoring**: Built-in memory tracking

### Bundle Size Optimization
- **Tree shaking**: Unused layers eliminated
- **Code splitting**: Lazy load routes and components
- **Production builds**: Stripped of dev code
- **Modular imports**: Import only what you need

### Runtime Performance
- **Prefetching**: Intelligent route prefetching
- **Caching**: Multi-level caching strategy
- **Batch updates**: DOM updates batched
- **Web Workers**: Heavy computation offloaded

## Best Practices

### 1. **Layer Order Matters**
```typescript
// ✅ Correct order
createLayeredRouter(routes)
  (createCoreNavigationLayer())  // First
  (createViewLayer())            // Depends on core
  (createDataLayer())           // Can depend on view
  (createPerformanceLayer())    // Enhances all layers
  ();

// ❌ Incorrect order
createLayeredRouter(routes)
  (createPerformanceLayer())  // Has nothing to enhance yet
  (createCoreNavigationLayer())
  ();
```

### 2. **Type-Safe Parameters**
```typescript
// ✅ Use schema validation
route()
  .param('id', z.string().uuid())
  .param('page', z.number().min(1))

// ❌ Avoid any types
route()
  .param('id', z.any())
```

### 3. **Error Handling**
```typescript
// ✅ Comprehensive error handling
createCoreNavigationLayer({
  errorStrategy: 'selective',
  selectiveStrategyOptions: {
    throwNotFound: false,      // Show 404 page
    throwLoaderError: true,    // Bubble up data errors
    throwGuardRejection: true  // Security errors should throw
  }
})

// ❌ Ignoring errors
createCoreNavigationLayer({
  errorStrategy: 'silent'  // Never use in production
})
```

### 4. **Performance Optimization**
```typescript
// ✅ Optimize for production
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createViewLayer())
  (createPerformanceLayer({
    prefetchOnHover: true,
    connectionAware: true,
    memoryManagement: {
      enabled: true,
      maxCacheSize: 30
    }
  }))
  ();

// ❌ No optimization
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  ();
```

### 5. **Development vs Production**
```typescript
// ✅ Conditional dev tools
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createViewLayer())
  (process.env.NODE_ENV !== 'production' 
    ? createDevLayer({ verboseLogging: true })
    : (r) => r)
  ();

// ❌ Dev tools in production
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createDevLayer({ verboseLogging: true }))  // Always included
  ();
```

## Migration Guide

### From React Router
```typescript
// React Router
<Route path="/users/:id" component={UserComponent} />

// Combi-Router
route()
  .path('/users')
  .param('id', z.string())
  .view(UserComponent)
  .build()
```

### From Vue Router
```typescript
// Vue Router
{
  path: '/users/:id',
  component: UserComponent,
  beforeEnter: authGuard
}

// Combi-Router
route()
  .path('/users')
  .param('id', z.string())
  .guard(authGuard)
  .view(UserComponent)
  .build()
```

### From Express/Server Routers
```typescript
// Express
app.get('/users/:id', authMiddleware, async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.render('user', { user });
});

// Combi-Router
route()
  .path('/users')
  .param('id', z.string())
  .guard(authGuard)
  .loader(async ({ params }) => fetchUser(params.id))
  .view(({ match }) => renderUser(match.data))
  .build()
```

## Troubleshooting

### Common Issues

#### Routes Not Matching
```typescript
// Check route order - specific routes before generic
const routes = [
  route().path('/users/me').build(),     // Specific first
  route().path('/users/:id').build(),    // Generic after
];
```

#### TypeScript Errors
```typescript
// Ensure proper type imports
import type { Route, RouteMatch } from '@doeixd/combi-router';

// Use type assertions when needed
const match = router.currentMatch as RouteMatch<{ id: string }>;
```

#### Performance Issues
```typescript
// Enable performance monitoring
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createPerformanceLayer({ enablePerformanceMonitoring: true }))
  (createDevLayer())
  ();

// Check the report
console.log(router.dev.performance.getReport());
```

#### Memory Leaks
```typescript
// Ensure proper cleanup
const router = createLayeredRouter(routes)
  (createCoreNavigationLayer())
  (createPerformanceLayer({
    memoryManagement: {
      enabled: true,
      maxCacheSize: 30,
      cleanupInterval: 60000
    }
  }))
  ();

// Manual cleanup when needed
router.performance.performMemoryCleanup();
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to the project.

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

## Summary

Combi-Router represents a modern approach to routing that prioritizes:
- **Composability**: Build exactly what you need
- **Type Safety**: Catch errors at compile time
- **Performance**: Optimized for real-world applications
- **Developer Experience**: Comprehensive tooling and debugging
- **Flexibility**: Works with any framework or vanilla JS

The layered architecture ensures that you only pay for what you use, while the functional composition model makes the router highly extensible and maintainable.

For more examples and updates, visit the [GitHub repository](https://github.com/doeixd/combi-router).
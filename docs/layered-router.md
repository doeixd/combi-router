# Layered Router Architecture

The Combi-Router's layered architecture provides unprecedented composability and flexibility through a system of independent, reusable layers that can be composed together to create custom router configurations.

## Table of Contents

- [Overview](#overview)
- [Creating Layered Routers](#creating-layered-routers)
- [Built-in Layers](#built-in-layers)
  - [Data Layer](#data-layer)
  - [Development Layer](#development-layer)
  - [Performance Layer](#performance-layer)
  - [Scroll Restoration Layer](#scroll-restoration-layer)
  - [Transitions Layer](#transitions-layer)
  - [Head Management Layer](#head-management-layer)
- [Creating Custom Layers](#creating-custom-layers)
- [Backwards Compatibility](#backwards-compatibility)
- [Best Practices](#best-practices)

## Overview

The layered architecture is built on the `makeLayered` pattern, which allows you to compose functionality by applying layers to a base router. Each layer can:

- Add new methods and properties to the router
- Access and modify the router's context
- Call methods from previously applied layers
- Provide conditional functionality (e.g., dev-only features)

```typescript
import { createLayeredRouter, dataLayer, devLayer } from '@doeixd/combi-router';

const router = createLayeredRouter(routes)
  (dataLayer())     // Adds data management capabilities
  (devLayer())      // Adds development tools
  ();               // Finalizes the router
```

## Creating Layered Routers

### Basic Usage

```typescript
import { createLayeredRouter } from '@doeixd/combi-router';

// Create a basic router builder
const routerBuilder = createLayeredRouter(routes, {
  baseURL: '/app',
  hashMode: false
});

// Apply layers and finalize
const router = routerBuilder
  (dataLayer())
  (devLayer())
  ();
```

### Layer Composition

Layers are applied in order, and each layer can access methods added by previous layers:

```typescript
const router = createLayeredRouter(routes)
  (dataLayer())           // Layer 1: Data management
  (withPerformance())     // Layer 2: Can use data layer methods
  (devLayer())           // Layer 3: Can use both previous layers
  ();
```

### Conditional Layers

Use conditional logic to apply layers based on environment or configuration:

```typescript
const router = createLayeredRouter(routes)
  (dataLayer())
  (conditionalLayer(
    process.env.NODE_ENV !== 'production',
    devLayer()
  ))
  (conditionalLayer(
    config.enablePerformanceOptimizations,
    withPerformance()
  ))
  ();
```

## Built-in Layers

### Data Layer

The data layer provides advanced data management, caching, and resource handling capabilities.

#### Installation and Usage

```typescript
import { dataLayer, quickDataLayer } from '@doeixd/combi-router';

// Basic data layer
const router = createLayeredRouter(routes)
  (dataLayer())
  ();

// Quick setup with optimized defaults
const router = createLayeredRouter(routes)
  (quickDataLayer())
  ();

// Custom configuration
const router = createLayeredRouter(routes)
  (dataLayer({
    cache: {
      maxSize: 2000,
      defaultTTL: 600000
    },
    autoCleanup: true,
    cleanupInterval: 180000,
    logResourceEvents: true
  }))
  ();
```

#### Features

**Advanced Caching**
```typescript
// Set data with tags and priority
router.cache.set('user:123', userData, {
  ttl: 300000,
  invalidateOn: ['user', 'profile'],
  priority: 'high'
});

// Get cache statistics
const stats = router.getCacheStats();
console.log(`Hit ratio: ${(stats.hitRatio * 100).toFixed(1)}%`);

// Clear cache or invalidate by tags
router.clearCache();
router.invalidateByTags(['user', 'session']);
```

**Resource Management**
```typescript
// Basic resource for suspense
const userResource = router.createResource(() => 
  fetch(`/api/users/${params.id}`).then(r => r.json())
);

// Use in components (suspends if not loaded)
const userData = userResource.read();

// Advanced resource with retry and caching
const advancedResource = router.createAdvancedResource(
  () => api.fetchUser(userId),
  {
    retry: { 
      attempts: 3,
      delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000)
    },
    cache: { 
      ttl: 300000,
      invalidateOn: ['user']
    },
    staleTime: 60000,
    backgroundRefetch: true
  }
);

// Check loading state without suspending
if (advancedResource.isLoading) {
  console.log('Loading...');
}

// Get cached data
const cachedData = advancedResource.peek();

// Force refresh
await advancedResource.refetch();
```

**Global State Monitoring**
```typescript
// Monitor global resource state
const globalState = router.getGlobalResourceState();
if (globalState.isLoading) {
  showGlobalSpinner();
}

// Listen to resource events
const unsubscribe = router.onResourceEvent((event) => {
  switch (event.type) {
    case 'fetch-start':
      console.log('Resource loading started');
      break;
    case 'fetch-success':
      console.log('Resource loaded successfully');
      break;
    case 'fetch-error':
      console.error('Resource failed to load', event.error);
      break;
  }
});
```

**Route Preloading**
```typescript
// Preload specific routes
await router.preloadRoute('user-dashboard', { id: userId });

// Preload on hover
element.addEventListener('mouseenter', () => {
  router.preloadRoute('user-profile', { id: userId });
});
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache.maxSize` | `number` | `1000` | Maximum cache entries before eviction |
| `cache.defaultTTL` | `number` | `300000` | Default TTL in milliseconds (5 min) |
| `autoCleanup` | `boolean` | `false` | Enable automatic cleanup of expired entries |
| `cleanupInterval` | `number` | `300000` | Cleanup interval in milliseconds |
| `logResourceEvents` | `boolean` | `false` | Log resource lifecycle events |

### Development Layer

The development layer provides comprehensive debugging tools, performance monitoring, and development utilities.

#### Installation and Usage

```typescript
import { devLayer, quickDevLayer } from '@doeixd/combi-router';

// Basic dev layer (no-op in production)
const router = createLayeredRouter(routes)
  (devLayer())
  ();

// Quick setup with all features
const router = createLayeredRouter(routes)
  (quickDevLayer())
  ();

// Custom configuration
const router = createLayeredRouter(routes)
  (devLayer({
    exposeToWindow: true,
    autoAnalyze: true,
    warnings: true,
    conflictDetection: true,
    performanceMonitoring: true,
    routeValidation: true,
    debugMode: true
  }))
  ();
```

#### Features

**Route Analysis and Validation**
```typescript
// Run comprehensive analysis
router.runDevAnalysis();

// Get detailed report
const report = router.getDevReport();
console.log(`Performance score: ${report.performance?.score}/100`);
console.log(`Found ${report.warnings.length} warnings`);
console.log(`Detected ${report.conflicts.conflicts.length} conflicts`);

// Log formatted report to console
router.logDevReport();
```

**Development Reporting**
```typescript
// Export debug data for sharing
const debugData = router.exportDevData();
await fetch('/api/debug-report', {
  method: 'POST',
  body: debugData
});

// Clear development history
router.clearDevData();

// Update configuration at runtime
router.updateDevConfig({
  performanceMonitoring: false,
  warnings: { runtimeWarnings: false }
});
```

**Browser Integration**
```typescript
// Access via window (if exposeToWindow: true)
window.combiRouterDev?.analyze();
window.combiRouterDev?.report();
window.combiRouterDev?.export();
window.combiRouterDev?.clear();
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `exposeToWindow` | `boolean` | `false` | Expose dev tools to `window.combiRouterDev` |
| `autoAnalyze` | `boolean` | `true` | Run analysis on router creation |
| `logPerformance` | `boolean` | `false` | Log performance metrics to console |
| `warnings` | `boolean\|object` | `true` | Enable warning system |
| `conflictDetection` | `boolean` | `true` | Enable route conflict detection |
| `performanceMonitoring` | `boolean\|object` | `true` | Enable performance monitoring |
| `routeValidation` | `boolean` | `true` | Enable route validation |
| `debugMode` | `boolean` | `true` | Enable enhanced debugging features |

#### Production Safety

The development layer automatically becomes a no-op in production builds:

```typescript
// In production (NODE_ENV === 'production'):
router.devMode === null;              // No dev mode instance
router.runDevAnalysis();              // No-op function
router.getDevReport();               // Returns { error: 'disabled' }
window.combiRouterDev === undefined; // Not exposed
```

### Performance Layer

Provides intelligent prefetching, viewport-aware loading, and memory management.

```typescript
import { withPerformance } from '@doeixd/combi-router';

const router = createLayeredRouter(routes)
  (withPerformance({
    prefetchOnHover: true,
    prefetchViewport: true,
    navigationTimeout: 5000,
    connectionAware: true,
    preloadCriticalRoutes: ['dashboard', 'profile']
  }))
  ();
```

### Scroll Restoration Layer

Configurable scroll position management with state preservation.

```typescript
import { withScrollRestoration } from '@doeixd/combi-router';

const router = createLayeredRouter(routes)
  (withScrollRestoration({
    enabled: true,
    strategy: 'smooth',
    restoreOnBack: true,
    saveDelay: 100,
    maxPositions: 50
  }))
  ();
```

### Transitions Layer

Sophisticated page transitions with proper lifecycle management.

```typescript
import { transitionsLayer } from '@doeixd/combi-router';

const router = createLayeredRouter(routes)
  (transitionsLayer({
    enabled: true,
    type: 'view-transitions',
    duration: 300,
    easing: 'ease-in-out',
    respectPreferences: true
  }))
  ();
```

### Head Management Layer

Dynamic document head management for SEO and social sharing.

```typescript
import { headManagementLayer } from '@doeixd/combi-router';

const router = createLayeredRouter(routes)
  (headManagementLayer({
    titleTemplate: '%s | My App',
    defaultTitle: 'My App',
    enableOpenGraph: true,
    enableTwitterCard: true,
    enableCanonical: true,
    baseUrl: 'https://example.com'
  }))
  ();
```

## Creating Custom Layers

### Basic Custom Layer

```typescript
import type { RouterLayer, ComposableRouter, RouterContext } from '@doeixd/combi-router';

interface MyLayerExtensions {
  myMethod: () => string;
  myProperty: number;
}

function myCustomLayer(): RouterLayer<RouterContext, MyLayerExtensions> {
  return (router: ComposableRouter<RouterContext>) => {
    return {
      myMethod: () => 'Hello from custom layer!',
      myProperty: 42
    };
  };
}

// Use the custom layer
const router = createLayeredRouter(routes)
  (myCustomLayer())
  ();

console.log(router.myMethod()); // "Hello from custom layer!"
console.log(router.myProperty); // 42
```

### Advanced Custom Layer

```typescript
interface AnalyticsLayerConfig {
  trackingId: string;
  enablePageViews: boolean;
  enableTiming: boolean;
}

interface AnalyticsLayerExtensions {
  trackEvent: (event: string, data?: any) => void;
  trackPageView: (path: string) => void;
  getAnalyticsData: () => any[];
}

function analyticsLayer(config: AnalyticsLayerConfig): RouterLayer<RouterContext, AnalyticsLayerExtensions> {
  return (router: ComposableRouter<RouterContext>) => {
    const events: any[] = [];
    
    // Initialize analytics
    if (typeof window !== 'undefined') {
      // Setup analytics SDK
    }
    
    // Track navigation events
    router.subscribe((match) => {
      if (match && config.enablePageViews) {
        trackPageView(match.pathname);
      }
    });
    
    const trackEvent = (event: string, data?: any) => {
      const eventData = {
        event,
        data,
        timestamp: Date.now(),
        route: router.currentMatch?.route.id
      };
      
      events.push(eventData);
      
      // Send to analytics service
      if (typeof window !== 'undefined') {
        // Send event
      }
    };
    
    const trackPageView = (path: string) => {
      trackEvent('page_view', { path });
    };
    
    const getAnalyticsData = () => [...events];
    
    return {
      trackEvent,
      trackPageView,
      getAnalyticsData
    };
  };
}

// Use the analytics layer
const router = createLayeredRouter(routes)
  (analyticsLayer({
    trackingId: 'UA-123456-7',
    enablePageViews: true,
    enableTiming: true
  }))
  ();

// Track custom events
router.trackEvent('button_click', { buttonId: 'signup' });
```

### Layer Communication

Layers can access methods from previously applied layers:

```typescript
function enhancedAnalyticsLayer(): RouterLayer<RouterContext, { enhancedTracking: () => void }> {
  return (router: ComposableRouter<RouterContext> & AnalyticsLayerExtensions) => {
    return {
      enhancedTracking: () => {
        // Access methods from analytics layer
        const data = router.getAnalyticsData();
        router.trackEvent('enhanced_tracking', { totalEvents: data.length });
      }
    };
  };
}

const router = createLayeredRouter(routes)
  (analyticsLayer({ trackingId: 'UA-123456-7' }))
  (enhancedAnalyticsLayer()) // Can access analytics layer methods
  ();
```

## Backwards Compatibility

The layered system is fully backwards compatible with the existing CombiRouter API:

### Automatic Layer Inclusion

```typescript
// Original API automatically includes:
const router = new CombiRouter(routes, options);

// Equivalent to:
const router = createLayeredRouter(routes, options)
  (createCoreNavigationLayer())
  (dataLayer())
  (conditionalLayer(
    process.env.NODE_ENV !== 'production',
    devLayer({ exposeToWindow: true, autoAnalyze: true })
  ))
  (performanceLayer(options.features?.performance || {}))
  (scrollRestorationLayer(options.features?.scrollRestoration || {}))
  // ... other configured layers
  ();
```

### Migration Path

You can gradually migrate to the layered architecture:

```typescript
// Step 1: Start with backwards compatible API
const router = new CombiRouter(routes, options);

// Step 2: Move to layered API with same functionality
const router = createLayeredRouter(routes, options)
  (createCoreNavigationLayer())
  (dataLayer())
  (devLayer())
  ();

// Step 3: Add custom layers and optimizations
const router = createLayeredRouter(routes, options)
  (dataLayer({ autoCleanup: true }))
  (devLayer({ exposeToWindow: true }))
  (analyticsLayer({ trackingId: 'UA-123456-7' }))
  (performanceLayer({ prefetchOnHover: true }))
  ();
```

## Best Practices

### Layer Ordering

1. **Data layers first**: Apply data management layers early so other layers can use them
2. **Core functionality**: Apply navigation and core layers before enhancement layers
3. **Development tools last**: Apply dev layers last so they can monitor all other layers

```typescript
// Recommended order
const router = createLayeredRouter(routes)
  (dataLayer())           // 1. Data management
  (createCoreNavigationLayer()) // 2. Core navigation
  (withPerformance())     // 3. Performance enhancements
  (withScrollRestoration()) // 4. UI enhancements
  (transitionsLayer())    // 5. Visual enhancements
  (devLayer())           // 6. Development tools
  ();
```

### Environment-Specific Composition

```typescript
const createAppRouter = (routes: Route<any>[]) => {
  const builder = createLayeredRouter(routes)
    (dataLayer({ 
      autoCleanup: true,
      logResourceEvents: process.env.NODE_ENV !== 'production'
    }));
  
  // Development layers
  if (process.env.NODE_ENV !== 'production') {
    builder(devLayer({ exposeToWindow: true, autoAnalyze: true }));
  }
  
  // Performance layers for production
  if (process.env.NODE_ENV === 'production') {
    builder(performanceLayer({ 
      prefetchOnHover: true,
      connectionAware: true 
    }));
  }
  
  return builder();
};
```

### Custom Layer Patterns

```typescript
// Configuration-based layer factory
const createConfigurableLayer = (config: MyConfig) => {
  return (router: ComposableRouter) => {
    if (config.enableFeatureA) {
      // Add feature A
    }
    
    if (config.enableFeatureB) {
      // Add feature B
    }
    
    return {
      // Layer extensions
    };
  };
};

// Conditional enhancement
const createConditionalLayer = (condition: boolean, layer: RouterLayer) => {
  return condition ? layer : identityLayer();
};

// Layer composition utilities
const createProductionLayers = () => [
  dataLayer({ autoCleanup: true }),
  performanceLayer({ prefetchOnHover: true }),
  scrollRestorationLayer({ strategy: 'smooth' })
];

const createDevelopmentLayers = () => [
  ...createProductionLayers(),
  devLayer({ exposeToWindow: true, autoAnalyze: true })
];
```

### Type Safety

Ensure type safety when creating custom layers:

```typescript
// Strongly typed layer extensions
interface TypedLayerExtensions {
  typedMethod: (param: string) => number;
  typedProperty: boolean;
}

function typedLayer(): RouterLayer<RouterContext, TypedLayerExtensions> {
  return (router) => ({
    typedMethod: (param: string): number => param.length,
    typedProperty: true
  });
}

// TypeScript will correctly infer the final router type
const router = createLayeredRouter(routes)
  (dataLayer())
  (typedLayer())
  ();

// TypeScript knows these methods exist
const length = router.typedMethod('hello'); // number
const flag = router.typedProperty;          // boolean
const cached = router.cache.get('key');     // From data layer
```

This comprehensive layered architecture provides maximum flexibility while maintaining type safety and backwards compatibility, enabling you to build exactly the router configuration your application needs.

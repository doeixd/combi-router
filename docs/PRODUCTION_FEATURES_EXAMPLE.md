# Production Features Usage Guide

This guide demonstrates how to use the new production features in Combi-Router.

## Overview

The production features include:

1. **Scroll Restoration** - Automatic scroll position management
2. **Enhanced Code Splitting** - Intelligent lazy loading with preloading strategies
3. **Advanced Transitions** - Custom page transitions beyond basic View Transitions API
4. **Performance Optimizations** - Prefetching, memory management, and monitoring

## Basic Setup

```typescript
import { createRouter, route, path, param } from '@doeixd/combi-router';
import { z } from 'zod';

// Define your routes
const homeRoute = route(path('home'));
const usersRoute = route(path('users'));
const userRoute = route(path('users'), param('id', z.number()));

// Create router with production features
const router = createRouter([homeRoute, usersRoute, userRoute], {
  features: {
    scrollRestoration: {
      enabled: true,
      strategy: 'auto',
      restoreOnBack: true,
      saveDelay: 100
    },
    codeSplitting: {
      strategy: 'route-based',
      preloadStrategy: 'hover',
      connectionAware: true,
      retryAttempts: 3
    },
    transitions: {
      enabled: true,
      type: 'view-transitions',
      duration: 300,
      skipSameRoute: true
    },
    performance: {
      prefetchOnHover: true,
      prefetchViewport: true,
      navigationTimeout: 10000,
      enablePerformanceMonitoring: true,
      preloadCriticalRoutes: ['home', 'users']
    }
  }
});
```

## 1. Scroll Restoration

Automatically saves and restores scroll positions during navigation.

```typescript
// Manual scroll operations
router.saveScrollPosition('custom-key');
router.restoreScrollPosition('custom-key');

// Access scroll restoration manager
const scrollManager = router.scrollRestoration;
if (scrollManager) {
  // Get saved positions
  const positions = scrollManager.getAllPositions();
  
  // Clear all positions
  scrollManager.clearPositions();
  
  // Update configuration
  scrollManager.updateConfig({
    strategy: 'smooth',
    excludePaths: ['/admin']
  });
}
```

### Configuration Options

```typescript
interface ScrollRestorationConfig {
  enabled: boolean;                    // Enable/disable feature
  strategy: 'auto' | 'manual' | 'smooth'; // Restoration strategy
  restoreOnBack: boolean;              // Restore on back navigation
  saveDelay?: number;                  // Debounce delay for saving (ms)
  maxPositions?: number;               // Maximum stored positions
  smoothScrollBehavior?: ScrollBehavior; // Smooth scrolling options
  excludePaths?: string[];             // Paths to exclude from restoration
}
```

## 2. Enhanced Code Splitting

Intelligent lazy loading with multiple preloading strategies.

```typescript
// Setup hover preloading on a link
const cleanup = router.setupHoverPrefetch(linkElement, userRoute);

// Setup viewport preloading
const cleanup2 = router.setupViewportPrefetch(elementInView, userRoute);

// Access code splitting manager
const codeSplitting = router.codeSplitting;
if (codeSplitting) {
  // Get loading state
  const state = codeSplitting.getLoadingState('user-route');
  
  // Manually preload a chunk
  await codeSplitting.preloadChunk('user-route');
  
  // Get statistics
  const stats = codeSplitting.getStats();
  console.log('Loaded chunks:', stats.loadedChunks);
}
```

### Configuration Options

```typescript
interface CodeSplittingConfig {
  strategy: 'route-based' | 'feature-based' | 'hybrid';
  preloadStrategy: 'hover' | 'visible' | 'immediate' | 'none';
  chunkNaming?: (route: Route) => string;
  fallback?: ComponentType;
  errorBoundary?: ComponentType;
  preloadTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  priority?: 'high' | 'low' | 'auto';
  connectionAware?: boolean;
}
```

## 3. Advanced Transitions

Sophisticated page transitions with customization options.

```typescript
// Custom transition function
const customTransition: TransitionFunction = async (context) => {
  const { from, to, direction } = context;
  
  // Custom animation logic
  const container = document.querySelector('#app');
  if (container) {
    await container.animate([
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: direction === 'forward' ? 'translateX(-100px)' : 'translateX(100px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], {
      duration: 400,
      easing: 'ease-in-out'
    }).finished;
  }
};

// Use custom transition
const router = createRouter(routes, {
  features: {
    transitions: {
      enabled: true,
      type: 'custom',
      customTransition,
      debugMode: true
    }
  }
});

// Access transition manager
const transitions = router.transitions;
if (transitions) {
  // Get current status
  const status = transitions.getStatus();
  
  // Cancel current transition
  transitions.cancelCurrentTransition();
}
```

### Predefined Transitions

```typescript
import { transitionPresets } from '@doeixd/combi-router';

const router = createRouter(routes, {
  features: {
    transitions: {
      enabled: true,
      type: 'custom',
      customTransition: transitionPresets.slideLeft
    }
  }
});
```

### Configuration Options

```typescript
interface TransitionConfig {
  enabled: boolean;
  type: 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
  duration?: number;
  easing?: string;
  customTransition?: TransitionFunction;
  skipSameRoute?: boolean;
  fallbackTransition?: TransitionType;
  debugMode?: boolean;
  respectPreferences?: boolean; // Respect user's motion preferences
}
```

## 4. Performance Optimizations

Advanced performance features for production applications.

```typescript
// Access performance manager
const performance = router.performance;
if (performance) {
  // Get performance report
  const report = performance.getPerformanceReport();
  console.log('Prefetch hit rate:', report.prefetchHitRate);
  
  // Manual prefetch
  await performance.prefetchRoute('user-route', 'high');
  
  // Setup element-based prefetching
  const cleanup = performance.setupHoverPrefetch(element, 'route-id');
}

// Get router performance report
const report = router.getPerformanceReport();
```

### Configuration Options

```typescript
interface PerformanceConfig {
  prefetchOnHover: boolean;
  prefetchViewport: boolean;
  navigationTimeout: number;
  resourcePriority: 'high' | 'low' | 'auto';
  memoryManagement: {
    enabled: boolean;
    maxCacheSize: number;
    maxCacheAge: number;
    cleanupInterval: number;
    lowMemoryThreshold: number;
  };
  connectionAware: boolean;
  enablePerformanceMonitoring: boolean;
  preloadCriticalRoutes?: string[];
}
```

## Complete Example

```typescript
import { createRouter, route, path, param, lazy, loader } from '@doeixd/combi-router';
import { z } from 'zod';

// Define routes with lazy loading
const homeRoute = route(path('home'));

const userRoute = route(
  path('users'), 
  param('id', z.number()),
  lazy(() => import('./components/UserProfile')),
  loader(async ({ params }) => {
    return { user: await fetchUser(params.id) };
  })
);

// Create router with all production features
const router = createRouter([homeRoute, userRoute], {
  features: {
    scrollRestoration: {
      enabled: true,
      strategy: 'smooth',
      restoreOnBack: true,
      excludePaths: ['/admin']
    },
    codeSplitting: {
      strategy: 'route-based',
      preloadStrategy: 'hover',
      connectionAware: true,
      retryAttempts: 3,
      errorBoundary: ErrorBoundary
    },
    transitions: {
      enabled: true,
      type: 'view-transitions',
      duration: 300,
      respectPreferences: true,
      fallbackTransition: 'fade'
    },
    performance: {
      prefetchOnHover: true,
      prefetchViewport: true,
      enablePerformanceMonitoring: true,
      preloadCriticalRoutes: ['home'],
      memoryManagement: {
        enabled: true,
        maxCacheSize: 100,
        maxCacheAge: 10 * 60 * 1000 // 10 minutes
      }
    }
  }
});

// Navigation with full production features
async function navigateToUser(userId: number) {
  const result = await router.navigate(userRoute, { id: userId });
  
  if (result.success) {
    console.log('Navigation completed with production features');
  } else {
    console.error('Navigation failed:', result.error);
  }
}

// Setup link prefetching
const userLink = document.querySelector('a[href="/users/123"]');
if (userLink) {
  const cleanup = router.setupHoverPrefetch(userLink, userRoute);
  
  // Cleanup when element is removed
  // cleanup();
}

// Monitor performance
setInterval(() => {
  const report = router.getPerformanceReport();
  console.log('Router performance:', report);
}, 30000);

export { router };
```

## Browser Support

- **Scroll Restoration**: All modern browsers
- **Code Splitting**: All modern browsers with ES2015+ support
- **Transitions**: 
  - View Transitions API: Chrome 111+, Edge 111+
  - Custom transitions: All modern browsers
- **Performance Features**: All modern browsers

## Best Practices

1. **Scroll Restoration**: Exclude admin/form pages that shouldn't restore scroll
2. **Code Splitting**: Use hover preloading for better UX, but be connection-aware
3. **Transitions**: Respect user preferences for reduced motion
4. **Performance**: Monitor hit rates and adjust prefetching strategies accordingly

## Migration from Basic Router

```typescript
// Before (basic router)
const router = createRouter([routes]);

// After (with production features)
const router = createRouter([routes], {
  features: {
    scrollRestoration: { enabled: true },
    performance: { prefetchOnHover: true }
  }
});
```

All features are optional and can be enabled incrementally without breaking existing code.

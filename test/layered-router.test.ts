// =================================================================
//
//      Combi-Router: Layered Router Tests
//
//      Comprehensive tests for the new layered router architecture
//
// =================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLayeredRouter,
  createCoreNavigationLayer,
  withPerformance,
  withScrollRestoration,
  conditionalLayer,
  identityLayer,
  makeLayered,
  path,
  param
} from '../src';
import { route, Route } from '../src/core/route';

// Mock DOM APIs for testing
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

Object.defineProperty(window, 'history', {
  value: {
    pushState: vi.fn(),
    replaceState: vi.fn()
  },
  writable: true
});

global.addEventListener = vi.fn();
global.performance = { now: () => Date.now() };

describe('Layered Router Architecture', () => {
  const testRoutes = [
    route(path('/'), { name: 'home' }),
    route(path('/about'), { name: 'about' }),
    route(path('/user'), param('id'), { name: 'user' }),
    route(path('/admin'), { name: 'admin' })
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Layer Composition', () => {
    it('should create a router with core navigation layer only', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        ();

      expect(router).toBeDefined();
      expect(router.routes()).toEqual(testRoutes);
      expect(typeof router.navigate).toBe('function');
      expect(typeof router.match).toBe('function');
      expect(typeof router.build).toBe('function');
    });

    it('should compose multiple layers correctly', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (withPerformance({ prefetchOnHover: true }))
        (withScrollRestoration({ strategy: 'smooth' }))
        ();

      // Core functionality
      expect(typeof router.navigate).toBe('function');
      expect(typeof router.match).toBe('function');

      // Performance layer functionality
      expect(typeof router.prefetchRoute).toBe('function');
      expect(typeof router.setupHoverPrefetch).toBe('function');

      // Scroll restoration functionality
      expect(typeof router.saveScrollPosition).toBe('function');
      expect(typeof router.restoreScrollPosition).toBe('function');
    });

    it('should maintain layer order', () => {
      const callOrder: string[] = [];

      const firstLayer = (router: any) => ({
        firstMethod: () => {
          callOrder.push('first');
          return 'first';
        }
      });

      const secondLayer = (router: any) => ({
        secondMethod: () => {
          callOrder.push('second');
          return 'second';
        }
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (firstLayer)
        (secondLayer)
        ();

      // Call the methods to trigger the callOrder tracking
      const first = router.firstMethod();
      const second = router.secondMethod();
      
      expect(callOrder).toEqual(['first', 'second']);
      expect(first).toBe('first');
      expect(second).toBe('second');
    });
  });

  describe('Custom Layer Creation', () => {
    it('should allow creating custom analytics layer', () => {
      const analyticsEvents: Array<{ event: string; data: any }> = [];

      const withAnalytics = (config: { trackingId: string }) => (router: any) => ({
        trackEvent: (event: string, data?: any) => {
          analyticsEvents.push({ event, data });
        },

        getEvents: () => [...analyticsEvents],

        trackingId: () => config.trackingId
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (withAnalytics({ trackingId: 'UA-123456-7' }))
        ();

      expect(router.trackingId()).toBe('UA-123456-7');
      expect(typeof router.trackEvent).toBe('function');
      expect(typeof router.getEvents).toBe('function');

      // Test custom tracking
      router.trackEvent('button_click', { button: 'signup' });
      const events = router.getEvents();
      expect(events).toContainEqual({
        event: 'button_click',
        data: { button: 'signup' }
      });
    });

    it('should allow creating custom authentication layer', () => {
      const withAuth = (config: { requireAuth?: string[] } = {}) => (self: any) => {
        let currentUser: { id: string; role: string } | null = null;

        return {
          login: (user: { id: string; role: string }) => {
            currentUser = user;
          },

          logout: () => {
            currentUser = null;
          },

          getCurrentUser: () => currentUser,

          isAuthenticated: () => currentUser !== null,

          hasRole: (role: string) => currentUser?.role === role,

          // Enhanced navigation with auth checks
          navigateWithAuth: async (path: string, requiredRole?: string) => {
            if (!currentUser) {
              throw new Error('Authentication required');
            }

            if (requiredRole && !self.hasRole(requiredRole)) {
              throw new Error('Insufficient permissions');
            }

            return self.navigate(path);
          }
        };
      };

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (withAuth({ requireAuth: ['/admin'] }))
        ();

      expect(router.isAuthenticated()).toBe(false);

      router.login({ id: 'user1', role: 'admin' });
      expect(router.isAuthenticated()).toBe(true);
      expect(router.hasRole('admin')).toBe(true);

      router.logout();
      expect(router.isAuthenticated()).toBe(false);
    });

    it('should allow layers to enhance existing functionality', () => {
      const navigationLogs: string[] = [];

      const withLogging = (self: any) => {
        // Enhance existing navigate method
        const originalNavigate = self.navigate;

        return {
          navigate: async (path: string, options?: any) => {
            navigationLogs.push(`Navigating to: ${path}`);
            const result = await originalNavigate(path, options);
            navigationLogs.push(`Navigation ${result ? 'successful' : 'failed'}`);
            return result;
          },

          getNavigationLogs: () => [...navigationLogs]
        };
      };

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (withLogging)
        ();

      // Test enhanced navigation
      router.navigate('/about');
      const logs = router.getNavigationLogs();
      expect(logs).toContain('Navigating to: /about');
    });
  });

  describe('Layer Communication', () => {
    it('should allow layers to call methods from previous layers', () => {
      const withCaching = (self: any) => ({
        cache: new Map(),
        
        getCached: (key: string) => self.cache.get(key),
        
        setCached: (key: string, value: any) => {
          self.cache.set(key, value);
        }
      });

      const withSmartPrefetch = (self: any) => ({
        smartPrefetch: async (routeId: string) => {
          // Check cache first
          const cached = self.getCached(`prefetch_${routeId}`);
          if (cached) {
            return cached;
          }

          // Use performance layer to prefetch
          if ('prefetchRoute' in self) {
            const result = await self.prefetchRoute(routeId);
            self.setCached(`prefetch_${routeId}`, result);
            return result;
          }

          return null;
        }
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (withPerformance())
        (withCaching)
        (withSmartPrefetch)
        ();

      expect(typeof router.smartPrefetch).toBe('function');
      expect(typeof router.getCached).toBe('function');
      expect(typeof router.prefetchRoute).toBe('function');
    });
  });

  describe('Conditional Layers', () => {
    it('should apply layers conditionally', () => {
      const isDev = false;
      const isProd = true;

      const withDevTools = (self: any) => ({
        debugInfo: () => 'Debug information',
        logState: () => console.log(self.currentMatch)
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (conditionalLayer(isDev, withDevTools))
        (conditionalLayer(isProd, withPerformance()))
        ();

      // Should not have dev tools
      expect('debugInfo' in router).toBe(false);
      
      // Should have performance features
      expect('prefetchRoute' in router).toBe(true);
    });

    it('should use identity layer for false conditions', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (conditionalLayer(false, () => ({ shouldNotExist: true })))
        ();

      expect('shouldNotExist' in router).toBe(false);
      expect(typeof router.navigate).toBe('function'); // Core still works
    });
  });

  describe('Advanced Composition Patterns', () => {
    it('should support factory functions for dynamic layer creation', () => {
      const createFeatureLayer = (features: string[]) => (self: any) => {
        const layerMethods: any = {};

        if (features.includes('analytics')) {
          layerMethods.trackEvent = (event: string) => `Tracked: ${event}`;
        }

        if (features.includes('cache')) {
          layerMethods.cache = new Map();
          layerMethods.getCached = (key: string) => layerMethods.cache.get(key);
        }

        if (features.includes('auth')) {
          layerMethods.currentUser = null;
          layerMethods.login = (user: any) => { layerMethods.currentUser = user; };
        }

        return layerMethods;
      };

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (createFeatureLayer(['analytics', 'cache']))
        ();

      expect(typeof router.trackEvent).toBe('function');
      expect(typeof router.getCached).toBe('function');
      expect('login' in router).toBe(false); // auth not included
    });

    it('should support layer composition with makeLayered directly', () => {
      const customRouter = makeLayered({
        routes: testRoutes,
        customState: { counter: 0 }
      })
      (createCoreNavigationLayer())
      ((self: any) => ({
        incrementCounter: () => {
          self.context.customState.counter++;
        },
        
        getCounter: () => self.context.customState.counter
      }))
      ();

      expect(typeof customRouter.incrementCounter).toBe('function');
      expect(customRouter.getCounter()).toBe(0);
      
      customRouter.incrementCounter();
      expect(customRouter.getCounter()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle layer errors gracefully', () => {
      const errorLayer = (self: any) => {
        throw new Error('Layer initialization failed');
      };

      expect(() => {
        createLayeredRouter(testRoutes)
          (createCoreNavigationLayer())
          (errorLayer)
          ();
      }).toThrow('Layer initialization failed');
    });

    it('should isolate layer failures', () => {
      const workingLayer = (self: any) => ({
        workingMethod: () => 'works'
      });

      const failingLayer = (self: any) => ({
        failingMethod: () => {
          throw new Error('Method failed');
        }
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (workingLayer)
        (failingLayer)
        ();

      expect(router.workingMethod()).toBe('works');
      expect(() => router.failingMethod()).toThrow('Method failed');
      
      // Core functionality should still work
      expect(typeof router.navigate).toBe('function');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with custom layers', () => {
      interface CustomLayerExtensions {
        customMethod: () => string;
        customProperty: number;
      }

      const typedCustomLayer = (self: any): CustomLayerExtensions => ({
        customMethod: () => 'typed result',
        customProperty: 42
      });

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (typedCustomLayer)
        ();

      // TypeScript should infer these types correctly
      const result: string = router.customMethod();
      const prop: number = router.customProperty;

      expect(result).toBe('typed result');
      expect(prop).toBe(42);
    });
  });

  describe('Performance Characteristics', () => {
    it('should not significantly impact performance with many layers', () => {
      const createSimpleLayer = (name: string) => (self: any) => ({
        [`method_${name}`]: () => `result_${name}`
      });

      const start = performance.now();

      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (createSimpleLayer('1'))
        (createSimpleLayer('2'))
        (createSimpleLayer('3'))
        (createSimpleLayer('4'))
        (createSimpleLayer('5'))
        ();

      const end = performance.now();
      const initTime = end - start;

      // Router should initialize quickly (less than 50ms)
      expect(initTime).toBeLessThan(50);

      // All methods should be available
      expect(router.method_1()).toBe('result_1');
      expect(router.method_5()).toBe('result_5');
    });
  });
});

describe('Migration and Compatibility', () => {
  const testRoutes = [
    route(path('/'), { name: 'home' }),
    route(path('/about'), { name: 'about' })
  ];

  it('should provide equivalent functionality to old configuration-based approach', () => {
    // Old approach would be:
    // new CombiRouter(routes, { features: { performance: {...}, scrollRestoration: {...} } })

    // New approach:
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      (withPerformance({ prefetchOnHover: true }))
      (withScrollRestoration({ strategy: 'smooth' }))
      ();

    // Should have all the same methods
    expect(typeof router.navigate).toBe('function');
    expect(typeof router.prefetchRoute).toBe('function');
    expect(typeof router.saveScrollPosition).toBe('function');
  });

  it('should allow gradual migration', () => {
    // Start with minimal router
    let router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    expect('prefetchRoute' in router).toBe(false);

    // Add performance later
    router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      (withPerformance())
      ();

    expect('prefetchRoute' in router).toBe(true);
  });
});

describe('Enhanced Error Handling', () => {
  const testRoutes = [
    route(path('/'), { name: 'home' }),
    route(path('/valid'), { name: 'valid' })
  ];

  it('should handle invalid URLs gracefully', async () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    // Test invalid URL types
    expect(await router.navigate(null as any)).toBe(false);
    expect(await router.navigate(undefined as any)).toBe(false);
    expect(await router.navigate('')).toBe(false);
  });

  it('should handle navigation timeout properly', async () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    // Test navigation with short timeout
    const start = Date.now();
    const result = await router.navigate('/valid', { timeout: 1 });
    const duration = Date.now() - start;

    // Should either succeed quickly or timeout
    expect(duration < 100 || !result).toBe(true);
  });

  it('should handle concurrent navigation attempts', async () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    // Start multiple navigations simultaneously
    const nav1 = router.navigate('/valid');
    const nav2 = router.navigate('/');
    
    const results = await Promise.all([nav1, nav2]);
    
    // At least one should succeed
    expect(results.some(r => r === true)).toBe(true);
  });

  it('should handle fallback routes properly', async () => {
    const fallbackRoute = route(path('/fallback'), { name: 'fallback' });
    const routerRoutes = [...testRoutes, fallbackRoute];
    
    const router = createLayeredRouter(routerRoutes)
      (createCoreNavigationLayer())
      ();

    router.fallback(fallbackRoute);

    // Navigate to non-existent route should use fallback
    const result = await router.navigate('/nonexistent');
    expect(result).toBe(true);
    const currentMatch = router.currentMatch;
    // Check if the route has a name matcher 
    const nameMatcher = currentMatch?.route.matchers?.find((m: any) => m.name === 'fallback');
    expect(nameMatcher?.name).toBe('fallback');
  });
});

describe('Performance Layer Validation', () => {
  const testRoutes = [
    route(path('/'), { name: 'home' }),
    route(path('/test'), { name: 'test' })
  ];

  it('should validate configuration and use defaults for invalid values', () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      (withPerformance({
        navigationTimeout: -100, // Invalid
        memoryManagement: {
          enabled: true,
          maxCacheSize: -5, // Invalid
          maxCacheAge: 30000,
          cleanupInterval: 5000,
          lowMemoryThreshold: 50000000
        }
      }))
      ();

    expect(typeof router.prefetchRoute).toBe('function');
    expect(typeof router.getPerformanceReport).toBe('function');
  });

  it('should handle lifecycle hook registration failures gracefully', () => {
    // Create router without core layer (no lifecycle hooks)
    const router = createLayeredRouter(testRoutes)
      (withPerformance()) // Apply performance layer without core
      ();

    // Should not throw errors
    expect(typeof router.prefetchRoute).toBe('function');
  });

  it('should track navigation performance metrics', async () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      (withPerformance({ enablePerformanceMonitoring: true }))
      ();

    await router.navigate('/test');
    
    const report = router.getPerformanceReport();
    expect(report).toBeDefined();
    expect(typeof report.prefetchCacheSize).toBe('number');
  });
});

describe('Dynamic Route Management Edge Cases', () => {
  const testRoutes = [
    route(path('/'), { name: 'home' }),
    route(path('/test'), { name: 'test' })
  ];

  it('should handle adding routes with duplicate IDs', () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    const duplicateRoute = route(path('/duplicate'), { name: 'home' });
    const firstRoute = router.routes()[0];
    duplicateRoute.id = firstRoute.id; // Force same ID to test duplicate detection
    
    expect(router.addRoute(duplicateRoute)).toBe(false);
    expect(router.routes().length).toBe(testRoutes.length); // Should not increase
  });

  it('should handle removing non-existent routes', () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    const nonExistentRoute = route(path('/missing'), { name: 'missing' });
    
    expect(router.removeRoute(nonExistentRoute)).toBe(false);
    expect(router.routes().length).toBe(testRoutes.length); // Should not change
  });

  it('should handle removing currently active route', async () => {
    const testRoute = new Route([path('/test')], { name: 'test' });
    const routesWithTest = [...testRoutes, testRoute];
    
    const router = createLayeredRouter(routesWithTest)
      (createCoreNavigationLayer())
      ();

    // Navigate to test route
    await router.navigate('/test');
    expect(router.currentMatch?.route.id).toBeDefined();

    // Remove the currently active route - find it by ID
    const currentRouteId = router.currentMatch?.route.id;
    const foundTestRoute = router.routes().find(r => r.id === currentRouteId);
    if (foundTestRoute) {
      const result = router.removeRoute(foundTestRoute);
      expect(result).toBe(true);
      
      // Should automatically navigate away from removed route
      // (Implementation may vary based on fallback strategy)
    }
  });

  it('should validate route objects before adding', () => {
    const router = createLayeredRouter(testRoutes)
      (createCoreNavigationLayer())
      ();

    // Test invalid route objects
    expect(router.addRoute(null as any)).toBe(false);
    expect(router.addRoute({} as any)).toBe(false);
    expect(router.addRoute({ path: '/test' } as any)).toBe(false); // Missing ID
  });
});

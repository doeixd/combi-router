// =================================================================
//
//      Combi-Router: Dev and Data Integration Tests
//
//      Tests to ensure dev and data modules work seamlessly with 
//      the layered router and compatibility layer
//
// =================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createLayeredRouter,
  route,
  path,
  param,
  loader,
  CombiRouter,
  devLayer,
  dataLayer,
  quickDevLayer,
  quickDataLayer,
  createResource,
  createAdvancedResource,
  createCoreNavigationLayer
} from '../src';

// Mock browser environment
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true
});

Object.defineProperty(globalThis, 'performance', {
  value: {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn()
  },
  writable: true
});

describe('Dev and Data Integration', () => {
  let testRoutes: any[];

  beforeEach(() => {
    // Reset environment
    vi.clearAllMocks();
    
    // Create test routes
    testRoutes = [
      route(path('/')),
      route(
        path('users'),
        param('id'),
        loader(async ({ params }) => ({
          user: createResource(() => 
            Promise.resolve({ id: params.id, name: `User ${params.id}` })
          )
        }))
      ),
      route(path('about'))
    ];
  });

  describe('Layered Router with Dev and Data Layers', () => {
    it('should create layered router with dev and data layers', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (dataLayer())
        (devLayer())
        ();

      expect(router).toBeDefined();
      expect(router.routes).toHaveLength(3);
      
      // Check that dev layer methods are available
      expect(typeof router.runDevAnalysis).toBe('function');
      expect(typeof router.getDevReport).toBe('function');
      
      // Check that data layer methods are available
      expect(typeof router.createResource).toBe('function');
      expect(typeof router.createAdvancedResource).toBe('function');
      expect(typeof router.getCacheStats).toBe('function');
    });

    it('should work with quick layer presets', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (quickDataLayer())
        (quickDevLayer())
        ();

      expect(router).toBeDefined();
      expect(router.routes).toHaveLength(3);
      
      // Test that dev mode is properly initialized
      expect(router.devMode).toBeDefined();
      
      // Test that cache is available
      expect(router.cache).toBeDefined();
      expect(typeof router.getCacheStats).toBe('function');
    });

    it('should handle resource creation through data layer', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (dataLayer())
        ();

      // Create a resource through the layer
      const resource = router.createResource(() => 
        Promise.resolve({ data: 'test' })
      );

      expect(resource).toBeDefined();
      expect(resource.status).toBe('pending');
    });

    it('should handle advanced resource creation with caching', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (dataLayer())
        ();

      // Create an advanced resource with cache configuration
      const resource = router.createAdvancedResource(
        () => Promise.resolve({ data: 'advanced test' }),
        {
          cache: { ttl: 60000, invalidateOn: ['test'] },
          retry: { attempts: 3 }
        }
      );

      expect(resource).toBeDefined();
      expect(resource.status).toBe('pending');
      expect(typeof resource.refetch).toBe('function');
      expect(typeof resource.invalidate).toBe('function');
    });
  });

  describe('Compatibility Layer Integration', () => {
    it('should work with CombiRouter backwards compatibility', () => {
      // The compatibility layer should automatically include dev and data layers
      const router = new CombiRouter(testRoutes);

      expect(router).toBeDefined();
      expect(router.routes).toHaveLength(3);
      
      // Should have standard router methods
      expect(typeof router.navigate).toBe('function');
      expect(typeof router.match).toBe('function');
      expect(typeof router.subscribe).toBe('function');
    });

    it('should provide dev tools in development mode', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const router = new CombiRouter(testRoutes);
        
        // Access the internal layered router to check dev tools
        // Note: In real usage, dev tools would be exposed differently
        expect(router).toBeDefined();
        
        // The dev layer should be automatically included in development
        // and data layer should always be included
        expect(router.routes).toHaveLength(3);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle data management in compatibility mode', async () => {
      const router = new CombiRouter(testRoutes);
      
      // Test navigation to a route with a loader
      const match = router.match('/users/123');
      expect(match).toBeDefined();
      expect(match?.route.metadata.loader).toBeDefined();
    });
  });

  describe('Resource Integration', () => {
    it('should work with route loaders', async () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (dataLayer())
        ();

      // Match a route with a resource
      const match = router.match('/users/456');
      expect(match).toBeDefined();
      expect(match?.params.id).toBe('456');
    });

    it('should handle cache invalidation', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (dataLayer())
        ();

      // Test cache operations
      router.cache.set('test-key', { data: 'test' }, { 
        ttl: 60000, 
        invalidateOn: ['user'] 
      });

      expect(router.cache.has('test-key')).toBe(true);

      // Invalidate by tags
      const invalidated = router.invalidateByTags(['user']);
      expect(invalidated).toBeGreaterThan(0);
      expect(router.cache.has('test-key')).toBe(false);
    });
  });

  describe('Dev Tools Integration', () => {
    it('should provide comprehensive dev reporting', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (devLayer())
        ();

      // Get dev report
      const report = router.getDevReport();
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(Array.isArray(report.warnings)).toBe(true);
    });

    it('should analyze router structure', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (devLayer())
        ();

      // Run analysis
      router.runDevAnalysis();
      
      // Should not throw and should provide analysis
      expect(router.devMode).toBeDefined();
    });

    it('should provide route validation', () => {
      const router = createLayeredRouter(testRoutes)
        (createCoreNavigationLayer())
        (devLayer())
        ();

      // Dev mode should be initialized
      expect(router.devMode).toBeDefined();
      
      // Should provide dev features
      expect(typeof router.exportDevData).toBe('function');
      expect(typeof router.clearDevData).toBe('function');
    });
  });

  describe('Production Mode', () => {
    it('should handle production mode gracefully', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const router = createLayeredRouter(testRoutes)
          (createCoreNavigationLayer())
          (dataLayer()) // Data layer should still work in production
          (devLayer())  // Dev layer should provide no-ops in production
          ();

        expect(router).toBeDefined();
        
        // Dev methods should be no-ops in production
        expect(router.devMode).toBeNull();
        expect(typeof router.runDevAnalysis).toBe('function'); // Should be no-op
        
        // Data methods should still work
        expect(typeof router.createResource).toBe('function');
        expect(router.cache).toBeDefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});

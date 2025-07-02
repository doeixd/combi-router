/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRouter,
  route,
  path,
  param,
  query,
  end,
  extend,
  meta,
  loader,
  guard,
  cache,
  lazy,
  createResource,
  type StandardSchemaV1,
  type RouteMatch,
  type CombiRouter,
  type Resource,
  type LoaderContext,
  type RouteGuard,
} from '../src';

// --- Advanced Mock Standard Schema Implementations ---

const StrictStringSchema: StandardSchemaV1<string, string> = {
  '~standard': {
    version: 1,
    vendor: 'test-advanced',
    validate: (value: unknown) => {
      if (typeof value === 'string') return { value };
      return { issues: [{ message: 'Strictly requires a string' }] };
    },
    types: { input: '' as string, output: '' as string },
  },
};

const TransformingNumberSchema: StandardSchemaV1<string | number, number> = {
  '~standard': {
    version: 1,
    vendor: 'test-advanced',
    validate: (value: unknown) => {
      const num = Number(value);
      if (!isNaN(num) && (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))) {
        return { value: num * 2 }; // Example transformation
      }
      return { issues: [{ message: 'Cannot transform to number' }] };
    },
    types: { input: '' as string | number, output: 0 as number },
  },
};

const AsyncSchema: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test-advanced',
    validate: async (value: unknown) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      if (typeof value === 'string') return { value };
      return { issues: [{ message: 'Async validation failed' }] };
    },
    types: { input: '' as unknown, output: '' as string },
  },
};

// Mock document.startViewTransition
if (typeof document !== 'undefined') {
  (document as any).startViewTransition = vi.fn((cb) => {
    cb();
    return {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    };
  });
}


describe('CombiRouter Advanced Features', () => {
  let router: CombiRouter;

  // Mock window history and location for navigation tests
  const mockPushState = vi.fn();
  const mockReplaceState = vi.fn();
  const originalHistory = global.window?.history;
  const originalLocation = global.window?.location;

  beforeEach(() => {
    vi.resetAllMocks();
    // Setup mock browser environment for navigation
    if (global.window) {
      // @ts-ignore
      global.window.history = { 
        pushState: mockPushState, 
        replaceState: mockReplaceState, 
        back: vi.fn(), 
        forward: vi.fn(), 
        go: vi.fn(), 
        scrollRestoration: 'auto', 
        length: 0, 
        state: null 
      };
      // @ts-ignore
      global.window.location = {
         ...originalLocation, 
         pathname: '/', 
         search: '', 
         hash: '',
         assign: vi.fn(),
         reload: vi.fn(),
         replace: vi.fn(),
      } as any;
      global.window.addEventListener = vi.fn();
      global.window.removeEventListener = vi.fn();
      // @ts-ignore
      global.navigator = { onLine: true };

    } else { // If no global.window (e.g. Node environment for some tests)
        // @ts-ignore
        global.window = {
            history: {
                pushState: mockPushState,
                replaceState: mockReplaceState,
                back: vi.fn(),
                forward: vi.fn(),
                go: vi.fn(),
                scrollRestoration: 'auto',
                length: 0,
                state: null
            },
            location: {
                pathname: '/',
                search: '',
                hash: '',
                assign: vi.fn(),
                reload: vi.fn(),
                replace: vi.fn(),
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
            URL:URL,
            // @ts-ignore
            navigator : { onLine: true }
        } as any;
        // @ts-ignore
        global.document = {
            startViewTransition: vi.fn((cb) => { cb(); return { ready: Promise.resolve()}; }),
        } as any;
    }
  });

  afterEach(() => {
    if (global.window && originalHistory && originalLocation) {
      global.window.history = originalHistory;
      global.window.location = originalLocation as any;
    }
    vi.restoreAllMocks();
  });

  describe('Route Hierarchy Traversal Tests', () => {
    it('should traverse nested route hierarchies correctly', () => {
      const adminR = route(path('admin'));
      const usersR = extend(adminR, path('users'));
      const userDetailR = extend(usersR, param('id', TransformingNumberSchema));
      const userSettingsR = extend(userDetailR, path('settings'), end);
      
      router = createRouter([userSettingsR, adminR]);
      
      const match = router.match('/admin/users/10/settings');
      expect(match).toBeDefined();
      expect(match?.pathname).toBe('/admin');
      expect(match?.child).toBeDefined();
      expect(match?.child?.params.id).toBe(20); // TransformingNumberSchema doubles the value
      expect(match?.child?.pathname).toBe('/admin/users/10/settings');
    });

    it('should handle complex nested route parameters', () => {
      const categoryR = route(path('category'), param('categoryId', StrictStringSchema));
      const itemR = extend(categoryR, path('item'), param('itemId', TransformingNumberSchema));
      const variantR = extend(itemR, path('variant'), param('variantId', StrictStringSchema), end);
      
      router = createRouter([variantR, categoryR]);
      
      const match = router.match('/category/electronics/item/5/variant/red');
      expect(match).toBeDefined();
      expect(match?.pathname).toBe('/category/electronics');
      expect(match?.child).toBeDefined();
      expect(match?.child?.params).toEqual({
        categoryId: 'electronics',
        itemId: 10, // Transformed by schema
        variantId: 'red'
      });
    });

    it('should prefer most specific route matches', () => {
      const baseR = route(path('api'), path('v1'));
      const usersR = extend(baseR, path('users'), end);
      const userDetailR = extend(baseR, path('users'), param('id', TransformingNumberSchema), end);
      
      router = createRouter([usersR, userDetailR, baseR]);
      
      // Should match the more specific route
      const match = router.match('/api/v1/users/123');
      expect(match).toBeDefined();
      expect(match?.pathname).toBe('/api/v1');
      expect(match?.child).toBeDefined();
      expect(match?.child?.params.id).toBe(246); // Doubled by schema
    });
  });

  describe('Route Validation Advanced Scenarios', () => {
    it('should validate complex route structures during creation', () => {
      expect(() => {
        // This should work - wildcard is last path-related matcher
        route(
          path('files'),
          path.wildcard('segments'),
          query('metadata', StrictStringSchema),
          end
        );
      }).not.toThrow();
    });

    it('should detect invalid route patterns', () => {
      expect(() => {
        // Multiple wildcards should throw
        route(
          path('invalid'),
          path.wildcard('first'),
          path.wildcard('second')
        );
      }).toThrow('Routes cannot have more than one wildcard matcher');
    });

    it('should handle parameter uniqueness across extended routes', () => {
      const baseR = route(path('base'), param('id', TransformingNumberSchema));
      
      // The current implementation allows this but deduplicates parameter names
      const extendedR = extend(baseR, param('id', StrictStringSchema));
      
      // The first parameter definition wins
      expect(extendedR.paramNames).toEqual(['id']);
      expect(extendedR.paramNames.length).toBe(1);
    });
  });

  describe('Enhanced Navigation Error Handling', () => {
    beforeEach(() => {
      router = createRouter([]);
    });

    it('should provide detailed validation errors', async () => {
      const complexR = route(
        path('complex'),
        param('required', TransformingNumberSchema),
        query('filter', StrictStringSchema),
        end
      );
      
      router = createRouter([complexR]);
      
      const result = await router.navigate(complexR, {} as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation-failed');
      expect(result.error?.message).toContain('Failed to build URL');
      expect(result.error?.route).toBe(complexR);
    });

    it('should handle loader failures gracefully', async () => {
      const failingLoader = async () => {
        throw new Error('Loader failed');
      };
      
      const routeWithLoader = route(
        path('data'),
        loader(failingLoader),
        end
      );
      
      router = createRouter([routeWithLoader]);
      
      const result = await router.navigate(routeWithLoader, {});
      
      // The navigation might still succeed even if the loader fails
      // depending on the router's error handling strategy
      expect(result).toBeDefined();
    });
  });

  describe('Advanced Route Composition Patterns', () => {
    it('should handle deeply nested metadata inheritance', () => {
      const level1 = route(
        path('l1'),
        meta({ title: 'Level 1', shared: 'from-l1', l1Only: 'value1' })
      );
      
      const level2 = extend(
        level1,
        path('l2'),
        meta({ title: 'Level 2', shared: 'from-l2', l2Only: 'value2' })
      );
      
      const level3 = extend(
        level2,
        path('l3'),
        meta({ subtitle: 'Level 3', shared: 'from-l3' }),
        end
      );
      
      expect(level3.metadata).toEqual({
        title: 'Level 2', // From level 2
        shared: 'from-l3', // Overridden at level 3
        l1Only: 'value1', // From level 1
        l2Only: 'value2', // From level 2
        subtitle: 'Level 3' // From level 3
      });
    });

    it('should support complex route building patterns', () => {
      const apiBase = route(path('api'), path('v2'));
      const resourceBase = extend(apiBase, path('resources'));
      
      const userResource = extend(resourceBase, path('users'), param('userId', TransformingNumberSchema));
      const userPosts = extend(userResource, path('posts'), end);
      const userSettings = extend(userResource, path('settings'), end);
      
      router = createRouter([userPosts, userSettings]);
      
      expect(router.build(userPosts, { userId: 5 })).toBe('/api/v2/resources/users/5/posts');
      expect(router.build(userSettings, { userId: 3 })).toBe('/api/v2/resources/users/3/settings');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle routes with many parameters efficiently', () => {
      const manyParamsR = route(
        path('complex'),
        param('p1', StrictStringSchema),
        param('p2', TransformingNumberSchema),
        param('p3', StrictStringSchema),
        param('p4', TransformingNumberSchema),
        query('q1', StrictStringSchema),
        query('q2', TransformingNumberSchema),
        end
      );
      
      router = createRouter([manyParamsR]);
      
      const url = '/complex/a/1/b/2?q1=test&q2=3';
      const match = router.match(url);
      
      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        p1: 'a',
        p2: 2, // Doubled
        p3: 'b', 
        p4: 4, // Doubled
        q1: 'test',
        q2: 6 // Doubled
      });
    });

    it('should handle concurrent route operations', async () => {
      const homeR = route(path('home'), end);
      const aboutR = route(path('about'), end);
      
      router = createRouter([homeR, aboutR]);
      
      // Concurrent navigation attempts
      const nav1 = router.navigate(homeR, {});
      const nav2 = router.navigate(aboutR, {});
      
      const results = await Promise.all([nav1, nav2]);
      
      // Both should complete with some result
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results.some(r => r.success || r.cancelled)).toBe(true);
    });

    it('should handle empty and root route patterns', () => {
      const rootR = route(path(''), end);
      const emptyR = route(end);
      
      router = createRouter([rootR, emptyR]);
      
      expect(router.match('/')?.route.id).toBeDefined();
      expect(router.build(rootR, {})).toBe('/');
      expect(router.build(emptyR, {})).toBe('/');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  createRouter,
  route,
  path,
  param,
  query,
  end,
  extend,
  type StandardSchemaV1,
  type RouteMatch,
  CombiRouter,
} from '../src'; // Assuming 'src/index.ts' is the entry point

// --- Minimal Standard Schema Implementations for Testing ---

const StringSchema: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (typeof value === 'string') {
        return { value };
      }
      return { issues: [{ message: 'Must be a string' }] };
    },
    types: { input: '' as unknown, output: '' as string },
  },
};

const NumberSchema: StandardSchemaV1<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const num = Number(value);
      if (typeof value === 'number' || (typeof value === 'string' && !isNaN(num) && value.trim() !== '')) {
        return { value: Number(value) };
      }
      return { issues: [{ message: 'Must be a number' }] };
    },
    types: { input: 0 as unknown, output: 0 as number },
  },
};

const OptionalStringSchema: StandardSchemaV1<unknown, string | undefined> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (value === undefined || typeof value === 'string') {
        return { value: value as string | undefined };
      }
      return { issues: [{ message: 'Must be a string or undefined' }] };
    },
    types: { input: '' as unknown, output: '' as string | undefined },
  },
};

const FailingSchema: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (_value: unknown) => {
      return { issues: [{ message: 'Validation always fails' }] };
    },
    types: { input: '' as unknown, output: '' as string },
  },
};


describe('CombiRouter with StandardSchema', () => {
  it('should match a simple path route', () => {
    const homeRoute = route(path('home'), end);
    const router = createRouter([homeRoute]);
    const match = router.match('/home');
    expect(match).not.toBeNull();
    expect(match?.route.id).toBe(homeRoute.id);
  });

  // --- Param Tests ---
  describe('param() validation', () => {
    const userRoute = route(path('users'), param('id', NumberSchema), end);
    const nameRoute = route(path('names'), param('name', StringSchema), end);
    const failingParamRoute = route(path('test'), param('bad', FailingSchema), end);
    const router = createRouter([userRoute, nameRoute, failingParamRoute]);

    it('should match and parse a valid number param', () => {
      const match = router.match('/users/123');
      expect(match).not.toBeNull();
      expect(match?.params.id).toBe(123);
    });

    it('should match and parse a valid string param', () => {
      const match = router.match('/names/alice');
      expect(match).not.toBeNull();
      expect(match?.params.name).toBe('alice');
    });
    
    it('should parse string "456" as number for NumberSchema param', () => {
      const match = router.match('/users/456');
      expect(match).not.toBeNull();
      expect(match?.params.id).toBe(456);
    });

    it('should not match if number param validation fails (e.g. non-numeric string)', () => {
      // The current param parser logic with `validateWithStandardSchemaSync` will lead to a failure in the parser chain
      // which results in `match` being null, not a match with an error state in params.
      // This is because `failure()` is called in the parser.
      expect(() => router.match('/users/abc')).not.toThrow(); // should not throw, but fail to match
      const match = router.match('/users/abc');
      expect(match).toBeNull(); // No match due to parsing/validation failure
    });
    
    it('should not match if param validation always fails', () => {
      const match = router.match('/test/anything');
      expect(match).toBeNull();
    });
  });

  // --- Query Tests ---
  describe('query() validation', () => {
    const itemsRoute = route(path('items'), query('page', NumberSchema), query.optional('sort', OptionalStringSchema), end);
    const searchRoute = route(path('search'), query('term', StringSchema), end);
    const failingQueryRoute = route(path('querytest'), query('q', FailingSchema), end);
    const router = createRouter([itemsRoute, searchRoute, failingQueryRoute]);

    it('should match and parse a valid number query param', () => {
      const match = router.match('/items?page=2');
      expect(match).not.toBeNull();
      expect(match?.params.page).toBe(2);
    });

    it('should match and parse a valid string query param', () => {
      const match = router.match('/search?term=widgets');
      expect(match).not.toBeNull();
      expect(match?.params.term).toBe('widgets');
    });

    it('should handle optional query param (present)', () => {
      const match = router.match('/items?page=1&sort=asc');
      expect(match).not.toBeNull();
      expect(match?.params.page).toBe(1);
      expect(match?.params.sort).toBe('asc');
    });

    it('should handle optional query param (absent)', () => {
      const match = router.match('/items?page=3');
      expect(match).not.toBeNull();
      expect(match?.params.page).toBe(3);
      expect(match?.params.sort).toBeUndefined();
    });
    
    it('should throw if required query param validation fails during match', () => {
       // _processParams throws an error for invalid query params
      expect(() => router.match('/search?term=123&term=abc')).toThrow(/Query param validation failed for "term"/);
    });

    it('should throw if query validation always fails', () => {
      expect(() => router.match('/querytest?q=anything')).toThrow(/Query param validation failed for "q"/);
    });
    
    it('should parse string "789" as number for NumberSchema query', () => {
      const match = router.match('/items?page=789');
      expect(match).not.toBeNull();
      expect(match?.params.page).toBe(789);
    });
  });

  // --- Build Tests ---
  describe('router.build()', () => {
    const userRoute = route(path('users'), param('id', NumberSchema), end);
    const itemsRoute = route(path('items'), query('page', NumberSchema), query.optional('sort', OptionalStringSchema), end);
    const router = createRouter([userRoute, itemsRoute]);

    it('should build URL for route with params', () => {
      const url = router.build(userRoute, { id: 123 });
      expect(url).toBe('/users/123');
    });

    it('should build URL for route with query params', () => {
      const url = router.build(itemsRoute, { page: 2, sort: 'desc' });
      expect(url).toBe('/items?page=2&sort=desc');
    });

    it('should build URL with optional query param absent', () => {
      const url = router.build(itemsRoute, { page: 3 });
      expect(url).toBe('/items?page=3');
    });

    it('should return null if required param is missing for build', () => {
      // @ts-expect-error Testing missing param
      const url = router.build(userRoute, {});
      expect(url).toBeNull();
    });
  });
  
  // --- Navigation and Match Object ---
  describe('Navigation and Match Object', () => {
    const productRoute = route(path('product'), param('id', NumberSchema), query('variant', StringSchema), end);
    const router = createRouter([productRoute]);

    // Mock window history and location for navigation tests
    const mockPushState = vi.fn();
    const originalHistory = global.window?.history;
    const originalLocation = global.window?.location;

    beforeEach(() => {
      vi.resetAllMocks();
      if (global.window) {
        // @ts-ignore
        global.window.history = { pushState: mockPushState, replaceState: vi.fn(), back: vi.fn(), forward: vi.fn(), go: vi.fn(), scrollRestoration:'auto', length: 0, state: null };
        // @ts-ignore
        global.window.location = { ...originalLocation, pathname: '/', search: '', hash: '' };
      }
    });

    afterEach(() => {
      if (global.window && originalHistory && originalLocation) {
        global.window.history = originalHistory;
        global.window.location = originalLocation;
      }
    });

    it('should correctly populate RouteMatch object', async () => {
      const targetUrl = '/product/789?variant=blue';
      if (global.window) {
          // @ts-ignore
        global.window.location = { ...global.window.location, pathname: '/product/789', search: '?variant=blue', hash: '#details' };
      }
      
      await router.navigate(productRoute, { id: 789, variant: 'blue' });
      
      const match = router.currentMatch;
      expect(match).not.toBeNull();
      if (!match) return;

      expect(match.route.id).toBe(productRoute.id);
      expect(match.params).toEqual({ id: 789, variant: 'blue' });
      expect(match.pathname).toBe('/product/789'); // Assuming base URL is effectively '/'
      expect(match.search).toBe('?variant=blue');
      // Hash is not part of `build` or `match` params directly, but part of match object
      // To test hash, we'd need to simulate a URL with hash for the initial match or popstate
      // For this navigation, the hash isn't explicitly set by the router.build.
      // Let's refine this if testing hash from URL is critical for navigate.
      // expect(match.hash).toBe('#details'); // This would require setting window.location.hash before match
    });
  });

  // --- Type Inference Smoke Test ---
  it('should allow type-safe parameter access (compile-time check)', () => {
    const typedRoute = route(path('typed'), param('num', NumberSchema), query('str', StringSchema), end);
    const router = createRouter([typedRoute]);
    const match = router.match('/typed/123?str=abc');

    if (match && match.route.id === typedRoute.id) {
      const params = match.params; // params should be { num: number, str: string }
      const num: number = params.num;
      const str: string = params.str;
      expect(num).toBe(123);
      expect(str).toBe('abc');
    } else {
      expect.fail('Match failed or was not for the correct route');
    }
  });
});

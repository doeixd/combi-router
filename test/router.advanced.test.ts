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

  it('should have a placeholder test', () => {
    expect(true).toBe(true);
  });

  // Test cases for enhancers, advanced routing scenarios, etc. will go here
});

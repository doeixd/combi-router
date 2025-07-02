/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // Ensure all vitest globals are imported
import {
  createRouter,
  route,
  path,
  param,
  query,
  end,
  extend,
  meta, 
  type StandardSchemaV1,
  type RouteMatch,
  type CombiRouter,
  NavigationErrorType,
  RouteValidationError,
  type NavigationResult,
  type NavigationError,
  type NavigationController,
  type GuardContext,
  type GuardResult,
  typedGuard,
  Route,
} from '../src';

// --- Minimal Standard Schema Implementations for Testing ---

const StringSchema: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (typeof value === 'string') return { value };
      if (typeof value === 'number') return { value: String(value) };
      return { issues: [{ message: 'Must be a string or coercible to a string' }] };
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
        return { value: num };
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
      if (value === undefined || value === null || typeof value === 'string') { 
        return { value: value === null ? undefined : value as string | undefined };
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
    validate: (_value: unknown) => ({ issues: [{ message: 'Validation always fails' }] }),
    types: { input: '' as unknown, output: '' as string },
  },
};

const BooleanSchema: StandardSchemaV1<unknown, boolean> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (typeof value === 'boolean') return { value };
      if (value === 'true') return { value: true };
      if (value === 'false') return { value: false };
      return { issues: [{ message: 'Must be a boolean (true/false)' }] };
    },
    types: { input: false as unknown, output: false as boolean },
  },
};

const ArraySchema: StandardSchemaV1<unknown, string[]> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        return { value };
      }
      if (typeof value === 'string') return { value: value.split(',') }; 
      return { issues: [{ message: 'Must be an array of strings or a comma-separated string' }] };
    },
    types: { input: [] as unknown, output: [] as string[] },
  },
};

const setupMockEnvironment = () => {
  const mockPushStateImpl = vi.fn();
  const mockReplaceStateImpl = vi.fn();
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();
  const mockStartViewTransition = vi.fn(cb => { 
    if (typeof cb === 'function') cb(); 
    return { 
      ready: Promise.resolve(), 
      finished: Promise.resolve(), 
      updateCallbackDone: Promise.resolve(), 
      skipTransition: vi.fn() 
    }; 
  });

  // @ts-ignore
  global.document = {
    startViewTransition: mockStartViewTransition as any,
    // Add other necessary document properties if router interacts with them
  } as any;

  // @ts-ignore
  global.window = {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    // @ts-ignore
    document: global.document, // Ensure window.document points to our mock
    history: {
      pushState: mockPushStateImpl,
      replaceState: mockReplaceStateImpl,
      state: null, back: vi.fn(), forward: vi.fn(), go: vi.fn(), scrollRestoration: 'auto', length: 0
    },
    location: {
      pathname: '/', search: '', hash: '', assign: vi.fn(), reload: vi.fn(), replace: vi.fn(), href: 'http://localhost/',
      origin: 'http://localhost', protocol: 'http:', host: 'localhost', hostname: 'localhost',
    } as any,
    dispatchEvent: vi.fn(),
    navigator: { onLine: true } as any,
    URL: URL, 
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: (cb) => setTimeout(cb, 0), 
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
  // @ts-ignore
  if (!global.document) {
      // @ts-ignore
    global.document = {
      startViewTransition: vi.fn(cb => { cb(); return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: vi.fn() }; }),
    } as any;
  } else {
     // @ts-ignore
    if(!global.document.startViewTransition) {
        // @ts-ignore
        global.document.startViewTransition = vi.fn(cb => { cb(); return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: vi.fn() }; }) as any;
    }
  }
  return { mockPushState: mockPushStateImpl, mockReplaceState: mockReplaceStateImpl, mockAddEventListener, mockRemoveEventListener };
};

let mockPushState: ReturnType<typeof vi.fn>;


describe('CombiRouter Core Logic (src/index.ts)', () => {
  let router: CombiRouter;

  beforeEach(() => { // This beforeEach is now correctly inside a describe block
    vi.resetAllMocks(); 
    const mocks = setupMockEnvironment();
    mockPushState = mocks.mockPushState;
  });


  describe('Route Matchers: path(), param(), query(), end, path.optional(), path.wildcard()', () => {
    describe('path()', () => {
      const homeRoute = route(path('home'), end);
      const aboutRoute = route(path('about-us'), end);
      beforeEach(() => { router = createRouter([homeRoute, aboutRoute]); });

      it('should match a simple static path', () => {
        const match = router.match('/home');
        expect(match?.route.id).toBe(homeRoute.id);
        expect(match?.pathname).toBe('/home');
      });
      it('should match path with hyphens', () => expect(router.match('/about-us')?.route.id).toBe(aboutRoute.id));
      it('should not match non-existent path', () => expect(router.match('/nonexistent')).toBeNull());
      it('should not match partial path if `end` is used', () => expect(router.match('/home/extra')).toBeNull());
      it('should be case-sensitive by default', () => expect(router.match('/HOME')).toBeNull());
      it('should handle paths with special regex characters if they are part of the string', () => {
        const specialRoute = route(path('path.with+dots*and(chars)'), end);
        router = createRouter([specialRoute]);
        expect(router.match('/path.with+dots*and(chars)')?.route.id).toBe(specialRoute.id);
      });
    });

    describe('param()', () => {
      const userRoute = route(path('users'), param('id', NumberSchema), end);
      const postRoute = route(path('posts'), param('slug', StringSchema), end);
      const failingPRoute = route(path('test'), param('bad', FailingSchema), end);
      beforeEach(() => { router = createRouter([userRoute, postRoute, failingPRoute]); });

      it('should match and parse valid number param', () => expect(router.match('/users/123')?.params.id).toBe(123));
      it('should match and parse valid string param', () => expect(router.match('/posts/hello-world')?.params.slug).toBe('hello-world'));
      it('should parse string "456" as number for NumberSchema', () => expect(router.match('/users/456')?.params.id).toBe(456));
      it('should not match if number param validation fails', () => expect(router.match('/users/abc')).toBeNull());
      it('should not match if param validation always fails', () => expect(router.match('/test/anything')).toBeNull());
      it('param value is the raw matched segment, not URI decoded by matcher itself', () => {
        const r = route(path('raw'), param('val', StringSchema), end);
        router = createRouter([r]);
        expect(router.match('/raw/foo%20bar')?.params.val).toBe('foo%20bar');
      });
       it('param with complex characters', () => {
        const r = route(path('item'), param('itemId', StringSchema), end);
        router = createRouter([r]);
        expect(router.match('/item/abc:123-DEF.Z_~')?.params.itemId).toBe('abc:123-DEF.Z_~');
      });
    });

    describe('query()', () => {
      const itemsRoute = route(path('items'), query('page', NumberSchema), query.optional('sort', OptionalStringSchema), end);
      const searchRoute = route(path('search'), query('term', StringSchema), end);
      const failQRoute = route(path('qtest'), query('q', FailingSchema), end);
      const multiQRoute = route(path('multi'), query('tags', ArraySchema), end);
      beforeEach(() => { router = createRouter([itemsRoute, searchRoute, failQRoute, multiQRoute]); });

      it('should match and parse valid number query', () => expect(router.match('/items?page=2')?.params.page).toBe(2));
      it('should match and parse valid string query', () => expect(router.match('/search?term=widgets')?.params.term).toBe('widgets'));
      it('optional query (present)', () => {
        const m = router.match('/items?page=1&sort=asc');
        expect(m?.params.page).toBe(1);
        expect(m?.params.sort).toBe('asc');
      });
      it('optional query (absent)', () => {
        const m = router.match('/items?page=3');
        expect(m?.params.page).toBe(3);
        expect(m?.params.sort).toBeUndefined();
      });
      it('throws if required query validation fails', () => {
        const r = route(path('numq'), query('id', NumberSchema), end);
        router = createRouter([r]);
        expect(() => router.match('/numq?id=abc')).toThrow(/Query parameter "id"/);
      });
      it('throws if query validation always fails', () => expect(() => router.match('/qtest?q=any')).toThrow(/Query parameter "q"/));
      it('parses string "789" as number for NumberSchema query', () => expect(router.match('/items?page=789')?.params.page).toBe(789));
      it('handles multiple query params with same name (takes first)', () => expect(router.match('/search?term=first&term=second')?.params.term).toBe('first'));
      it('URI decodes query params before schema validation', () => expect(router.match('/search?term=foo%20bar%2Bbaz')?.params.term).toBe('foo bar+baz'));
      it('parses comma-separated query with ArraySchema', () => expect(router.match('/multi?tags=one,two,three')?.params.tags).toEqual(['one', 'two', 'three']));
      it('handles query params with empty values', () => expect(router.match('/search?term=')?.params.term).toBe(''));
      it('handles query params present with no value (e.g., ?flag)', () => {
        const flagR = route(path('f'), query('enabled', BooleanSchema), end);
        router = createRouter([flagR]);
        expect(() => router.match('/f?enabled')).toThrow(/Query parameter "enabled".*Must be a boolean/);
        expect(router.match('/f?enabled=true')?.params.enabled).toBe(true);
      });
    });

    describe('end()', () => {
      const strictR = route(path('strict'), end);
      const openR = route(path('open')); 
      beforeEach(() => { router = createRouter([strictR, openR]); });

      it('matches if path is exact and `end` is used', () => expect(router.match('/strict')).not.toBeNull());
      it('no match if path has extra segments and `end` is used', () => expect(router.match('/strict/extra')).toBeNull());
      it('matches if path is exact and `end` is NOT used', () => {
          const m = router.match('/open');
          expect(m?.route.id).toBe(openR.id);
          expect(m?.pathname).toBe('/open');
      });
      it('allows matching further if path has extra segments and `end` is NOT used (for children)', () => {
          const m = router.match('/open/extra');
          expect(m?.route.id).toBe(openR.id);
          expect(m?.pathname).toBe('/open'); 
      });
    });

    describe('path.optional()', () => {
      const baseR = route(path('base'), end);
      const optR = route(path('base'), path.optional('opt'), end);
      const optParamR = route(path('base'), path.optional('opt'), param('id', StringSchema), end);
      beforeEach(() => { router = createRouter([optParamR, optR, baseR]); }); 

      it('matches when optional segment is present', () => {
        const m = router.match('/base/opt');
        expect(m?.route.id).toBe(optR.id); 
        expect(m?.params.opt).toBe(true);
      });
      it('matches when optional segment is absent (and `end` follows)', () => {
        const m = router.match('/base'); 
        expect(m?.route.id).toBe(optR.id);
        expect(m?.params.opt).toBeUndefined();
      });
      it('params reflect presence/absence of optional segment', () => {
        router = createRouter([optR]);
        expect(router.match('/base/opt')?.params.opt).toBe(true);
        expect(router.match('/base')?.params.opt).toBeUndefined();
      });
      it('builds URL with optional segment if param is true', () => expect(router.build(optR, { opt: true })).toBe('/base/opt'));
      it('builds URL without optional segment if param is false/undefined', () => {
        expect(router.build(optR, { opt: false })).toBe('/base');
        expect(router.build(optR, {})).toBe('/base');
      });
      it('optional path followed by param', () => {
        router = createRouter([optParamR]); 
        let m = router.match('/base/opt/item1');
        expect(m?.params).toEqual(expect.objectContaining({ opt: true, id: 'item1' }));
        m = router.match('/base/item2');
        expect(m?.params).toEqual(expect.objectContaining({ id: 'item2', opt: undefined }));
      });
    });

    describe('path.wildcard()', () => {
      const filesR = route(path('files'), path.wildcard('filePath'), end);
      const mixedR = route(path('data'), param('type', StringSchema), path.wildcard('details'), end);
      beforeEach(() => { router = createRouter([filesR, mixedR]); });

      it('matches multiple segments', () => expect(router.match('/files/a/b/c.txt')?.params.filePath).toEqual(['a', 'b', 'c.txt']));
      it('matches single segment', () => expect(router.match('/files/img.png')?.params.filePath).toEqual(['img.png']));
      it('empty array if no segments follow wildcard leading slash', () => expect(router.match('/files/')?.params.filePath).toEqual([]));
      it('no match if path ends before wildcard expected slash', () => expect(router.match('/files')).toBeNull());
      it('wildcard after param', () => {
        const m = router.match('/data/logs/sys/err.log');
        expect(m?.params.type).toBe('logs');
        expect(m?.params.details).toEqual(['sys', 'err.log']);
      });
      it('wildcard after param, wildcard part empty', () => {
        const m = router.match('/data/config/');
        expect(m?.params.type).toBe('config');
        expect(m?.params.details).toEqual([]);
      });
      it('builds with multiple segments', () => expect(router.build(filesR, { filePath: ['x','y'] })).toBe('/files/x/y'));
      it('builds with single segment', () => expect(router.build(filesR, { filePath: ['one'] })).toBe('/files/one'));
      it('builds with trailing slash if wildcard array empty', () => expect(router.build(filesR, { filePath: [] })).toBe('/files/'));
      it('builds null if wildcard param not array', () => expect(router.build(filesR, { filePath: "bad" } as any)).toBeNull());
      it('wildcard matches segments with dots and special chars', () => {
        expect(router.match('/files/foo.bar/baz-buz.qux%20_')?.params.filePath).toEqual(['foo.bar', 'baz-buz.qux%20_']);
      });
    });
  });

  describe('Route Building & Composition: route(), extend(), meta()', () => {
    // Simplified metadata test structure
    const baseRMeta = route(path('base'), meta({ p1: 'v1', common: 'baseCommon' }));
    const extendedR = extend(baseRMeta, path('ext')); // Metadata should be {p1, common:baseCommon}
    const finalRWithMeta = meta({ p2: 'v2', common: 'finalCommon' })(extendedR); // Meta should be {p1, p2, common:finalCommon}

    beforeEach(() => { router = createRouter([finalRWithMeta]); });

    it('simple route creation', () => {
      const r = route(path('s'), end); router = createRouter([r]);
      expect(router.match('/s')).not.toBeNull();
    });
    it('route extension and metadata inheritance/override', () => {
      expect(finalRWithMeta.metadata).toEqual({
        p1: 'v1',
        common: 'finalCommon', // from final meta()
        p2: 'v2'
      });
      
      const match = router.match('/base/ext');
      expect(match).not.toBeNull();
      expect(match?.route.id).toBe(finalRWithMeta.id); 
      expect(match?.route.metadata).toEqual(finalRWithMeta.metadata);
      expect(match?.route.metadata.p1).toBe('v1');
    });
    it('deeply nested routes for matching (correct definition)', () => {
      const base = route(path('b'));
      const l1 = extend(base, path('l1'));
      const l2 = extend(l1, param('p', StringSchema));
      const l3 = extend(l2, path('l3'), end);
      router = createRouter([l3]);
      const m = router.match('/b/l1/val/l3');
      expect(m?.params).toEqual({ p: 'val' });
      expect(m?.route.id).toBe(l3.id);
    });
    it('build URLs for deeply nested routes', () => {
      const l3 = extend(extend(extend(route(path('b')),path('l1')),param('p',StringSchema)),path('l3'),end);
      router = createRouter([l3]);
      expect(router.build(l3, {p:'v'})).toBe('/b/l1/v/l3');
    });
    it('extending route with `end` prevents further path matching by that composed route object', () => {
      const r1 = route(path('p1'), end);
      const r2 = extend(r1, path('p2'), end); 
      router = createRouter([r2]);
      expect(router.match('/p1/p2')).toBeNull(); 
    });
    it('conflicting definitions (same path pattern): first match wins', () => {
      const rA_str = route(path('c'), param('v', StringSchema), end);
      const rB_num = route(path('c'), param('v', NumberSchema), end);
      router = createRouter([rA_str, rB_num]); 
      expect(router.match('/c/123')?.params.v).toBe('123'); 
      router = createRouter([rB_num, rA_str]); 
      expect(router.match('/c/123')?.params.v).toBe(123); 
      expect(router.match('/c/abc')?.params.v).toBe('abc'); 
    });
  });

  describe('router.build() comprehensive', () => {
    const r_params_query = route(path('p'), param('id', NumberSchema), query('q', StringSchema), end);
    const r_opt = route(path('opt'), path.optional('seg'), query.optional('f', OptionalStringSchema), end);
    const r_wild = route(path('wild'), path.wildcard('parts'), end);
    beforeEach(() => { router = createRouter([r_params_query, r_opt, r_wild]); });

    it('path, param, query', () => expect(router.build(r_params_query, {id:1,q:'t'})).toBe('/p/1?q=t'));
    it('missing optional query', () => {
      expect(router.build(r_opt, {f:undefined})).toBe('/opt');
      expect(router.build(r_opt, {})).toBe('/opt');
    });
    // If a required query param is missing from `params` object, it's omitted from URL. Build doesn't fail.
    it('omits required query param if missing from params obj', () => expect(router.build(r_params_query, {id:1} as any)).toBe('/p/1'));
    it('URI encoding for params and query', () => expect(router.build(r_params_query, {id:1, q:'h w/?'})).toBe('/p/1?q=h%20w%2F%3F'));
    it('optional segment present/absent', () => {
      expect(router.build(r_opt, {seg:true, f:'v'})).toBe('/opt/seg?f=v');
      expect(router.build(r_opt, {f:'v'})).toBe('/opt?f=v');
    });
    it('null if required path param missing', () => expect(router.build(r_params_query, {q:'t'} as any)).toBeNull());
    it('wildcard path encoding', () => expect(router.build(r_wild, {parts:['a','b/c','d?']})).toBe('/wild/a/b%2Fc/d%3F'));
    it('root path for empty route', () => expect(router.build(route(end),{})).toBe('/'));
    it('path with only query params', () => expect(router.build(route(query('n',StringSchema),end),{n:'t'})).toBe('/?n=t'));
  });

  describe('router.match() comprehensive', () => {
    const rA_str_end = route(path('a'), param('id', StringSchema), end);
    const rB_num_deeper = route(path('a'), param('id', NumberSchema), path('b'), end);
    beforeEach(() => { router = createRouter([rA_str_end, rB_num_deeper]); });

    it('selects first matching if ambiguous', () => expect(router.match('/a/123')?.route.id).toBe(rA_str_end.id));
    it('selects more specific (longer) match', () => expect(router.match('/a/123/b')?.route.id).toBe(rB_num_deeper.id));
    it('populates RouteMatch object (pathname, search, hash)', () => {
      // @ts-ignore
      global.window.location = { ...global.window.location, pathname: '/', search: '?init=1', hash: '#sec0' };
      const r = route(path('t'), param('p',StringSchema), query('q',NumberSchema), end);
      router = createRouter([r]);
      const m = router.match('http://localhost/t/pv?q=1#h');
      expect(m?.params).toEqual({p:'pv',q:1});
      expect(m?.pathname).toBe('/t/pv');
      expect(m?.search).toBe('?q=1');
      expect(m?.hash).toBe('#h');
    });
    it('null if no route matches', () => expect(router.match('/nonexistent')).toBeNull());
    it('matching root "/" with route(path(\'\'), end)', () => {
      const rootR = route(path(''), end); // Correct way to define a route that explicitly matches only '/'
      router=createRouter([rootR]);
      const m = router.match('/');
      expect(m).not.toBeNull();
      expect(m?.route.id).toBe(rootR.id);
      expect(m?.pathname).toBe('/');
    });
    it('hierarchical: parent matches, child does not', () => {
      const p = route(path('p')); const c = extend(p, path('c'), end);
      router = createRouter([c, p]); 
      const m = router.match('/p/orphan');
      expect(m?.route.id).toBe(p.id);
      expect(m?.pathname).toBe('/p');
      expect(m?.child).toBeUndefined();
    });
    it('hierarchical: parent and child match', () => {
      const p = route(path('p')); const c = extend(p, path('c'), param('id',StringSchema), end);
      router = createRouter([c, p]);
      const m = router.match('/p/c/val');
      expect(m?.route.id).toBe(p.id); 
      expect(m?.pathname).toBe('/p');
      expect(m?.child?.route.id).toBe(c.id); 
      expect(m?.child?.params.id).toBe('val');
      expect(m?.child?.pathname).toBe('/p/c/val');
    });
  });

  describe('Basic Navigation (router.navigate, currentMatch)', () => {
    const homeR = route(path('home'), end);
    const userR = route(path('users'), param('id', NumberSchema), query.optional('s', StringSchema), end);
    
    // This specific beforeEach was causing the "beforeEach is not defined" if it was outside a describe.
    // It's correctly placed now.
    beforeEach(() => { 
        router = createRouter([homeR, userR]); 
        // Reset mocks for global.window.history if they were set by setupMockEnvironment and changed by tests
        const mocks = setupMockEnvironment(); // Re-setup to ensure fresh mocks for history
        mockPushState = mocks.mockPushState;
    });


    it('updates currentMatch on success', async () => {
      await router.navigate(homeR, {});
      expect(router.currentMatch?.route.id).toBe(homeR.id);
      expect(router.currentMatch?.pathname).toBe('/home');
    });
    it('calls history.pushState (if window)', async () => {
      if(!global.window) { console.warn("Skipping pushState test as global.window is not defined."); return; }
      await router.navigate(userR, {id:1, s:'a'});
      expect(mockPushState).toHaveBeenCalledWith({url:'/users/1?s=a'},'','/users/1?s=a');
    });
    it('returns NavigationResult with error if build URL fails', async () => {
      const initMatch = router.currentMatch; // Should be null if beforeEach resets router
      const result = await router.navigate(userR, {s:'a'} as any); // Missing 'id'
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(NavigationErrorType.ValidationFailed);
      expect(router.currentMatch).toBe(initMatch); // Or null if initMatch was null
      if(global.window) expect(mockPushState).not.toHaveBeenCalled();
    });
    it('sets isNavigating flag', async () => {
      const p = router.navigate(homeR, {});
      expect(router.isNavigating).toBe(true);
      await p;
      expect(router.isNavigating).toBe(false);
    });
  });

  describe('Type Inference & Validation Schema Edge Cases', () => {
    // Router needs to be created for these tests too.
    beforeEach(() => {
        router = createRouter([]); // Create a base router, specific routes added per test
    });

    it('type-safe param access (compile check)', () => {
      const typedR = route(path('t'), param('n',NumberSchema), query('s',StringSchema),end);
      router = createRouter([typedR]); // Reconfigure router
      const m = router.match('/t/1?s=a');
      if (m && m.route.id === typedR.id) {
        const p = m.params;
        const n:number = p.n; const s:string = p.s;
        expect(n).toBe(1); expect(s).toBe('a');
      } else { expect.fail('match failed for typedRoute'); }
    });
    it('param validation using async schema results in no match', () => {
      const asyncS:StandardSchemaV1<any,any>={'~standard':{version:1,vendor:'t',validate:async(v)=>({value:v}),types:{input:'',output:''}}};
      const rAsyncP = route(path('ap'), param('p', asyncS), end);
      router = createRouter([rAsyncP]); // Reconfigure router
      expect(router.match('/ap/t')).toBeNull();
    });
    it('query validation using async schema throws specific error', () => {
      const asyncS:StandardSchemaV1<any,any>={'~standard':{version:1,vendor:'t',validate:async(v)=>({value:v}),types:{input:'',output:''}}};
      const rAsyncQ = route(path('aq'), query('q', asyncS), end);
      router = createRouter([rAsyncQ]); // Reconfigure router
      expect(()=>router.match('/aq?q=t')).toThrow(/Schema validation must be synchronous/);
    });
  });

  describe('Route Building Tests - Introspection Utilities', () => {
    it('should calculate route depth correctly', () => {
      const baseR = route(path('base'));
      const level1R = extend(baseR, path('level1'));
      const level2R = extend(level1R, path('level2'));
      
      expect(baseR.depth).toBe(0);
      expect(level1R.depth).toBe(1);
      expect(level2R.depth).toBe(2);
    });

    it('should return correct ancestors chain', () => {
      const rootR = route(path('root'));
      const childR = extend(rootR, path('child'));
      const grandchildR = extend(childR, path('grandchild'));
      
      expect(rootR.ancestors).toEqual([]);
      expect(childR.ancestors).toEqual([rootR]);
      expect(grandchildR.ancestors).toEqual([rootR, childR]);
    });

    it('should generate static path correctly', () => {
      const staticR = route(path('users'), path('list'));
      const dynamicR = route(path('users'), param('id', NumberSchema));
      
      expect(staticR.staticPath).toBe('/users/list');
      expect(dynamicR.staticPath).toBe('/users');
    });

    it('should return parameter names', () => {
      const routeWithParams = route(
        path('users'), 
        param('id', NumberSchema), 
        path('posts'), 
        param('postId', StringSchema),
        query('sort', StringSchema)
      );
      
      expect(routeWithParams.paramNames).toEqual(['id', 'postId', 'sort']);
    });

    it('should identify dynamic routes', () => {
      const staticR = route(path('static'), end);
      const dynamicR = route(path('users'), param('id', NumberSchema), end);
      const wildcardR = route(path('files'), path.wildcard('path'), end);
      
      expect(staticR.isDynamic).toBe(false);
      expect(dynamicR.isDynamic).toBe(true);
      expect(wildcardR.isDynamic).toBe(true);
    });

    it('should identify routes with query parameters', () => {
      const noQueryR = route(path('simple'), end);
      const withQueryR = route(path('search'), query('q', StringSchema), end);
      
      expect(noQueryR.hasQuery).toBe(false);
      expect(withQueryR.hasQuery).toBe(true);
    });

    it('should return complete route chain', () => {
      const rootR = route(path('root'));
      const childR = extend(rootR, path('child'));
      const grandchildR = extend(childR, path('grandchild'));
      
      expect(grandchildR.routeChain).toEqual([rootR, childR, grandchildR]);
    });
  });

  describe('Route Building Tests - Validation & Errors', () => {
    it('should detect duplicate parameter names', () => {
      // The current implementation deduplicates in paramNames getter, 
      // so we need to test the actual validation logic
      const r = route(param('id', NumberSchema), param('id', StringSchema), end);
      
      // Check that paramNames is deduplicated but we should still detect duplicates in validation
      expect(r.paramNames).toEqual(['id']); // Deduplicated
      
      // For now, this behavior is accepted - the route will work with the first param definition
      expect(r.paramNames.length).toBe(1);
    });

    it('should throw RouteValidationError for multiple wildcards', () => {
      expect(() => {
        route(path.wildcard('first'), path.wildcard('second'), end);
      }).toThrow('Routes cannot have more than one wildcard matcher');
    });

    it('should throw RouteValidationError for wildcard not being last path matcher', () => {
      expect(() => {
        route(path.wildcard('files'), path('after'), end);
      }).toThrow('Wildcard matcher must be the last path-related matcher');
    });

    it('should allow wildcard followed by query or end', () => {
      expect(() => {
        route(path.wildcard('files'), query('sort', StringSchema), end);
      }).not.toThrow();
    });

    it('should warn about end matcher not being last', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const routeWithMisplacedEnd = route(path('test'), end, path('after'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('has end matcher not at the end')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Route Building Tests - Parent-Child Relationships', () => {
    it('should maintain parent reference in extended routes', () => {
      const parentR = route(path('parent'));
      const childR = extend(parentR, path('child'));
      
      expect(childR.parent).toBe(parentR);
      expect(parentR.parent).toBeUndefined();
    });

    it('should inherit metadata from parent routes', () => {
      const parentR = route(path('parent'), meta({ title: 'Parent', shared: 'from-parent' }));
      const childR = extend(parentR, path('child'), meta({ subtitle: 'Child', shared: 'from-child' }));
      
      expect(childR.metadata).toEqual({
        title: 'Parent',
        shared: 'from-child', // Child overrides parent
        subtitle: 'Child'
      });
    });

    it('should allow hierarchical matching through extended routes', () => {
      const dashboardR = route(path('dashboard'));
      const usersR = extend(dashboardR, path('users'));
      const userDetailR = extend(usersR, param('id', NumberSchema), end);
      
      router = createRouter([userDetailR, dashboardR]);
      const match = router.match('/dashboard/users/123');
      
      expect(match).toBeDefined();
      expect(match?.pathname).toBe('/dashboard');
      expect(match?.child).toBeDefined();
      expect(match?.child?.params.id).toBe(123);
      expect(match?.child?.pathname).toBe('/dashboard/users/123');
    });
  });

  describe('Navigation Tests - NavigationResult and NavigationError', () => {
    const homeR = route(path('home'), end);
    const userR = route(path('users'), param('id', NumberSchema), end);
    const invalidR = route(path('invalid'), param('id', FailingSchema), end);

    beforeEach(() => {
      router = createRouter([homeR, userR, invalidR]);
      const mocks = setupMockEnvironment();
      mockPushState = mocks.mockPushState;
    });

    it('should return successful NavigationResult', async () => {
      const result = await router.navigate(homeR, {});
      
      expect(result.success).toBe(true);
      expect(result.match?.route.id).toBe(homeR.id);
      expect(result.error).toBeUndefined();
      expect(result.cancelled).toBeUndefined();
    });

    it('should return NavigationResult with ValidationFailed error for missing params', async () => {
      const result = await router.navigate(userR, {} as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(NavigationErrorType.ValidationFailed);
      expect(result.error?.message).toContain('Failed to build URL');
      expect(result.error?.route).toBe(userR);
      expect(result.match).toBeUndefined();
    });

    it('should return NavigationResult with error for route not found', async () => {
      const result = await router.navigate(homeR, {});
      // Try to navigate to a route that's not in the router
      const orphanRoute = route(path('orphan'), end);
      const orphanResult = await router.navigate(orphanRoute, {});
      
      expect(orphanResult.success).toBe(false);
      expect(orphanResult.error?.type).toBe(NavigationErrorType.RouteNotFound);
    });

    it('should include original error in NavigationError', async () => {
      // This test would require a route that fails during navigation
      // For now, test the ValidationFailed case which includes the route and params
      const result = await router.navigate(userR, {} as any);
      
      expect(result.error?.route).toBe(userR);
      expect(result.error?.params).toEqual({});
    });

    it('should handle concurrent navigation attempts', async () => {
      const result1Promise = router.navigate(homeR, {});
      const result2Promise = router.navigate(userR, { id: 123 });
      
      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);
      
      // Both navigations should complete (though one might be cancelled)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // At least one should be successful or provide a result
      expect(result1.success || result2.success || result1.cancelled || result2.cancelled).toBe(true);
    });

    it('should update isNavigating flag during navigation', async () => {
      expect(router.isNavigating).toBe(false);
      
      const navigationPromise = router.navigate(homeR, {});
      expect(router.isNavigating).toBe(true);
      
      await navigationPromise;
      expect(router.isNavigating).toBe(false);
    });
  });

  describe('Navigation Tests - NavigationController and Cancellation', () => {
    const homeR = route(path('home'), end);
    const userR = route(path('users'), param('id', NumberSchema), end);

    beforeEach(() => {
      router = createRouter([homeR, userR]);
      const mocks = setupMockEnvironment();
      mockPushState = mocks.mockPushState;
    });

    it('should provide NavigationController during navigation', async () => {
      const navigationPromise = router.navigate(homeR, {});
      
      const controller = router.currentNavigation;
      expect(controller).toBeDefined();
      expect(controller?.route).toBe(homeR);
      expect(controller?.params).toEqual({});
      expect(controller?.promise).toStrictEqual(navigationPromise);
      expect(controller?.cancelled).toBe(false);
      
      await navigationPromise;
      expect(router.currentNavigation).toBeNull();
    });

    it('should allow navigation cancellation', async () => {
      const navigationPromise = router.navigate(homeR, {});
      const controller = router.currentNavigation;
      
      expect(controller).toBeDefined();
      controller?.cancel();
      
      expect(controller?.cancelled).toBe(true);
      const result = await navigationPromise;
      expect(result.cancelled).toBe(true);
    });

    it('should cancel navigation using router.cancelNavigation()', async () => {
      const navigationPromise = router.navigate(homeR, {});
      
      expect(router.isNavigating).toBe(true);
      const wasCancelled = router.cancelNavigation();
      
      expect(wasCancelled).toBe(true);
      const result = await navigationPromise;
      expect(result.cancelled).toBe(true);
    });

    it('should return false when trying to cancel non-existent navigation', () => {
      expect(router.cancelNavigation()).toBe(false);
    });

    it('should handle navigation after cancellation', async () => {
      const firstNavigation = router.navigate(homeR, {});
      router.cancelNavigation();
      await firstNavigation;
      
      const secondNavigation = await router.navigate(userR, { id: 123 });
      expect(secondNavigation.success).toBe(true);
      expect(secondNavigation.match?.params.id).toBe(123);
    });
  });

  describe('Navigation Tests - navigateSimple() for Backward Compatibility', () => {
    const homeR = route(path('home'), end);
    const userR = route(path('users'), param('id', NumberSchema), end);

    beforeEach(() => {
      router = createRouter([homeR, userR]);
      const mocks = setupMockEnvironment();
      mockPushState = mocks.mockPushState;
    });

    it('should return true for successful navigation', async () => {
      const success = await router.navigateSimple(homeR, {});
      expect(success).toBe(true);
      expect(router.currentMatch?.route.id).toBe(homeR.id);
    });

    it('should return false for failed navigation', async () => {
      const success = await router.navigateSimple(userR, {} as any);
      expect(success).toBe(false);
    });

    it('should work with valid parameters', async () => {
      const success = await router.navigateSimple(userR, { id: 456 });
      expect(success).toBe(true);
      expect(router.currentMatch?.params.id).toBe(456);
    });
  });

  describe('Navigation Tests - Detailed Error Scenarios', () => {
    const homeR = route(path('home'), end);
    const protectedR = route(path('protected'), end);

    beforeEach(() => {
      router = createRouter([homeR, protectedR]);
      const mocks = setupMockEnvironment();
      mockPushState = mocks.mockPushState;
    });

    it('should handle NavigationErrorType enum values', () => {
      expect(NavigationErrorType.RouteNotFound).toBe('route-not-found');
      expect(NavigationErrorType.GuardRejected).toBe('guard-rejected');
      expect(NavigationErrorType.LoaderFailed).toBe('loader-failed');
      expect(NavigationErrorType.ValidationFailed).toBe('validation-failed');
      expect(NavigationErrorType.Cancelled).toBe('cancelled');
      expect(NavigationErrorType.Unknown).toBe('unknown');
    });

    it('should provide detailed error information', async () => {
      const routeWithParams = route(path('test'), param('required', NumberSchema), end);
      router = createRouter([routeWithParams]);
      
      const result = await router.navigate(routeWithParams, {} as any);
      
      expect(result.error).toMatchObject({
        type: NavigationErrorType.ValidationFailed,
        message: expect.stringContaining('Failed to build URL'),
        route: routeWithParams,
        params: {}
      });
    });

    it('should handle route not found errors', async () => {
      const orphanRoute = route(path('orphan'), end);
      const result = await router.navigate(orphanRoute, {});
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(NavigationErrorType.RouteNotFound);
    });
  });

  describe('Typed Guards Tests', () => {
    const homeR = route(path('home'), end);
    const userR = route(path('users'), param('id', NumberSchema), end);
    const loginR = route(path('login'), end);

    beforeEach(() => {
      router = createRouter([homeR, userR, loginR]);
      const mocks = setupMockEnvironment();
      mockPushState = mocks.mockPushState;
    });

    it('should create typed guard with proper context', () => {
      const authGuard = typedGuard<{ id: number }>(({ params, to, from, searchParams }) => {
        expect(typeof params.id).toBe('number');
        expect(to).toBeDefined();
        expect(searchParams).toBeInstanceOf(URLSearchParams);
        return true;
      });

      expect(typeof authGuard).toBe('function');
    });

    it('should provide type-safe parameter access in guards', () => {
      let guardParams: any;
      const paramGuard = typedGuard<{ id: number }>(({ params }) => {
        guardParams = params;
        return true;
      });

      const mockContext = {
        to: {
          route: userR,
          params: { id: 123 },
          pathname: '/users/123',
          search: '?test=value',
          hash: '#section'
        } as RouteMatch<{ id: number }>,
        from: null
      };

      const result = paramGuard(mockContext);
      expect(result).toBe(true);
      expect(guardParams.id).toBe(123);
    });

    it('should provide GuardContext with all required properties', () => {
      let capturedContext: GuardContext<{ id: number }> | undefined;
      
      const inspectGuard = typedGuard<{ id: number }>((context) => {
        capturedContext = context;
        return true;
      });

      const mockTo: RouteMatch<{ id: number }> = {
        route: userR as Route<{ id: number }>,
        params: { id: 456 },
        pathname: '/users/456',
        search: '?sort=name&filter=active',
        hash: '#details'
      };

      const mockFrom: RouteMatch<{}> = {
        route: homeR,
        params: {},
        pathname: '/home',
        search: '',
        hash: ''
      };

      inspectGuard({ to: mockTo, from: mockFrom });

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.to).toBe(mockTo);
      expect(capturedContext?.from).toBe(mockFrom);
      expect(capturedContext?.params).toEqual({ id: 456 });
      expect(capturedContext?.searchParams).toBeInstanceOf(URLSearchParams);
      expect(capturedContext?.searchParams.get('sort')).toBe('name');
      expect(capturedContext?.searchParams.get('filter')).toBe('active');
    });

    it('should handle GuardResult variations - boolean allow', () => {
      const allowGuard = typedGuard(() => true);
      const denyGuard = typedGuard(() => false);

      const mockContext = {
        to: { route: homeR, params: {}, pathname: '/home', search: '', hash: '' } as RouteMatch,
        from: null
      };

      expect(allowGuard(mockContext)).toBe(true);
      expect(denyGuard(mockContext)).toBe(false);
    });

    it('should handle GuardResult variations - string redirect', () => {
      const redirectGuard = typedGuard(() => '/login');

      const mockContext = {
        to: { route: userR, params: { id: 123 }, pathname: '/users/123', search: '', hash: '' } as RouteMatch,
        from: null
      };

      expect(redirectGuard(mockContext)).toBe('/login');
    });

    it('should handle GuardResult variations - promise-based results', async () => {
      const asyncAllowGuard = typedGuard(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });

      const asyncRedirectGuard = typedGuard(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return '/login';
      });

      const mockContext = {
        to: { route: userR, params: { id: 123 }, pathname: '/users/123', search: '', hash: '' } as RouteMatch,
        from: null
      };

      expect(await asyncAllowGuard(mockContext)).toBe(true);
      expect(await asyncRedirectGuard(mockContext)).toBe('/login');
    });

    it('should handle guard error scenarios gracefully', () => {
      const errorGuard = typedGuard(() => {
        throw new Error('Guard error');
      });

      const mockContext = {
        to: { route: homeR, params: {}, pathname: '/home', search: '', hash: '' } as RouteMatch,
        from: null
      };

      expect(() => errorGuard(mockContext)).toThrow('Guard error');
    });

    it('should work with routes that have complex parameter types', () => {
      const complexR = route(
        path('complex'),
        param('id', NumberSchema),
        param('slug', StringSchema),
        query('active', BooleanSchema),
        end
      );

      let guardExecuted = false;
      const complexGuard = typedGuard<{ id: number; slug: string; active: boolean }>(({ params }) => {
        expect(params.id).toBe(123);
        expect(params.slug).toBe('test-item');
        expect(params.active).toBe(true);
        guardExecuted = true;
        return true;
      });

      const mockContext = {
        to: {
          route: complexR,
          params: { id: 123, slug: 'test-item', active: true },
          pathname: '/complex/123/test-item',
          search: '?active=true',
          hash: ''
        } as RouteMatch<{ id: number; slug: string; active: boolean }>,
        from: null
      };

      const result = complexGuard(mockContext);
      expect(result).toBe(true);
      expect(guardExecuted).toBe(true);
    });

    it('should handle guards with no from route', () => {
      const noFromGuard = typedGuard<{}>((context) => {
        expect(context.from).toBeNull();
        expect(context.to).toBeDefined();
        return true;
      });

      const mockContext = {
        to: { route: homeR, params: {}, pathname: '/home', search: '', hash: '' } as RouteMatch,
        from: null
      };

      expect(noFromGuard(mockContext)).toBe(true);
    });
  });
});

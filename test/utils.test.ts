/// <reference types="vitest/globals" />
/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  createRouter,
  route,
  path,
  param, // Added param for userRoute
  query, // Added query for userRoute
  end,   // Added missing import
  extend, // Added missing import
  CombiRouter,
  type Route,
  type RouteMatch,
  type StandardSchemaV1,
  // Utils being tested:
  createLink,
  createActiveLink,
  attachNavigator,
  createOutlet,
  createMatcher,
  createRouterStore,
} from '../src'; 

// DOM setup for each test
let dom: JSDOM;
let window: Window;
let document: Document;

// Mock StandardSchema for testing utils that might involve params
const MockStringSchema: StandardSchemaV1<unknown, string> = {
  '~standard': {
    version: 1,
    vendor: 'test-utils',
    validate: (value: unknown) => {
      if (typeof value === 'string') return { value };
      if (value === undefined || value === null) return { value: '' }; // Handle undefined/null gracefully for build
      return { issues: [{ message: 'Must be a string' }] };
    },
    types: { input: '' as unknown, output: '' as string },
  },
};

const MockNumberSchema: StandardSchemaV1<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'test-utils',
    validate: (value: unknown) => {
      const num = Number(value);
      if (typeof value === 'number' || (typeof value === 'string' && !isNaN(num) && value.trim() !== '')) {
        return { value: num };
      }
      if (value === undefined || value === null) return { value: 0 }; // Handle undefined/null
      return { issues: [{ message: 'Must be a number' }] };
    },
    types: { input: 0 as unknown, output: 0 as number },
  },
};


describe('CombiRouter Utilities (src/utils.ts)', () => {
  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/' });
    window = dom.window as unknown as Window;
    document = dom.window.document;

    // Make window and document global for tests
    // @ts-expect-error - JSDOM window type compatibility
    global.window = window;
    global.document = document;
    global.HTMLElement = dom.window.HTMLElement;
    global.MouseEvent = dom.window.MouseEvent;
    global.CustomEvent = dom.window.CustomEvent;
    global.URLSearchParams = dom.window.URLSearchParams;
     // Mock requestAnimationFrame if any utils indirectly rely on it (e.g., via UI library integrations not present here but good practice)
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);

    // Mock history API
    global.window.history.pushState = vi.fn();
    global.window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    delete global.window;
    // @ts-ignore
    delete global.document;
    // @ts-ignore
    delete global.HTMLElement;
    // @ts-ignore
    delete global.MouseEvent;
    // @ts-ignore
    delete global.CustomEvent;
    // @ts-ignore
    delete global.URLSearchParams;
    // @ts-ignore
    delete global.requestAnimationFrame;
    // @ts-ignore
    delete global.cancelAnimationFrame;
    
    // Close JSDOM window if it was created and window is still the JSDOM window
    // @ts-expect-error - JSDOM window type compatibility
    if (dom && dom.window && typeof dom.window.close === 'function' && global.window === dom.window) {
      // @ts-expect-error - JSDOM window type compatibility
      dom.window.close();
    }

    // Only delete globals if they were set by this suite's beforeEach
    // This requires checking if they are the same instances set up by JSDOM
    // For simplicity, if global.window exists and has a 'close' method (JSDOM specific), assume it's ours to clean.
    // @ts-ignore
    if (global.window && global.window.close) { // Heuristic for JSDOM window
        // @ts-ignore
        delete global.window;
        // @ts-ignore
        delete global.document; // document is typically tied to window
        // @ts-ignore
        delete global.navigator; // navigator is also tied to window
        // @ts-ignore
        delete global.HTMLElement;
        // @ts-ignore
        delete global.HTMLAnchorElement;
         // @ts-ignore
        delete global.MouseEvent;
         // @ts-ignore
        delete global.CustomEvent;
         // @ts-ignore
        delete global.URLSearchParams;
    }
    dom = undefined as any; // Clear reference to JSDOM instance
  });
  
  // Helper to create a router instance for utils tests
  const createMockRouter = (initialMatch: RouteMatch<any> | null = null): any => {
    const mockRouter = {
      currentMatch: initialMatch,
      isNavigating: false,
      isFetching: false,
      routes: [],
      context: {},
      currentNavigation: null,
      isOnline: true,
      navigate: vi.fn().mockResolvedValue(true),
      replace: vi.fn().mockResolvedValue(true),
      build: vi.fn((routeToDo, paramsToBuild) => {
          // Simple build mock: /routePathname?param1=value1
          let path = routeToDo.matchers.filter((m: any) => m.type === 'path' || m.type === 'param').reduce((acc: any, m: any) => {
              if (m.type === 'path') return acc + m.build({}); // Static path parts
              if (m.paramName && paramsToBuild[m.paramName]) return acc + `/${paramsToBuild[m.paramName]}`;
              return acc;
          }, '');
          if (!path.startsWith('/')) path = '/' + path;
          
          const queryParams: string[] = [];
          for(const matcher of routeToDo.matchers) {
              if(matcher.type === 'query' && matcher.paramName && paramsToBuild[matcher.paramName] !== undefined) {
                  queryParams.push(`${matcher.paramName}=${encodeURIComponent(paramsToBuild[matcher.paramName])}`);
              }
          }
          return path + (queryParams.length ? `?${queryParams.join('&')}` : '');
      }),
      match: vi.fn(),
      subscribe: vi.fn(listener => {
        listener(mockRouter.currentMatch); // Call immediately like the real one
        return vi.fn(); // Return an unsubscribe function
      }),
      unsubscribe: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      destroy: vi.fn(),
      addRoute: vi.fn(),
      removeRoute: vi.fn(),
      navigateToURL: vi.fn(),
      cancelNavigation: vi.fn(),
      addNavigationGuard: vi.fn(),
      removeNavigationGuard: vi.fn(),
      addDataLoader: vi.fn(),
      removeDataLoader: vi.fn(),
      addErrorHandler: vi.fn(),
      removeErrorHandler: vi.fn(),
      isInitialized: true
    };
    return mockRouter;
  };

  // Define some mock routes for utils
  const homeRoute = route(path('home'), end);
  const aboutRoute = route(path('about'), end);
  const userRoute = route(path('users'), param('id', MockStringSchema), query.optional('tab', MockStringSchema), end);


  describe('createLink()', () => {
    it('should create an anchor element with correct href', () => {
      const mockRouter = createMockRouter();
      const { element } = createLink(mockRouter, homeRoute, {}, {});
      expect(element.tagName).toBe('A');
      expect(element.getAttribute('href')).toBe('/home');
      expect(mockRouter.build).toHaveBeenCalledWith(homeRoute, {});
    });

    it('should set children, className, and attributes', () => {
      const mockRouter = createMockRouter();
      const childNode = document.createElement('span');
      childNode.textContent = 'Home';
      const { element } = createLink(mockRouter, homeRoute, {}, {
        children: [childNode, ' Link'],
        className: 'my-link',
        attributes: { 'data-testid': 'home-link', 'aria-label': 'Navigate Home' },
      });
      expect(element.textContent).toBe('Home Link');
      expect(element.classList.contains('my-link')).toBe(true);
      expect(element.getAttribute('data-testid')).toBe('home-link');
      expect(element.getAttribute('aria-label')).toBe('Navigate Home');
    });

    it('should call router.navigate on click', () => {
      const mockRouter = createMockRouter();
      const params = { id: '123', tab: 'profile' };
      const { element } = createLink(mockRouter, userRoute, params, {});
      
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(mockRouter.navigate).toHaveBeenCalledWith(userRoute, params);
    });

    it('should not call router.navigate on click if modifier keys are pressed', () => {
      const mockRouter = createMockRouter();
      const { element } = createLink(mockRouter, homeRoute, {}, {});
      
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 1 })); // Middle click
      
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('destroy function should remove click listener', () => {
      const mockRouter = createMockRouter();
      const { element, destroy } = createLink(mockRouter, homeRoute, {}, {});
      const spyRemove = vi.spyOn(element, 'removeEventListener');
      
      destroy();
      expect(spyRemove).toHaveBeenCalledWith('click', expect.any(Function));
      
      // After destroy, click should not navigate
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      spyRemove.mockRestore();
    });
     it('should throw if router.build returns null', () => {
      const mockRouter = createMockRouter();
      mockRouter.build = vi.fn().mockReturnValue(null); // Force build to fail
      expect(() => createLink(mockRouter, homeRoute, {}, {}))
        .toThrow('[createLink] Failed to build href for route. A required parameter may be missing.');
    });
  });

  describe('createActiveLink()', () => {
    it('should apply activeClassName when route is active (exact: false by default)', () => {
      const mockUserMatch: RouteMatch = { route: userRoute, params: {id: '1'}, pathname: '/users/1', search:'', hash:'' };
      const mockRouter = createMockRouter(mockUserMatch); // Current route is /users/1
      
      const { element } = createActiveLink(mockRouter, userRoute, {id:'1'}, { activeClassName: 'active' });
      expect(element.classList.contains('active')).toBe(true);
    });
    
    it('should apply activeClassName for parent route if current route is a child (exact: false)', () => {
        const parentRoute = route(path('parent'), end);
        const childRoute = extend(parentRoute, path('child'), end);
        const mockChildMatch: RouteMatch = { 
            route: parentRoute, params: {}, pathname: '/parent', search: '', hash: '',
            child: { route: childRoute, params: {}, pathname: '/parent/child', search: '', hash: '' }
        };
        const mockRouter = createMockRouter(mockChildMatch); // Current is /parent/child

        const { element } = createActiveLink(mockRouter, parentRoute, {}, { activeClassName: 'active-parent' });
        expect(element.classList.contains('active-parent')).toBe(true); // parentRoute should be active
    });

    it('should NOT apply activeClassName if route is not active', () => {
      const mockHomeMatch: RouteMatch = { route: homeRoute, params: {}, pathname: '/home', search:'', hash:'' };
      const mockRouter = createMockRouter(mockHomeMatch);
      
      const { element } = createActiveLink(mockRouter, userRoute, {id:'1'}, { activeClassName: 'active' });
      expect(element.classList.contains('active')).toBe(false);
    });

    it('should apply activeClassName for exact match if exact is true', () => {
      const parentRoute = route(path('parent')); // No end
      const childRoute = extend(parentRoute, path('child'), end);

      const mockChildMatch: RouteMatch = { 
        route: parentRoute, params: {}, pathname: '/parent', search: '', hash: '',
        child: { route: childRoute, params: {}, pathname: '/parent/child', search: '', hash: '' }
      };
      const mockRouter = createMockRouter(mockChildMatch);

      // Link to parent, current is child, exact=true -> parent link NOT active
      const { element: parentLink } = createActiveLink(mockRouter, parentRoute, {}, { activeClassName: 'active-exact', exact: true });
      expect(parentLink.classList.contains('active-exact')).toBe(false);
      
      // Link to child, current is child, exact=true -> child link IS active
      const { element: childLink } = createActiveLink(mockRouter, childRoute, {}, { activeClassName: 'active-exact', exact: true });
      expect(childLink.classList.contains('active-exact')).toBe(true);
    });

    it('should update active class on route change', () => {
      const mockRouter = createMockRouter(null); // Start with no match
      const { element } = createActiveLink(mockRouter, homeRoute, {}, { activeClassName: 'active-route' });
      expect(element.classList.contains('active-route')).toBe(false);

      // Simulate route change by manually calling the listener router.subscribe passed
      const subscribeCall = (mockRouter.subscribe as any).mock.calls[0];
      const routeChangeListener = subscribeCall[0] as (match: RouteMatch | null) => void;
      
      const homeMatch: RouteMatch = { route: homeRoute, params: {}, pathname: '/home', search:'', hash:'' };
      routeChangeListener(homeMatch); // Simulate navigating to homeRoute
      expect(element.classList.contains('active-route')).toBe(true);

      routeChangeListener(null); // Simulate navigating away
      expect(element.classList.contains('active-route')).toBe(false);
    });

    it('destroy function should unsubscribe from router', () => {
      const mockRouter = createMockRouter();
      const mockUnsubscribe = vi.fn();
      (mockRouter.subscribe as any).mockReturnValue(mockUnsubscribe); // Ensure subscribe returns our mock unsubscribe

      const { destroy } = createActiveLink(mockRouter, homeRoute, {}, { activeClassName: 'active' });
      destroy();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should not apply activeClassName if activeClassName is not provided', () => {
      const mockHomeMatch: RouteMatch = { route: homeRoute, params: {}, pathname: '/home', search:'', hash:'' };
      const mockRouter = createMockRouter(mockHomeMatch);
      const { element } = createActiveLink(mockRouter, homeRoute, {}, {}); // No activeClassName
      expect(element.className).toBe(''); // No classes should be added
    });
  });

  describe('attachNavigator()', () => {
    it('should attach click listener that calls router.navigate', () => {
      const mockRouter = createMockRouter();
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      attachNavigator(div, mockRouter, homeRoute, {});
      div.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(homeRoute, {});
      document.body.removeChild(div);
    });

    it('destroy function should remove click listener', () => {
      const mockRouter = createMockRouter();
      const button = document.createElement('button');
      document.body.appendChild(button);
      const spyRemove = vi.spyOn(button, 'removeEventListener');

      const { destroy } = attachNavigator(button, mockRouter, homeRoute, {});
      destroy();
      
      expect(spyRemove).toHaveBeenCalledWith('click', expect.any(Function));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      spyRemove.mockRestore();
      document.body.removeChild(button);
    });
  });

  describe('createOutlet()', () => {
    let outletContainer: HTMLElement;
    let mockRouter: CombiRouter;

    // Mock view factories
    const viewFactoryHome = vi.fn(match => {
        const el = document.createElement('div');
        el.id = 'home-view';
        el.textContent = `Home View: ${JSON.stringify(match.params)}`;
        return el;
    });
    const viewFactoryUser = vi.fn(match => {
        const el = document.createElement('div');
        el.id = 'user-view';
        el.textContent = `User View: ${match.params.id}`;
        return el;
    });
    const viewFactoryAbout = vi.fn(match => {
        const el = document.createElement('div');
        el.id = 'about-view';
        return el;
    });
    
    const appRoute = route(path('app')); // Parent for outlet
    const appHomeRoute = extend(appRoute, path('home'), end);
    const appUserRoute = extend(appRoute, path('users'), param('id', MockStringSchema), end);
    const appAboutRoute = extend(appRoute, path('about'), end);


    beforeEach(() => {
      outletContainer = document.createElement('div');
      outletContainer.id = 'outlet';
      document.body.appendChild(outletContainer);
      
      viewFactoryHome.mockClear();
      viewFactoryUser.mockClear();
      viewFactoryAbout.mockClear();
    });

    afterEach(() => {
      if (outletContainer.parentNode) {
        outletContainer.parentNode.removeChild(outletContainer);
      }
    });

    it('should render the correct view based on initial child route', () => {
      const initialUserMatch: RouteMatch = { 
        route: appRoute, params: {}, pathname: '/app', search:'', hash:'',
        child: { route: appUserRoute, params: {id: '42'}, pathname: '/app/users/42', search:'', hash:'' }
      };
      mockRouter = createMockRouter(initialUserMatch);

      createOutlet(mockRouter, appRoute, outletContainer, [
        [appHomeRoute, viewFactoryHome],
        [appUserRoute, viewFactoryUser],
      ]);

      expect(viewFactoryUser).toHaveBeenCalledTimes(1);
      expect(outletContainer.querySelector('#user-view')).not.toBeNull();
      expect(outletContainer.textContent).toContain('User View: 42');
      expect(viewFactoryHome).not.toHaveBeenCalled();
    });

    it('should switch views when route changes', () => {
      mockRouter = createMockRouter(null); // Start with no match initially for outlet
      const { destroy } = createOutlet(mockRouter, appRoute, outletContainer, [
        [appHomeRoute, viewFactoryHome],
        [appUserRoute, viewFactoryUser],
      ]);

      const subscribeCall = (mockRouter.subscribe as any).mock.calls[0];
      const routeChangeListener = subscribeCall[0] as (match: RouteMatch | null) => void;

      // Simulate navigate to home
      const homeMatch: RouteMatch = { 
        route: appRoute, params: {}, pathname: '/app', search:'', hash:'',
        child: { route: appHomeRoute, params: {}, pathname: '/app/home', search:'', hash:'' }
      };
      routeChangeListener(homeMatch);
      expect(viewFactoryHome).toHaveBeenCalledTimes(1);
      expect(outletContainer.querySelector('#home-view')).not.toBeNull();
      expect(outletContainer.querySelector('#user-view')).toBeNull();

      // Simulate navigate to user
      const userMatch: RouteMatch = { 
        route: appRoute, params: {}, pathname: '/app', search:'', hash:'',
        child: { route: appUserRoute, params: {id: '100'}, pathname: '/app/users/100', search:'', hash:'' }
      };
      routeChangeListener(userMatch);
      expect(viewFactoryUser).toHaveBeenCalledTimes(1);
      expect(outletContainer.querySelector('#user-view')).not.toBeNull();
      expect(outletContainer.querySelector('#home-view')).toBeNull(); // Old view removed
      expect(outletContainer.textContent).toContain('User View: 100');
      
      destroy();
    });

    it('should clear view if no child route matches', () => {
        const initialHomeMatch: RouteMatch = { 
            route: appRoute, params: {}, pathname: '/app', search:'', hash:'',
            child: { route: appHomeRoute, params: {}, pathname: '/app/home', search:'', hash:'' }
        };
        mockRouter = createMockRouter(initialHomeMatch);
        createOutlet(mockRouter, appRoute, outletContainer, [[appHomeRoute, viewFactoryHome]]);
        expect(outletContainer.querySelector('#home-view')).not.toBeNull();

        const subscribeCall = (mockRouter.subscribe as any).mock.calls[0];
        const routeChangeListener = subscribeCall[0] as (match: RouteMatch | null) => void;

        // Simulate navigating to a state where parent matches but no configured child for outlet
        const parentOnlyMatch: RouteMatch = { route: appRoute, params: {}, pathname: '/app', search:'', hash:'' }; // No child
        routeChangeListener(parentOnlyMatch);
        expect(outletContainer.innerHTML).toBe(''); // Outlet cleared
    });
    
    it('should do nothing if the parent route itself is not part of the current match', () => {
        mockRouter = createMockRouter(null); // Not on appRoute
        createOutlet(mockRouter, appRoute, outletContainer, [[appHomeRoute, viewFactoryHome]]);
        
        const subscribeCall = (mockRouter.subscribe as any).mock.calls[0];
        const routeChangeListener = subscribeCall[0] as (match: RouteMatch | null) => void;

        const otherRoute = route(path('other'),end);
        const otherMatch: RouteMatch = { route: otherRoute, params:{}, pathname:'/other', search:'', hash:''};
        routeChangeListener(otherMatch); // Navigate to a completely different route

        expect(viewFactoryHome).not.toHaveBeenCalled(); // Initial call from subscribe might occur if router.currentMatch was set
        expect(outletContainer.innerHTML).toBe('');
    });

    it('destroy function should unsubscribe from router', () => {
      const mockUnsubscribe = vi.fn();
      mockRouter = createMockRouter(null);
      (mockRouter.subscribe as any).mockReturnValue(mockUnsubscribe);
      
      const { destroy } = createOutlet(mockRouter, appRoute, outletContainer, []);
      destroy();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMatcher()', () => {
    let mockRouter: CombiRouter;
    const cbHome = vi.fn();
    const cbUser = vi.fn();
    const cbOtherwise = vi.fn();

    beforeEach(() => {
      cbHome.mockClear();
      cbUser.mockClear();
      cbOtherwise.mockClear();
      mockRouter = createMockRouter(null);
    });

    it('should call the correct callback when a route matches', () => {
      createMatcher(mockRouter)
        .when(homeRoute, cbHome)
        .when(userRoute, cbUser)
        .otherwise(cbOtherwise);
      
      cbOtherwise.mockClear(); // Clear the initial call from subscribe()

      const subscribeCall = (mockRouter.subscribe as any).mock.calls[0][0];
      
      const homeMatch: RouteMatch = { route: homeRoute, params: {}, pathname: '/home', search:'', hash:'' };
      subscribeCall(homeMatch);
      expect(cbHome).toHaveBeenCalledWith(homeMatch);
      expect(cbUser).not.toHaveBeenCalled();
      expect(cbOtherwise).not.toHaveBeenCalled();

      cbHome.mockClear();
      const userMatch: RouteMatch = { route: userRoute, params: {id:'1'}, pathname: '/users/1', search:'', hash:'' };
      subscribeCall(userMatch);
      expect(cbUser).toHaveBeenCalledWith(userMatch);
      expect(cbHome).not.toHaveBeenCalled();
      expect(cbOtherwise).not.toHaveBeenCalled();
    });

    it('should call otherwise callback if no when-condition matches', () => {
      createMatcher(mockRouter)
        .when(homeRoute, cbHome)
        .otherwise(cbOtherwise);
      
      const subscribeCall = (mockRouter.subscribe as any).mock.calls[0][0];
      const aboutMatch: RouteMatch = { route: aboutRoute, params: {}, pathname: '/about', search:'', hash:'' };
      subscribeCall(aboutMatch); // aboutRoute is not in .when()

      expect(cbOtherwise).toHaveBeenCalledWith(aboutMatch);
      expect(cbHome).not.toHaveBeenCalled();
    });
    
    it('should call otherwise with null if currentMatch is null', () => {
       createMatcher(mockRouter)
        .when(homeRoute, cbHome)
        .otherwise(cbOtherwise);
      
      const subscribeCall = (mockRouter.subscribe as any).mock.calls[0][0];
      subscribeCall(null); // Simulate no match

      expect(cbOtherwise).toHaveBeenCalledWith(null);
      expect(cbHome).not.toHaveBeenCalled();
    });

    it('destroy function from otherwise() should unsubscribe', () => {
      const mockUnsubscribe = vi.fn();
      (mockRouter.subscribe as any).mockReturnValue(mockUnsubscribe);

      const { destroy } = createMatcher(mockRouter).otherwise(() => {});
      destroy();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRouterStore()', () => {
    let mockRouter: any;

    beforeEach(() => {
        // For store tests, we need a router that can have its properties changed
        // and can simulate the navigate monkey-patching.
        mockRouter = createMockRouter(); // Use the mutable mock router
        mockRouter.routes = [homeRoute, userRoute];
    });

    it('should initialize with current router state', () => {
      mockRouter.currentMatch = { route: homeRoute, params: {}, pathname: '/home', search:'', hash:'' };
      mockRouter.isNavigating = true;
      mockRouter.isFetching = false;

      const store = createRouterStore(mockRouter);
      const snapshot = store.getSnapshot();

      expect(snapshot.match).toEqual(mockRouter.currentMatch);
      expect(snapshot.isNavigating).toBe(true);
      expect(snapshot.isFetching).toBe(false);
    });

    it('should update snapshot and notify listeners on router.currentMatch change', () => {
      const store = createRouterStore(mockRouter);
      const listener = vi.fn();
      store.subscribe(listener);
      listener.mockClear(); // Clear initial call from subscribe

      // Simulate router.currentMatch changing (e.g. after a navigation)
      // This is normally done by router.navigate -> _notifyListeners
      // We'll manually trigger the notification path for isolated store testing:
      mockRouter.currentMatch = { route: userRoute, params: {id:'1'}, pathname: '/users/1', search:'', hash:'' };
      
      // Manually call the update function that router's subscribe would trigger in the store
      const routerSubscribeCall = (mockRouter.subscribe as any);
      // The store's internal update function is what's passed to router.subscribe().
      // We need to find that specific listener.
      // This is a bit of an integration test due to the tight coupling.
      // For a pure unit test of the store, we'd mock router.subscribe more deeply.
      // Let's assume the store's update is one of the listeners.
      // A simpler way: _notifyListeners is called by the router. If we can call that.
      // The store's update function is `update` inside createRouterStore.
      // Let's simulate the effect of _notifyListeners:
      (mockRouter as any)._notifyListeners();


      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().match?.route.id).toBe(userRoute.id);
    });

    it('should update isNavigating via navigate wrapper and notify', async () => {
      const store = createRouterStore(mockRouter);
      const listener = vi.fn();
      store.subscribe(listener);
      listener.mockClear();

      // The store wraps router.navigate. Calling the wrapped version.
      const navigatePromise = mockRouter.navigate(homeRoute, {}); // This is the wrapped navigate

      // isNavigating should be true immediately after call, before promise resolves
      expect(store.getSnapshot().isNavigating).toBe(true);
      expect(listener).toHaveBeenCalled(); // Should be notified of isNavigating change
      listener.mockClear();

      await navigatePromise; // Wait for original navigate to finish

      expect(store.getSnapshot().isNavigating).toBe(false);
      // It should be called again when isNavigating becomes false
      // and potentially when currentMatch updates, depending on timing.
      expect(listener).toHaveBeenCalled(); 
    });
    
    it('store.destroy should restore original router.navigate', () => {
      // 1. Create a clean router instance
      const cleanRouter = createRouter([]);
      // 2. Save its truly original navigate method BEFORE any mocking or wrapping
      const trulyOriginalNav = cleanRouter.navigate;

      // Ensure the original navigate is indeed an async function for the assertion to make sense
      expect(trulyOriginalNav.constructor.name).toBe('AsyncFunction');

      // 3. Pass this cleanRouter to createRouterStore.
      // createRouterStore will wrap cleanRouter.navigate
      const store = createRouterStore(cleanRouter);
      const wrappedNavigate = cleanRouter.navigate;

      // Verify that navigate has been wrapped
      expect(wrappedNavigate).not.toBe(trulyOriginalNav);
      // Also check that the wrapped function is still async (or appears to be)
      expect(wrappedNavigate.constructor.name).toBe('AsyncFunction');

      // 4. Call destroy
      if ((store as any).destroy) (store as any).destroy();

      // 5. Assert that cleanRouter.navigate is restored to the truly original navigate
      expect(cleanRouter.navigate).toBe(trulyOriginalNav);
    });

     it('unsubscribe should remove a specific listener', () => {
      const store = createRouterStore(mockRouter);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = store.subscribe(listener1);
      store.subscribe(listener2);
      
      listener1.mockClear();
      listener2.mockClear();

      unsubscribe1(); // Unsubscribe listener1

      // Simulate a change that would notify listeners
      mockRouter.isNavigating = true; // Trigger a state change
      // Manually call the store's update. This is tricky.
      // The navigate wrapper handles this. Let's use it.
      const navPromise = mockRouter.navigate(homeRoute, {});
      return navPromise.finally(() => { // Use finally to ensure checks run after nav settles
        expect(listener1).not.toHaveBeenCalled();
        expect(listener2).toHaveBeenCalled(); // listener2 should still be active
      });
    });
  });
});

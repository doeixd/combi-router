// Integration test for view layer with loader layer
const { JSDOM } = require('jsdom');

// Setup DOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app-root"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;

console.log('[INTEGRATION] Starting view layer + loader layer integration test...');

// Mock the layered router system
function createMockLayeredRouter(routes) {
  return function(coreLayer) {
    return function(loaderLayer) {
      return function(viewLayer) {
        return function() {
          // Mock router instance
          const router = {
            routes: () => routes,
            currentMatch: null,
            isNavigating: false,
            isFetching: false,
            _lifecycleHooks: new Map(),
            _listeners: new Set(),
            _currentNavigation: null,

            _registerLifecycleHook(hookType, handler) {
              if (!this._lifecycleHooks.has(hookType)) {
                this._lifecycleHooks.set(hookType, new Set());
              }
              this._lifecycleHooks.get(hookType).add(handler);
              return () => this._lifecycleHooks.get(hookType).delete(handler);
            },

            _setCurrentMatch(match) {
              this.currentMatch = match;
              this._notifyListeners();
            },

            _setCurrentNavigation(nav) {
              this._currentNavigation = nav;
            },

            _notifyListeners() {
              for (const listener of this._listeners) {
                listener(this.currentMatch);
              }
            },

            subscribe(listener) {
              this._listeners.add(listener);
              listener(this.currentMatch);
              return () => this._listeners.delete(listener);
            },

            async _executeLifecycleHooks(hookType, ...args) {
              const hooks = this._lifecycleHooks.get(hookType);
              if (!hooks || hooks.size === 0) {
                if (hookType === 'onBeforeNavigationComplete') {
                  return args[0];
                }
                return;
              }

              if (hookType === 'onBeforeNavigationComplete') {
                let currentMatch = args[0];
                for (const hook of hooks) {
                  const result = await hook(currentMatch, args[1]);
                  if (result) {
                    currentMatch = result;
                  }
                }
                return currentMatch;
              } else {
                const promises = Array.from(hooks).map(hook => hook(...args));
                await Promise.all(promises);
              }
            },

            async navigate(path) {
              console.log(`[INTEGRATION] Navigating to: ${path}`);

              // Mock route matching
              const route = routes.find(r => path.includes(r.id));
              if (!route) {
                throw new Error(`No route found for ${path}`);
              }

              let match = {
                route,
                params: { id: '123' },
                pathname: path,
                search: '',
                hash: ''
              };

              // Execute onBeforeNavigationComplete (loader execution)
              console.log('[INTEGRATION] Executing onBeforeNavigationComplete hooks...');
              match = await this._executeLifecycleHooks('onBeforeNavigationComplete', match, false);

              // Set current match
              this._setCurrentMatch(match);

              // Execute onNavigationComplete
              await this._executeLifecycleHooks('onNavigationComplete', match, false);

              console.log('[INTEGRATION] Navigation completed, match.data:', match.data);
              return { success: true, match };
            }
          };

          // Apply core layer
          const coreExtensions = coreLayer(router);
          Object.assign(router, coreExtensions);

          // Apply loader layer
          const loaderExtensions = loaderLayer(router);
          Object.assign(router, loaderExtensions);

          // Apply view layer
          const viewExtensions = viewLayer(router);
          Object.assign(router, viewExtensions);

          return router;
        };
      };
    };
  };
}

// Mock layers
function createMockCoreNavigationLayer() {
  return function(router) {
    return {
      // Core navigation methods
    };
  };
}

function createMockLoaderLayer() {
  return function(router) {
    console.log('[INTEGRATION] Loader layer applied');

    // Register onBeforeNavigationComplete hook
    router._registerLifecycleHook('onBeforeNavigationComplete', async (match, isPopState) => {
      console.log('[INTEGRATION] Loader hook called for route:', match.route.id);

      if (match.route.metadata?.loader && !match.data) {
        console.log('[INTEGRATION] Executing loader...');
        const data = await match.route.metadata.loader({ params: match.params });
        console.log('[INTEGRATION] Loader returned:', data);

        return {
          ...match,
          data
        };
      }

      return match;
    });

    return {
      isLoading: () => false
    };
  };
}

function createMockViewLayer() {
  return function(router) {
    console.log('[INTEGRATION] View layer applied');

    // Register onNavigationComplete hook
    router._registerLifecycleHook('onNavigationComplete', async (match, isPopState) => {
      console.log('[INTEGRATION] View hook called, match.data:', match.data);

      if (match.route.metadata?.view) {
        const content = match.route.metadata.view({ match });
        console.log('[INTEGRATION] View rendered:', content);

        const rootElement = document.getElementById('app-root');
        if (rootElement) {
          rootElement.innerHTML = content;
          console.log('[INTEGRATION] Set DOM content to:', content);
        }
      }
    });

    return {
      getRootElement: () => document.getElementById('app-root')
    };
  };
}

async function runIntegrationTest() {
  // Create test route with loader and view
  const userRoute = {
    id: 'user-route',
    metadata: {
      loader: async ({ params }) => {
        console.log('[INTEGRATION] Loader executing with params:', params);
        return {
          user: {
            id: params.id,
            name: `User ${params.id}`
          }
        };
      },
      view: ({ match }) => {
        const userName = match.data?.user?.name || 'Unknown';
        return `<h1>User: ${userName}</h1>`;
      }
    }
  };

  // Create router with layers
  const router = createMockLayeredRouter([userRoute])
    (createMockCoreNavigationLayer())
    (createMockLoaderLayer())
    (createMockViewLayer())
    ();

  console.log('[INTEGRATION] Router created');

  // Test navigation
  await router.navigate('/users/123');

  // Check results
  const rootElement = document.getElementById('app-root');
  const content = rootElement?.innerHTML;
  console.log('[INTEGRATION] Final DOM content:', content);

  const expectedContent = '<h1>User: User 123</h1>';
  const success = content === expectedContent;

  console.log('[INTEGRATION] Expected:', expectedContent);
  console.log('[INTEGRATION] Actual:', content);
  console.log('[INTEGRATION] Test result:', success ? '✅ PASS' : '❌ FAIL');

  return success;
}

runIntegrationTest().then(result => {
  console.log('[INTEGRATION] Integration test completed:', result ? 'SUCCESS' : 'FAILURE');
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error('[INTEGRATION] Integration test failed:', error);
  process.exit(1);
});

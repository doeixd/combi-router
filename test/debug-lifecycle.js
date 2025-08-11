// Debug test for lifecycle hooks and loader integration
const { JSDOM } = require('jsdom');

// Setup DOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app-root"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;

console.log('[DEBUG] Testing lifecycle hooks...');

// Mock router to test lifecycle hooks
class MockRouter {
  constructor() {
    this._lifecycleHooks = new Map();
    this.currentMatch = null;
    this.isNavigating = false;
    this.isFetching = false;
  }

  _registerLifecycleHook(hookType, handler) {
    console.log(`[DEBUG] Registering hook: ${hookType}`);
    if (!this._lifecycleHooks.has(hookType)) {
      this._lifecycleHooks.set(hookType, new Set());
    }

    const hooks = this._lifecycleHooks.get(hookType);
    hooks.add(handler);

    return () => {
      hooks.delete(handler);
      if (hooks.size === 0) {
        this._lifecycleHooks.delete(hookType);
      }
    };
  }

  async _executeLifecycleHooks(hookType, ...args) {
    console.log(`[DEBUG] Executing hooks: ${hookType} with args:`, args.length);
    const hooks = this._lifecycleHooks.get(hookType);
    if (!hooks || hooks.size === 0) {
      console.log(`[DEBUG] No hooks found for ${hookType}`);
      if (hookType === 'onBeforeNavigationComplete') {
        return args[0]; // Return the match unchanged
      }
      return;
    }

    const hookArray = Array.from(hooks);
    console.log(`[DEBUG] Found ${hookArray.length} hooks for ${hookType}`);

    if (hookType === 'onBeforeNavigationComplete') {
      let currentMatch = args[0];
      console.log(`[DEBUG] Initial match data:`, currentMatch?.data);

      for (const hook of hookArray) {
        try {
          console.log(`[DEBUG] Executing hook...`);
          const result = await hook(currentMatch, args[1]);
          if (result) {
            console.log(`[DEBUG] Hook returned enhanced match with data:`, result?.data);
            currentMatch = result;
          }
        } catch (error) {
          console.error(`[DEBUG] Error in ${hookType} hook:`, error);
          throw error;
        }
      }
      console.log(`[DEBUG] Final enhanced match data:`, currentMatch?.data);
      return currentMatch;
    } else {
      const promises = hookArray.map(async (hook) => {
        try {
          return await hook(...args);
        } catch (error) {
          console.error(`[DEBUG] Error in ${hookType} hook:`, error);
          throw error;
        }
      });
      await Promise.all(promises);
    }
  }

  async navigate(path) {
    console.log(`[DEBUG] Starting navigation to: ${path}`);

    // Mock match
    let newMatch = {
      route: {
        id: 'test-route',
        metadata: {
          loader: async ({ params }) => {
            console.log('[DEBUG] Mock loader executing with params:', params);
            return { user: { id: '123', name: 'User 123' } };
          }
        }
      },
      params: { id: '123' },
      pathname: path,
      search: '',
      hash: ''
    };

    console.log('[DEBUG] Initial match (no data):', newMatch.data);

    // Execute onBeforeNavigationComplete hooks
    console.log('[DEBUG] Executing onBeforeNavigationComplete hooks...');
    newMatch = await this._executeLifecycleHooks('onBeforeNavigationComplete', newMatch, false);

    console.log('[DEBUG] Enhanced match after hooks:', newMatch.data);

    // Update current match
    this.currentMatch = newMatch;
    console.log('[DEBUG] Set currentMatch with data:', this.currentMatch.data);

    // Execute onNavigationComplete hooks
    await this._executeLifecycleHooks('onNavigationComplete', newMatch, false);

    return { success: true, match: newMatch };
  }
}

// Mock loader layer hook
function createMockLoaderHook() {
  return async function onBeforeNavigationComplete(match, isPopState) {
    console.log('[DEBUG] Loader hook called with match data:', match.data);
    console.log('[DEBUG] Match has loader:', !!match.route.metadata?.loader);

    if (match.route.metadata?.loader && !match.data) {
      console.log('[DEBUG] Executing loader...');
      try {
        const data = await match.route.metadata.loader({ params: match.params });
        console.log('[DEBUG] Loader returned data:', data);

        const enhancedMatch = {
          ...match,
          data
        };
        console.log('[DEBUG] Created enhanced match with data:', enhancedMatch.data);
        return enhancedMatch;
      } catch (error) {
        console.error('[DEBUG] Loader failed:', error);
        throw error;
      }
    }

    console.log('[DEBUG] No loader execution needed, returning original match');
    return match;
  };
}

async function test() {
  console.log('[DEBUG] Creating mock router...');
  const router = new MockRouter();

  console.log('[DEBUG] Registering loader hook...');
  const loaderHook = createMockLoaderHook();
  router._registerLifecycleHook('onBeforeNavigationComplete', loaderHook);

  console.log('[DEBUG] Starting navigation test...');
  const result = await router.navigate('/test/123');

  console.log('[DEBUG] Navigation result:', result.success);
  console.log('[DEBUG] Final currentMatch data:', router.currentMatch?.data);
  console.log('[DEBUG] Expected data: { user: { id: "123", name: "User 123" } }');

  const hasExpectedData = router.currentMatch?.data?.user?.name === 'User 123';
  console.log('[DEBUG] Has expected data:', hasExpectedData);

  if (hasExpectedData) {
    console.log('[DEBUG] ✅ Test PASSED - Lifecycle hooks working correctly');
  } else {
    console.log('[DEBUG] ❌ Test FAILED - Data not properly set');
  }
}

test().catch(error => {
  console.error('[DEBUG] Test error:', error);
});

// Debug test to understand loader integration with view layer
const { createLayeredRouter } = require('./dist/layers/index.js');
const { createCoreNavigationLayer } = require('./dist/layers/core.js');
const { createLoaderLayer } = require('./dist/layers/loader.js');
const { createViewLayer } = require('./dist/layers/view.js');
const { route, path, param, end, loader, view, pipe } = require('./dist/index.js');
const { z } = require('zod');

// Setup DOM
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app-root"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;

console.log('[DEBUG] Starting debug test...');

// Create a simple route with loader and view
const userRoute = pipe(
  route(path('users'), param('id', z.string()), end),
  loader(async ({ params }) => {
    console.log('[DEBUG] Loader called with params:', params);
    const userData = {
      user: { id: params.id, name: `User ${params.id}` }
    };
    console.log('[DEBUG] Loader returning:', userData);
    return userData;
  }),
  view(({ match }) => {
    console.log('[DEBUG] View called with match:', match);
    console.log('[DEBUG] Match data:', match.data);
    const userName = match.data?.user?.name || 'Unknown';
    console.log('[DEBUG] Rendering userName:', userName);
    return `<h1>User: ${userName}</h1>`;
  })
);

console.log('[DEBUG] Created userRoute:', userRoute);

// Create router with layers
const router = createLayeredRouter([userRoute])(
  createCoreNavigationLayer()
)(
  createLoaderLayer({
    debug: true,
  })
)(
  createViewLayer({
    root: '#app-root',
  })
)();

console.log('[DEBUG] Created router:', typeof router);

async function test() {
  try {
    console.log('[DEBUG] Starting navigation to /users/123...');
    const result = await router.navigate('/users/123');
    console.log('[DEBUG] Navigation result:', result);

    const rootElement = document.getElementById('app-root');
    console.log('[DEBUG] Root element innerHTML:', rootElement?.innerHTML);
    console.log('[DEBUG] Expected: "User: User 123"');
    console.log('[DEBUG] Contains expected text:', rootElement?.innerHTML?.includes('User: User 123'));
  } catch (error) {
    console.error('[DEBUG] Error during test:', error);
  }
}

test().then(() => {
  console.log('[DEBUG] Test completed');
}).catch(error => {
  console.error('[DEBUG] Test failed:', error);
});

// Test script to debug layered router behavior
const allExports = require('../dist/cjs/development/index.js');
console.log('Available exports:', Object.keys(allExports));

const { createLayeredRouter, createCoreNavigationLayer, route, path } = allExports;

console.log('createLayeredRouter:', typeof createLayeredRouter);
console.log('createCoreNavigationLayer:', typeof createCoreNavigationLayer);
console.log('route:', typeof route);
console.log('path:', typeof path);

if (!createLayeredRouter) {
  console.log('createLayeredRouter not found, trying to find similar exports');
  const similar = Object.keys(allExports).filter(k => k.toLowerCase().includes('layer') || k.toLowerCase().includes('router'));
  console.log('Similar exports:', similar);
  process.exit(1);
}

// Create test routes
const testRoutes = [
  route(path('/'), { name: 'home' }),
  route(path('/about'), { name: 'about' })
];

console.log('Creating layered router...');
const builder = createLayeredRouter(testRoutes);
console.log('Builder:', typeof builder);

const withCore = builder(createCoreNavigationLayer());
console.log('With core layer:', typeof withCore);

const router = withCore();
console.log('Final router:', router);
console.log('Router routes:', router.routes);
console.log('Router routes type:', typeof router.routes);
console.log('Router navigate:', typeof router.navigate);
console.log('Router keys:', Object.keys(router));

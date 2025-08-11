const { path } = require('./dist/core/matchers.js');
const { route } = require('./dist/core/route.js');

// Test path function
const rootPath = path('/');
const validPath = path('/valid');

console.log('Root path matcher:', rootPath);
console.log('Valid path matcher:', validPath);

// Test route construction
const rootRoute = route(rootPath);
const validRoute = route(validPath);

console.log('Root route:', rootRoute);
console.log('Valid route:', validRoute);

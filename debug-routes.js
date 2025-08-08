// Debug script to test route matching issues
const { route, path, param, end, pipe, view } = require('./dist/index.js');

// Mock Zod for testing
const z = {
  string: () => ({
    '~standard': {
      validate: (value) => ({ value: String(value) })
    }
  }),
};

console.log('=== Testing Route Creation and Matching ===');

// Test 1: Simple root route
console.log('\n1. Testing root route with path(""), end');
try {
  const homeRoute = pipe(
    route(path(""), end),
    view(() => "<h1>Welcome Home!</h1>")
  );

  console.log('Route created successfully:');
  console.log('- ID:', homeRoute.id);
  console.log('- Static Path:', homeRoute.staticPath);
  console.log('- Matchers:', homeRoute.matchers.map(m => ({ type: m.type, paramName: m.paramName })));

  // Test parsing
  console.log('\nTesting parser on "/"');
  const parseResult = homeRoute.parser.run({ input: '/', index: 0 });
  console.log('Parse result:', parseResult);

} catch (error) {
  console.error('Error creating/testing root route:', error);
}

// Test 2: Route with parameters
console.log('\n2. Testing route with parameters: path("users"), param("id", z.string()), end');
try {
  const userRoute = pipe(
    route(path("users"), param("id", z.string()), end),
    view(({ match }) => `<h1>User: ${match.params.id}</h1>`)
  );

  console.log('Route created successfully:');
  console.log('- ID:', userRoute.id);
  console.log('- Static Path:', userRoute.staticPath);
  console.log('- Matchers:', userRoute.matchers.map(m => ({ type: m.type, paramName: m.paramName })));

  // Test parsing
  console.log('\nTesting parser on "/users/123"');
  const parseResult = userRoute.parser.run({ input: '/users/123', index: 0 });
  console.log('Parse result:', parseResult);

} catch (error) {
  console.error('Error creating/testing user route:', error);
}

// Test 3: Simple about route
console.log('\n3. Testing simple path route: path("about"), end');
try {
  const aboutRoute = pipe(
    route(path("about"), end),
    view(() => "<h1>About</h1>")
  );

  console.log('Route created successfully:');
  console.log('- ID:', aboutRoute.id);
  console.log('- Static Path:', aboutRoute.staticPath);
  console.log('- Matchers:', aboutRoute.matchers.map(m => ({ type: m.type, paramName: m.paramName })));

  // Test parsing
  console.log('\nTesting parser on "/about"');
  const parseResult = aboutRoute.parser.run({ input: '/about', index: 0 });
  console.log('Parse result:', parseResult);

} catch (error) {
  console.error('Error creating/testing about route:', error);
}

console.log('\n=== Debug Complete ===');

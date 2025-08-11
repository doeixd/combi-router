// Debug script to test route matching issues
import {
  route,
  path,
  param,
  end,
  pipe,
  view,
  createLayeredRouter,
  createCoreNavigationLayer,
} from "./src/index";

// Mock Zod for testing
const z = {
  string: () => ({
    "~standard": {
      validate: (value: any) => ({ value: String(value) }),
    },
  }),
};

console.log("=== Testing Route Creation and Matching ===");

// Test 1: Simple root route
console.log('\n1. Testing root route with path(""), end');
try {
  const homeRoute = pipe(
    route(path(""), end),
    view(() => "<h1>Welcome Home!</h1>"),
  );

  console.log("Route created successfully:");
  console.log("- ID:", homeRoute.id);
  console.log("- Static Path:", homeRoute.staticPath);
  console.log(
    "- Matchers:",
    homeRoute.matchers.map((m: any) => ({
      type: m.type,
      paramName: m.paramName,
    })),
  );

  // Test parsing
  console.log('\nTesting parser on "/"');
  const parseResult = homeRoute.parser.run({ input: "/", index: 0 });
  console.log("Parse result:", parseResult);

  // Test parsing on empty string
  console.log('\nTesting parser on ""');
  const parseResult2 = homeRoute.parser.run({ input: "", index: 0 });
  console.log("Parse result for empty string:", parseResult2);
} catch (error) {
  console.error("Error creating/testing root route:", error);
}

// Test 2: Route with parameters - detailed analysis
console.log(
  '\n2. Testing route with parameters: path("users"), param("id", z.string()), end',
);
try {
  const userRoute = pipe(
    route(path("users"), param("id", z.string()), end),
    view(({ match }: any) => `<h1>User: ${match.params.id}</h1>`),
  );

  console.log("Route created successfully:");
  console.log("- ID:", userRoute.id);
  console.log("- Static Path:", userRoute.staticPath);
  console.log(
    "- Matchers:",
    userRoute.matchers.map((m: any) => ({
      type: m.type,
      paramName: m.paramName,
    })),
  );

  // Test parsing step by step
  console.log("\nDetailed parser testing:");

  // Test individual matchers
  console.log("Testing individual matchers:");
  userRoute.matchers.forEach((matcher: any, i: number) => {
    console.log(`\nMatcher ${i} (${matcher.type}):`);
    if (matcher.type === "path") {
      console.log('  Testing "/users" on path matcher');
      const result = matcher.parser.run({ input: "/users", index: 0 });
      console.log("  Result:", result);
    } else if (matcher.type === "param") {
      console.log('  Testing "/123" on param matcher');
      const result = matcher.parser.run({ input: "/123", index: 0 });
      console.log("  Result:", result);
    } else if (matcher.type === "end") {
      console.log("  Testing empty input on end matcher");
      const result = matcher.parser.run({ input: "", index: 0 });
      console.log("  Result:", result);
    }
  });

  // Test full parsing
  console.log('\nTesting full parser on "/users/123"');
  const parseResult = userRoute.parser.run({ input: "/users/123", index: 0 });
  console.log("Parse result:", parseResult);

  // Test with different inputs
  console.log('\nTesting full parser on "/users"');
  const parseResult2 = userRoute.parser.run({ input: "/users", index: 0 });
  console.log("Parse result for /users:", parseResult2);
} catch (error) {
  console.error("Error creating/testing user route:", error);
}

// Test 3: Test with actual router instance
console.log("\n3. Testing with actual router instance");
try {
  const homeRoute = pipe(
    route(path(""), end),
    view(() => "<h1>Welcome Home!</h1>"),
  );

  const userRoute = pipe(
    route(path("users"), param("id", z.string()), end),
    view(({ match }: any) => `<h1>User: ${match.params.id}</h1>`),
  );

  const router = createLayeredRouter([homeRoute, userRoute])(
    createCoreNavigationLayer(),
  )();

  console.log("Router created with routes:");
  console.log(
    "Available routes:",
    router.routes().map((r: any) => ({ id: r.id, staticPath: r.staticPath })),
  );

  // Test matching
  console.log('\nTesting router.match("/")');
  const homeMatch = router.match("/");
  console.log(
    "Home match result:",
    homeMatch ? { route: homeMatch.route.id, params: homeMatch.params } : null,
  );

  console.log('\nTesting router.match("/users/123")');
  const userMatch = router.match("/users/123");
  console.log(
    "User match result:",
    userMatch ? { route: userMatch.route.id, params: userMatch.params } : null,
  );
} catch (error) {
  console.error("Error testing with router instance:", error);
}

console.log("\n=== Debug Complete ===");

import { path } from "./src/core/matchers";
import { route } from "./src/core/route";
import { sequence } from "@doeixd/combi-parse";

// Test path matchers
console.log("Testing path matchers...");

const rootPath = path("/");
console.log("Root path matcher:", {
  type: rootPath.type,
  hasParser: !!rootPath.parser,
  build: rootPath.build({}),
});

const validPath = path("/valid");
console.log("Valid path matcher:", {
  type: validPath.type,
  hasParser: !!validPath.parser,
  build: validPath.build({}),
});

// Test routes
console.log("\nTesting routes...");

const rootRoute = route(rootPath);
console.log("Root route:", {
  id: rootRoute.id,
  staticPath: rootRoute.staticPath,
  hasParser: !!rootRoute.parser,
  matchers: rootRoute.matchers.map((m) => ({
    type: m.type,
    hasParser: !!m.parser,
  })),
});

const validRoute = route(validPath);
console.log("Valid route:", {
  id: validRoute.id,
  staticPath: validRoute.staticPath,
  hasParser: !!validRoute.parser,
  matchers: validRoute.matchers.map((m) => ({
    type: m.type,
    hasParser: !!m.parser,
  })),
});

// Test parsing
console.log("\nTesting route parsing...");

try {
  const rootParser = rootRoute.parser;
  console.log("Root route parser:", !!rootParser);

  if (rootParser) {
    const result = rootParser.run({ input: "/", index: 0 });
    console.log("Root parse result:", result);
  }
} catch (error) {
  console.error("Error parsing root route:", error);
}

try {
  const validParser = validRoute.parser;
  console.log("Valid route parser:", !!validParser);

  if (validParser) {
    const result = validParser.run({ input: "/valid", index: 0 });
    console.log("Valid parse result:", result);
  }
} catch (error) {
  console.error("Error parsing valid route:", error);
}

// Test with sequences
console.log("\nTesting sequence building...");

// sequence already imported at top

try {
  const matchers = [rootPath];
  const pathMatchers = matchers
    .filter((m) => m.type !== "query" && m.type !== "meta")
    .map((m) => m.parser);

  console.log(
    "Path matchers for sequence:",
    pathMatchers.map((p) => !!p),
  );

  const pathParser = sequence(pathMatchers);
  console.log("Sequence parser created:", !!pathParser);

  if (pathParser) {
    const result = pathParser.run({ input: "/", index: 0 });
    console.log("Sequence parse result:", result);
  }
} catch (error) {
  console.error("Error in sequence:", error);
}

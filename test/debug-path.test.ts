// =================================================================
//
//      Debug Test: Understanding Path Matching for Root Routes
//
//      This test file helps debug how path matching works,
//      especially for root routes and empty path segments.
//
// =================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import {
  route,
  path,
  end,
  view,
} from "../src/index";

describe("Debug Path Matching", () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="app-root"></div>
        </body>
      </html>
    `,
      {
        url: "http://localhost:3000",
        pretendToBeVisual: true,
        resources: "usable",
      },
    );

    document = dom.window.document;
    window = dom.window as any;

    // Set up globals for the router
    global.document = document;
    global.window = window as any;
    global.HTMLElement = window.HTMLElement;
    global.Node = window.Node;
  });

  afterEach(() => {
    // Clean up globals
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).HTMLElement;
    delete (global as any).Node;
    dom.window.close();
  });

  describe("Path Matcher Behavior", () => {
    it("should understand how path('') works", () => {
      const emptyPathRoute = route(path(""), end);

      console.log("Empty path route created:", {
        id: emptyPathRoute.id,
        matchers: emptyPathRoute.matchers,
        staticPath: emptyPathRoute.staticPath,
      });

      // Test the parser directly
      const parseResult = emptyPathRoute.parser.run({ input: "/", index: 0 });
      console.log("Parse result for '/':", parseResult);

      expect(parseResult.type).toBe("success");
    });

    it("should understand how path('home') works", () => {
      const homeRoute = route(path("home"), end);

      console.log("Home route created:", {
        id: homeRoute.id,
        matchers: homeRoute.matchers,
        staticPath: homeRoute.staticPath,
      });

      // Test the parser directly
      const parseResult = homeRoute.parser.run({ input: "/home", index: 0 });
      console.log("Parse result for '/home':", parseResult);

      expect(parseResult.type).toBe("success");
    });

    it("should understand how just end works", () => {
      const endOnlyRoute = route(end);

      console.log("End-only route created:", {
        id: endOnlyRoute.id,
        matchers: endOnlyRoute.matchers,
        staticPath: endOnlyRoute.staticPath,
      });

      // Test parsing various inputs
      const inputs = ["/", "", "/home"];

      inputs.forEach(input => {
        const parseResult = endOnlyRoute.parser.run({ input, index: 0 });
        console.log(`Parse result for '${input}':`, parseResult);
      });
    });

    it("should test different root route patterns", () => {
      const patterns = [
        { name: "path('')+end", route: route(path(""), end) },
        { name: "end only", route: route(end) },
      ];

      patterns.forEach(({ name, route: testRoute }) => {
        console.log(`\n=== Testing ${name} ===`);

        const testInputs = ["/", "", "/home"];
        testInputs.forEach(input => {
          const parseResult = testRoute.parser.run({ input, index: 0 });
          console.log(`${name} parsing '${input}':`, {
            type: parseResult.type,
            success: parseResult.type === "success",
            fullMatch: parseResult.type === "success" && parseResult.state.index === input.length,
            index: parseResult.type === "success" ? parseResult.state.index : "N/A",
            inputLength: input.length,
            value: parseResult.type === "success" ? parseResult.value : "N/A"
          });
        });
      });
    });

    it("should understand matcher build functions", () => {
      const routes = [
        { name: "path('')", route: route(path(""), end) },
        { name: "path('home')", route: route(path("home"), end) },
        { name: "end only", route: route(end) },
      ];

      routes.forEach(({ name, route: testRoute }) => {
        console.log(`\n=== ${name} build functions ===`);
        testRoute.matchers.forEach((matcher, index) => {
          console.log(`Matcher ${index}:`, {
            type: matcher.type,
            build: matcher.build({}),
          });
        });
        console.log("Static path:", testRoute.staticPath);
      });
    });
  });

  describe("Root Route Investigation", () => {
    it("should determine the correct pattern for root routes", () => {
      // Test all possible patterns for root routes
      const rootPatterns = [
        { name: "path('') + end", factory: () => route(path(""), end) },
        { name: "end only", factory: () => route(end) },
      ];

      rootPatterns.forEach(({ name, factory }) => {
        console.log(`\n=== Testing root pattern: ${name} ===`);

        try {
          const testRoute = factory();

          // Test if it can parse root path "/"
          const rootParseResult = testRoute.parser.run({ input: "/", index: 0 });
          const rootSuccess = rootParseResult.type === "success" && rootParseResult.state.index === 1;

          // Test if it can parse empty string ""
          const emptyParseResult = testRoute.parser.run({ input: "", index: 0 });
          const emptySuccess = emptyParseResult.type === "success" && emptyParseResult.state.index === 0;

          console.log("Results:", {
            canParseRoot: rootSuccess,
            canParseEmpty: emptySuccess,
            staticPath: testRoute.staticPath,
            matchers: testRoute.matchers.map(m => ({ type: m.type, build: m.build({}) }))
          });

        } catch (error) {
          console.log("Error creating route:", error);
        }
      });
    });
  });
});

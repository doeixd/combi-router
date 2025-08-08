// =================================================================
//
//      Combi-Router: Loader Layer Tests
//
//      Isolated tests for the loader layer functionality
//
// =================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  createLayeredRouter,
  createCoreNavigationLayer,
  createLoaderLayer,
  route,
  pipe,
  path,
  param,
  end,
  loader,
  view,
} from "../src/index";

// Mock Zod for testing
const z = {
  string: () => ({
    "~standard": {
      version: 1,
      vendor: "zod",
      validate: (value: any) => ({ value: String(value) }),
    },
  }),
};

describe("Loader Layer", () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  let activeRouters: any[] = [];

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
    global.MouseEvent = window.MouseEvent;
  });

  afterEach(async () => {
    // Clean up routers first to stop any async operations
    for (const router of activeRouters) {
      if (typeof router._cleanup === "function") {
        await router._cleanup();
      }
    }
    activeRouters = [];

    // Small delay to ensure all async operations complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Clean up globals
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).HTMLElement;
    delete (global as any).Node;
    delete (global as any).MouseEvent;
    dom.window.close();
  });

  describe("Basic Loader Execution", () => {
    it("should execute loaders and populate match.data", async () => {
      console.log("[TEST] Starting loader execution test");

      const testRoute = pipe(
        route(path("test"), param("id", z.string()), end),
        loader(async ({ params }) => {
          console.log("[TEST] Loader executing with params:", params);
          return {
            user: {
              id: params.id,
              name: `User ${params.id}`,
            },
          };
        }),
        view(({ match }) => {
          console.log("[TEST] View rendering with match.data:", match.data);
          return `<h1>User: ${match.data?.user?.name || "No data"}</h1>`;
        }),
      );

      console.log("[TEST] Creating router with loader layer");
      const router = createLayeredRouter([testRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      console.log("[TEST] Navigating to /test/123");
      await router.navigate("/test/123");

      console.log("[TEST] Navigation completed, checking current match");
      const currentMatch = router.currentMatch;
      console.log("[TEST] Current match data:", currentMatch?.data);

      expect(currentMatch).toBeDefined();
      expect(currentMatch?.data).toBeDefined();
      expect(currentMatch?.data?.user?.name).toBe("User 123");
    });

    it("should handle loaders that return simple values", async () => {
      const simpleRoute = pipe(
        route(path("simple"), end),
        loader(async () => {
          console.log("[TEST] Simple loader executing");
          return { message: "Hello World" };
        }),
      );

      const router = createLayeredRouter([simpleRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/simple");

      const currentMatch = router.currentMatch;
      expect(currentMatch?.data?.message).toBe("Hello World");
    });

    it("should handle loader errors gracefully", async () => {
      const errorRoute = pipe(
        route(path("error"), end),
        loader(async () => {
          throw new Error("Test loader error");
        }),
      );

      const router = createLayeredRouter([errorRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      // Navigation should complete but loader error should be handled
      await expect(router.navigate("/error")).rejects.toThrow(
        "Test loader error",
      );
    });

    it("should skip loader execution if data already exists", async () => {
      let loaderCallCount = 0;

      const cachedRoute = pipe(
        route(path("cached"), end),
        loader(async () => {
          loaderCallCount++;
          return { count: loaderCallCount };
        }),
      );

      const router = createLayeredRouter([cachedRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
          cacheLoaderResults: true,
        }),
      )();

      activeRouters.push(router);

      // First navigation should execute loader
      await router.navigate("/cached");
      expect(loaderCallCount).toBe(1);
      expect(router.currentMatch?.data?.count).toBe(1);

      // Second navigation should use cached data
      await router.navigate("/cached");
      expect(loaderCallCount).toBe(1); // Should still be 1 if cache is working
    });
  });

  describe("Loader Layer API", () => {
    it("should provide executeLoader method", async () => {
      const router = createLayeredRouter([])(createCoreNavigationLayer())(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      expect(typeof router.executeLoader).toBe("function");
      expect(typeof router.hasLoader).toBe("function");
      expect(typeof router.isLoading).toBe("function");
      expect(typeof router.cancelLoaders).toBe("function");
    });

    it("should report loading state correctly", async () => {
      let resolveLoader: () => void;
      const loaderPromise = new Promise<void>((resolve) => {
        resolveLoader = resolve;
      });

      const slowRoute = pipe(
        route(path("slow"), end),
        loader(async () => {
          await loaderPromise;
          return { data: "loaded" };
        }),
      );

      const router = createLayeredRouter([slowRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      // Start navigation (don't await)
      const navigationPromise = router.navigate("/slow");

      // Check loading state
      expect(router.isLoading()).toBe(true);

      // Resolve loader
      resolveLoader!();
      await navigationPromise;

      // Check final state
      expect(router.isLoading()).toBe(false);
      expect(router.currentMatch?.data?.data).toBe("loaded");
    });
  });

  describe("Integration", () => {
    it("should work with nested routes", async () => {
      const parentRoute = pipe(
        route(path("parent"), end),
        loader(async () => ({ parent: "data" })),
      );

      const childRoute = pipe(
        route(path("parent"), path("child"), param("id", z.string()), end),
        loader(async ({ params }) => ({ child: `child-${params.id}` })),
      );

      const router = createLayeredRouter([parentRoute, childRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/parent/child/123");

      const currentMatch = router.currentMatch;
      expect(currentMatch?.data).toBeDefined();
      expect(currentMatch?.params?.id).toBe("123");
    });
  });
});

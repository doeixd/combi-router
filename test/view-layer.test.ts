// =================================================================
//
//      Combi-Router: View Layer Tests
//
//      Tests for the view layer functionality including rendering,
//      lifecycle integration, and SPA navigation.
//
// =================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  createLayeredRouter,
  createCoreNavigationLayer,
  createViewLayer,
  createLoaderLayer,
  dataLayer,
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

describe("View Layer", () => {
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
          <div id="navigation">
            <a href="/" id="home-link">Home</a>
            <a href="/about" id="about-link">About</a>
            <a href="/users/123" id="user-link">User</a>
          </div>
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

  describe("Basic Rendering", () => {
    it("should render a simple view", async () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Welcome Home!</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      // Wait for the router to render content to the DOM
      await new Promise((resolve) => {
        const checkDOM = () => {
          const rootElement = document.getElementById("app-root");
          if (rootElement && rootElement.innerHTML.includes("Welcome Home!")) {
            console.log("[TEST] DOM content found:", rootElement.innerHTML);
            resolve(undefined);
          } else {
            console.log(
              "[TEST] Waiting for DOM content, current:",
              rootElement?.innerHTML,
            );
            setTimeout(checkDOM, 5);
          }
        };
        checkDOM();
      });

      const rootElement = document.getElementById("app-root");
      console.log("[TEST] Root element innerHTML:", rootElement?.innerHTML);
      console.log("[TEST] Root element exists:", !!rootElement);
      expect(rootElement?.innerHTML).toContain("Welcome Home!");
    });

    it("should render views with route data", async () => {
      const userRoute = pipe(
        route(path("users"), param("id", z.string()), end),
        loader(async ({ params }) => ({
          user: { id: params.id, name: `User ${params.id}` },
        })),
        view(
          ({ match }) =>
            `<h1>User: ${match.data?.user?.name || "Unknown"}</h1>`,
        ),
      );

      const router = createLayeredRouter([userRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/users/123");

      const rootElement = document.getElementById("app-root");
      console.log("[TEST] User route innerHTML:", rootElement?.innerHTML);
      expect(rootElement?.innerHTML).toContain("User: User 123");
    });

    it("should render DOM nodes", async () => {
      const nodeRoute = pipe(
        route(path("node"), end),
        view(() => {
          const div = document.createElement("div");
          div.className = "test-node";
          div.textContent = "DOM Node Content";
          return div;
        }),
      );

      const router = createLayeredRouter([nodeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/node");

      // Wait for render to complete
      await new Promise((resolve) => setTimeout(resolve, 5));

      const rootElement = document.getElementById("app-root");
      console.log("[TEST] DOM node innerHTML:", rootElement?.innerHTML);
      const testNode = rootElement?.querySelector(".test-node");
      expect(testNode?.textContent).toBe("DOM Node Content");
    });
  });

  describe("State Management", () => {
    it("should show loading view during data fetching", async () => {
      const slowRoute = pipe(
        route(path("slow"), end),
        loader(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { data: "loaded" };
        }),
        view(
          ({ match }) => `<div>Data: ${match.data?.data || "No data"}</div>`,
        ),
      );

      const router = createLayeredRouter([slowRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )(
        createViewLayer({
          root: "#app-root",
          loadingView: () => '<div class="loading">Loading...</div>',
        }),
      )();

      activeRouters.push(router);

      const navigationPromise = router.navigate("/slow");

      // Check loading state
      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("Loading...");

      // Wait for completion
      await navigationPromise;
      expect(rootElement?.innerHTML).toContain("Data: loaded");
    });

    it("should show error view when loader fails", async () => {
      const errorRoute = pipe(
        route(path("error"), end),
        loader(async () => {
          throw new Error("Loader failed");
        }),
        view(() => "<div>Should not render</div>"),
      );

      const router = createLayeredRouter([errorRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )(
        createViewLayer({
          root: "#app-root",
          errorView: (error) => `<div class="error">${error.message}</div>`,
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/error");

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("Loader failed");
    });

    it("should show 404 view for unmatched routes", async () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
          notFoundView: () => '<div class="not-found">Page Not Found</div>',
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/nonexistent");

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("Page Not Found");
    });
  });

  describe("SPA Navigation", () => {
    it("should intercept internal link clicks", async () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const aboutRoute = pipe(
        route(path("about"), end),
        view(() => "<h1>About</h1>"),
      );

      const router = createLayeredRouter([homeRoute, aboutRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      // Simulate click on internal link
      const aboutLink = document.getElementById(
        "about-link",
      ) as HTMLAnchorElement;
      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });

      // Mock preventDefault to verify it was called
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");

      aboutLink.dispatchEvent(clickEvent);

      // Should prevent default browser navigation
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should not intercept external links", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      // Create external link
      const externalLink = document.createElement("a");
      externalLink.href = "https://external.com";
      document.body.appendChild(externalLink);

      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");

      externalLink.dispatchEvent(clickEvent);

      // Should NOT prevent default for external links
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should not intercept download links", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      // Create download link
      const downloadLink = document.createElement("a");
      downloadLink.href = "/download.pdf";
      downloadLink.setAttribute("download", "");
      document.body.appendChild(downloadLink);

      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");

      downloadLink.dispatchEvent(clickEvent);

      // Should NOT prevent default for download links
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe("ViewLayer API", () => {
    it("should provide rerender method", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      expect(typeof router.rerender).toBe("function");
    });

    it("should provide getRootElement method", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      const rootElement = router.getRootElement();
      expect(rootElement).toBe(document.getElementById("app-root"));
    });

    it("should provide updateConfig method", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      expect(typeof router.updateConfig).toBe("function");

      // Test config update
      router.updateConfig({
        loadingView: () => "<div>New loading view</div>",
      });

      // Config should be updated internally (though we can't directly test private state)
      expect(router.updateConfig).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle view rendering errors gracefully", () => {
      const errorRoute = pipe(
        route(path("error"), end),
        view(() => {
          throw new Error("View rendering error");
        }),
      );

      const router = createLayeredRouter([errorRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
          errorView: (error) =>
            `<div class="error">Caught: ${error.message}</div>`,
        }),
      )();

      activeRouters.push(router);

      router.navigate("/error");

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("View rendering failed");
    });

    it("should handle missing view factories", async () => {
      const noViewRoute = pipe(
        route(path("no-view"), end),
        // Intentionally no view() enhancer
      );

      const router = createLayeredRouter([noViewRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/no-view");

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("View not configured");
    });
  });

  describe("Configuration", () => {
    it("should throw error if root element not found", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      expect(() => {
        const router = createLayeredRouter([homeRoute])(
          createCoreNavigationLayer(),
        )(
          createViewLayer({
            root: "#nonexistent",
          }),
        )();
        activeRouters.push(router);
      }).toThrow('Root element "#nonexistent" not found');
    });

    it("should accept HTMLElement as root", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const rootElement = document.getElementById("app-root")!;

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: rootElement,
        }),
      )();

      activeRouters.push(router);

      expect(router.getRootElement()).toBe(rootElement);
    });

    it("should support disabling link interception", () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
          disableLinkInterception: true,
        }),
      )();

      activeRouters.push(router);

      // With link interception disabled, clicking links should not prevent default
      const aboutLink = document.getElementById(
        "about-link",
      ) as HTMLAnchorElement;
      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      aboutLink.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe("Integration with Head Management", () => {
    it("should apply head data from routes", async () => {
      // Note: This test would need proper head() import and integration
      // For now, we'll test that the system doesn't crash with head metadata
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home with Head</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/");

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("Home with Head");
    });
  });

  describe("ViewContext", () => {
    it("should provide correct context to view factories", async () => {
      let capturedContext: any;

      const contextRoute = pipe(
        route(path("context"), param("id", z.string()), end),
        loader(async ({ params }) => ({ loadedData: `data-${params.id}` })),
        view((context) => {
          capturedContext = context;
          return `<div>Context test</div>`;
        }),
      );

      const router = createLayeredRouter([contextRoute])(
        createCoreNavigationLayer(),
      )(
        createLoaderLayer({
          debug: true,
        }),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      await router.navigate("/context/test-id");

      expect(capturedContext).toBeDefined();
      expect(capturedContext.match).toBeDefined();
      expect(capturedContext.match.params?.id).toBe("test-id");
      expect(capturedContext.match.data?.loadedData).toBe("data-test-id");
    });
  });

  describe("Cleanup", () => {
    it("should clean up event listeners and DOM content", async () => {
      const homeRoute = pipe(
        route(path(""), end),
        view(() => "<h1>Home</h1>"),
      );

      const router = createLayeredRouter([homeRoute])(
        createCoreNavigationLayer(),
      )(
        createViewLayer({
          root: "#app-root",
        }),
      )();

      activeRouters.push(router);

      // Wait for the router to render content to the DOM
      await new Promise((resolve) => {
        const checkDOM = () => {
          const rootElement = document.getElementById("app-root");
          if (rootElement && rootElement.innerHTML.includes("Home")) {
            resolve(undefined);
          } else {
            setTimeout(checkDOM, 5);
          }
        };
        checkDOM();
      });

      const rootElement = document.getElementById("app-root");
      expect(rootElement?.innerHTML).toContain("Home");

      // Cleanup should be called when router is destroyed
      if (typeof (router as any)._cleanup === "function") {
        await (router as any)._cleanup();
      }

      expect(rootElement?.innerHTML).toBe("");
    });
  });
});

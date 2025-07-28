# The Inner Workings of Combi-Router: A Deep Dive

This document dissects the architecture of `@doeixd/combi-router`. The goal is to move beyond the public API and understand *how* and *why* it works the way it does, providing enough insight for you to build a similar system from scratch.

### Introduction: The Core Philosophy

Most routers treat URLs as string patterns to be matched with wildcards. Combi-Router is built on a different, more fundamental idea: **a URL is a structured sequence of characters that can be formally parsed.**

This seemingly academic distinction is the key to everything. By treating routing as a parsing problem, we unlock a suite of powerful capabilities:

1.  **Composition over Configuration**: Instead of configuring a large router object, you build routes from small, reusable functions (`path`, `param`).
2.  **Absolute Type Safety**: If a route is built by composing parsers, the types of its parameters can be inferred with 100% accuracy. A URL that doesn't match a route's structure is a parsing failure, not a runtime error.
3.  **Reference-Based Routing**: Routes become first-class objects in your application. You import and export them like any other value, eliminating "stringly-typed" APIs and making refactoring trivial.
4.  **Hierarchical by Nature**: Extending a route creates a new, immutable route that inherits the parent's parsing logic. This naturally forms a route tree that mirrors your application's component tree.

### Prerequisites

To get the most out of this document, you should have a solid understanding of:
*   TypeScript, including generics and higher-order functions.
*   Basic functional programming concepts (immutability, pure functions).
*   The general purpose of a client-side router.

### Part 1: The Foundation - A `combi-parse` Crash Course

Combi-Router does not have its own parsing engine. It stands on the shoulders of a small, powerful library: `@doeixd/combi-parse`. To understand the router, you must first understand the concept of a **parser combinator**.

A parser is a function that takes an input string and tries to consume a portion of it, returning a success (with a parsed value and the rest of the string) or a failure. A **parser combinator** is a higher-order function that takes one or more parsers and returns a *new* parser.

Let's see this in action by building a parser for the URL `/users/123/posts`:

```typescript
import { str, regex, sequence } from '@doeixd/combi-parse';

const url = '/users/123/posts';

// Step 1: Parse the static parts. `keepRight` is a combinator that runs two
// parsers in sequence but only keeps the result of the right-hand one.
const userParser = str('/').keepRight(str('users'));
// userParser.run(url) -> Success("users", rest: "/123/posts")

const postsParser = str('/').keepRight(str('posts'));
// postsParser.run("/posts") -> Success("posts", rest: "")

// Step 2: Parse the dynamic ID. We use a regular expression, then use the
// `.map()` combinator to transform the resulting string into a number.
const idParser = str('/').keepRight(regex(/[0-9]+/)).map(Number);
// idParser.run("/123/posts") -> Success(123, rest: "/posts")

// Step 3: Combine them in order with the `sequence` combinator.
const fullParser = sequence([userParser, idParser, postsParser]);
// fullParser.run(url) -> Success(["users", 123, "posts"], rest: "")

// Step 4: Transform the final result array into a useful object.
const finalParser = fullParser.map(([_, id, __]) => ({ userId: id }));
// finalParser.run(url) -> Success({ userId: 123 }, rest: "")
```
This is the engine of Combi-Router. Every part of a URL is matched by a specific parser, and these small parsers are combined to describe the entire URL structure.

### Part 2: The `RouteMatcher` - Bridging Concept and Code

This is the most crucial internal interface. It’s the contract that connects the declarative API (`path`, `param`) to the underlying parsing engine. Every matcher function returns an object that fulfills this contract.

```typescript
interface RouteMatcher {
  readonly type: string; // For debugging: 'path', 'param', 'query', etc.
  readonly parser: Parser<any>; // The combi-parse parser for this segment.
  readonly build: (params: Record<string, any>) => string | null; // The inverse function.
  readonly paramName?: string; // The name of the parameter this matcher captures.
  readonly schema?: StandardSchemaV1<any, any>; // The validation schema.
}```

*   **`path('users')`**:
    *   **`parser`**: `str('/').keepRight(str('users')).map(() => ({}))`. It looks for `/users` and then `.map()`s the result to an empty object `{}`. **This is key:** static path segments should not add properties to the final `params` object.
    *   **`build`**: A simple function: `() => '/users'`.

*   **`param('id', NumberSchema)`**:
    *   **`parser`**: This is more advanced. It first uses `regex(/[^/?#]+/)` to capture a raw string segment (e.g., "123"). It then uses the `.chain()` combinator. This is a powerful tool that allows the *result* of one parser to determine the *next* parser to run. In this case, it lets us validate the captured string segment *before* deciding whether the overall parser should succeed with a `{ id: 123 }` value or fail.
    *   **`build`**: `(params) => \`/${params['id']}\``.

*   **`query('page', NumberSchema)`**:
    *   **`parser`**: This is a special case. It does **not** consume any part of the URL's *path*. Its job is to act as metadata. Its parser immediately succeeds, returning an object containing the parameter's name and its schema: `{ name: 'page', schema: NumberSchema }`. The router's main `match` logic will use this metadata later.
    *   **`build`**: `(params) => params['page'] ? \`page=${params['page']}\` : null`.

### Part 3: The `Route` Object - An Immutable Blueprint

A `Route` object is an immutable container for an array of `RouteMatcher` objects and some metadata.

#### The Anatomy of a `Route`

*   **`matchers: readonly RouteMatcher[]`**: `readonly` is intentional, making the `Route` object immutable. This is key for predictable composition. `extend` creates a *new* object rather than modifying an existing one.

*   **`parent?: Route<any>`**: This reference is what forms the tree, enabling features like inherited parameters and hierarchical matching.

*   **`get parser(): Parser<TParams>`**: This is a lazily-initialized property.
    > **Why lazy?** Imagine an application with 500 routes. Building 500 complex composite parsers when the application starts would add noticeable startup delay. By making the parser a getter, we only pay the cost of building it the first time a specific route is involved in a matching operation.

*   **`_phantomParams?: TParams`**: This property is the secret to end-to-end type safety.
    > **Why the phantom?** This property doesn't exist at runtime; it's a TypeScript trick used to "carry" the inferred parameter type `TParams` with the `Route` object itself. Think of it like a label on a container that tells TypeScript what's *supposed* to be inside. This label is critically important for type-checking during development, but it's removed before the container is shipped (at runtime), so it has zero performance cost.

### Part 4: The Matching Engine - A Step-by-Step Trace

This is the most complex part of the router. It's not a simple loop; it's a multi-stage process to support full hierarchical matching.

**Scenario:**
*   **URL:** `/dashboard/users/42`
*   **Registered Routes:**
    *   `dashboardRoute = route(path('dashboard'))`
    *   `usersRoute = extend(dashboardRoute, path('users'))`
    *   `userDetailRoute = extend(usersRoute, param('id', NumberSchema))`

**The Algorithm in Action:**

1.  **Input:** `url = "/dashboard/users/42"`
2.  **Run All Parsers:** The engine iterates through *every* registered route and runs its composite parser against the URL.
    *   `dashboardRoute.parser.run(url)` -> **Success!** (consumed `/dashboard`, value `{}`, remaining `/users/42`)
    *   `usersRoute.parser.run(url)` -> **Success!** (consumed `/dashboard/users`, value `{}`, remaining `/42`)
    *   `userDetailRoute.parser.run(url)` -> **Success!** (consumed `/dashboard/users/42`, value `{id: 42}`, remaining ``)
3.  **Collect & Sort Successes by Consumed Length:** The results are sorted to find the most general (parent) to most specific (leaf).
    *   1. `dashboardRoute` (consumed 10 chars)
    *   2. `usersRoute` (consumed 16 chars)
    *   3. `userDetailRoute` (consumed 20 chars)
4.  **Build `RouteMatch` Tree:** A linked-list is constructed from the sorted results.
    *   Create `match1` for `dashboardRoute`.
    *   Create `match2` for `usersRoute`.
    *   Create `match3` for `userDetailRoute`.
    *   Link them: `match1.child = match2`, `match2.child = match3`.
5.  **Final Output:** The engine returns `match1`, the root of the match tree. The UI can then traverse this tree to render the nested layout.

**What if a parser fails?** In step 2, if a parser fails to match (e.g., if the URL was `/dashboard/users/abc` and the schema expected a number), it would simply be excluded from the list of successful matches. The algorithm would then proceed with the remaining successes, potentially matching only up to the parent `usersRoute`.

> **Key Takeaway:** The router doesn't just find the first match; it finds *all* matching route prefixes and builds them into a hierarchical `RouteMatch` tree, enabling nested layouts and parallel data loading.

### Part 5: The Navigation Lifecycle - An Orchestrated Flow

When you call `router.navigate(route, params)`, a precise sequence of events is triggered, visualized below:

```
[START] -> navigate(route, params)
   |
   v
[1. Build URL] --(fail)--> [RETURN ValidationFailed Error]
   |
   v
[2. Match URL] --(fail)--> [RETURN RouteNotFound Error]
   |
   v
[3. Run Guards] --(fail)--> [RETURN GuardRejected Error / REDIRECT]
   |
   v
[4. Load Data (in parallel)] --(fail)--> [RETURN LoaderFailed Error]
   |
   v
[5. Update State & Render (View Transitions)]
   |
   v
[6. Update History API]
   |
   v
[END] -> RETURN Success
```
This orchestrated flow ensures that data is only loaded after guards have passed, and the UI is only updated after data is available, providing a robust and predictable navigation experience.

> **Key Takeaway:** The lifecycle is designed for performance and correctness. By collecting all `loader` functions from the match tree and running them with `Promise.all`, the router prevents sequential data-loading "waterfalls" in nested routes.

### Part 6: The `makeLayered` System - Demystifying Composition

The layer system allows for a highly composable router. The "magic" is a clever use of closures and a fluent API. Here is a simplified version to reveal the mechanic:

```typescript
// A simplified implementation to demonstrate the core concept.
function simpleMakeLayered(context) {
  // The API object that will be built up, held in a closure.
  let currentApi = { context };

  // This is the function that gets returned and called repeatedly.
  function builder(layer) {
    // The base case: finalize the router when called with no arguments.
    if (!layer) {
      return currentApi;
    }

    // A layer is a function that receives the current API
    // and returns new methods (the extensions).
    const extensions = layer(currentApi);

    // Merge the new methods into our API object.
    Object.assign(currentApi, extensions);

    // CRUCIAL: Return the builder function itself. This creates the
    // fluent .()()() chain. The next call to builder will receive the
    // *updated* currentApi because it's captured in this closure.
    return builder;
  }

  return builder;
}

// How it's used:
const myRouter = simpleMakeLayered({ name: 'MyRouter' })
  (api => ({ // Layer 1
    getName: () => api.context.name
  }))
  (api => ({ // Layer 2 - can access methods from Layer 1
    greet: () => `Hello from ${api.getName()}`
  }))
  (); // Finalize by calling with no layer

console.log(myRouter.greet()); // "Hello from MyRouter"
```
The old `CombiRouter` class is now just a compatibility wrapper that uses `createLayeredRouter` to assemble all the standard layers (`core`, `data`, `dev`, etc.) into a single object that mimics the original API.

### Part 7: Advanced Feature Mechanics

*   **`createAdvancedResource` (Suspense)**: The `read()` method is a state machine. If the status is `pending`, it **throws a special promise**. This is the core contract of Suspense. A parent component or framework integration is expected to have a `try...catch` block. When it catches a promise, it knows the component is loading and can render a fallback UI. It then uses `.then()` on the caught promise to re-render the component when the data is ready.

*   **`HeadManager`**: This class maintains a `Set<Element>` of all DOM nodes it has ever created. When `apply()` is called, it first iterates through this set and removes every element it owns from the `<head>`, creating a clean slate. Then, it creates new `<title>`, `<meta>`, and `<link>` elements based on the new data and adds them to both the DOM and its internal `Set` for the next cleanup cycle.

*   **Web Components (`components-standalone.ts`)**:
    *   **The `RouterManager` Singleton**: This is a classic Mediator pattern. Components don't know about each other; they only talk to the manager.
    *   **Lifecycle Hooks & Batching**: When a `<view-area>` connects to the DOM, it calls `RouterManager.registerViewArea()`. A `setTimeout(..., 0)` is used to batch all the components that connect in the initial browser paint, building the router only *once* after the current synchronous block of code finishes.
    *   **Automatic Head Discovery**: The `<view-head>` component's `connectedCallback` cleverly uses `this.closest('template[is="view-template"]')` to find its parent template. It then gets the template's `view-id` and tells the `RouterManager` to associate its head data with that ID, creating an automatic link to the corresponding `<view-area>` without manual configuration.

### Part 8: Design Decisions & Trade-offs

*   **Why Immutability for Routes?**
    *   **Answer:** Predictability and safe composition. Since `extend` creates a *new* object, you can export a base route and be certain that no other part of the application can modify it. It makes the routing structure a pure function of its definitions.

*   **Why an Abstract `StandardSchema` instead of just using Zod?**
    *   **Answer:** Decoupling. While Zod is the recommended library, the router's core only depends on the `StandardSchemaV1` interface. This allows a project to use a different validation library (like Yup, Valibot, etc.) by simply creating a compatible adapter, without needing to change the router's source code.

*   **Trade-off: The `CombiRouter` Compatibility Wrapper**
    *   **Answer:** The existence of two APIs (`new CombiRouter()` vs `createLayeredRouter()`) adds a small amount of conceptual overhead. This was a deliberate choice to provide a smooth migration path for existing users and a simpler entry point for beginners, while still offering the full power of the layer system to advanced users.

*   **Trade-off: The Parser-Combinator Learning Curve**
    *   **Answer:** While powerful, the parser-combinator approach has a slightly steeper learning curve than simple string/regex matching for developers unfamiliar with the concept. We believe the dramatic improvements in type safety, composability, and refactorability are a worthwhile investment, but it's a trade-off compared to the immediate familiarity of a more traditional router.

*   **Why `setTimeout(..., 0)` in the Web Component Manager?**
    *   **Answer:** To handle the initial component registration storm. When a browser first renders the page, all `<view-area>` components might call `connectedCallback` in a single, synchronous batch. Rebuilding the router for each one would be inefficient. `setTimeout` schedules the `rebuildRouter` call to happen *after* the current synchronous block has finished, effectively batching all initial registrations into a single, efficient rebuild operation.

By understanding these core mechanics—parsing, the `RouteMatcher` contract, hierarchical matching, the navigation lifecycle, and the layer system—you have the complete conceptual blueprint to build a powerful, type-safe, and composable routing library.

Of course. The provided README is excellent but is missing documentation for some of the powerful new features we've implemented, such as **Suspense-based data loading**, **Preloading**, and **View Transitions**.

I have updated the "Advanced Features" and "API Reference" sections to include these new capabilities, complete with explanations and code examples. This will give users a complete picture of the router's modern feature set.

Here is the updated, final README.

***

# Combi-Router

A composable, type-safe router built on parser combinators that thinks in trees. Routes are defined functionally and composed by reference, creating natural hierarchies that mirror your application structure.

<br />

## 📦 Installation

```bash
npm install @doeixd/combi-router @doeixd/combi-parse zod
```

Combi-Router is built on `@doeixd/combi-parse` for robust URL parsing and uses `zod` for powerful, type-safe parameter validation.

<br />

## ✨ Key Features

- **Reference-Based Navigation**: Navigate using route objects for perfect type safety.
- **Functional Composition**: Build routes by composing pure functions instead of method chaining.
- **Hierarchical Matching**: Routes extend each other by reference, creating intuitive, nested trees.
- **Parallel Data Loading**: Loaders for all active nested routes run concurrently for maximum speed.
- **Suspense & Resources**: Elegant, built-in support for handling asynchronous data states.
- **View Transitions**: App-like animated page transitions are enabled by default in supported browsers.
- **End-to-End Type Safety**: Full TypeScript inference from route definition to data access.
- **Production Ready**: Caching, preloading, guards, lazy-loading, and error boundaries.
- **Framework Agnostic**: Works with React, Vue, Svelte, or vanilla JavaScript.

<br />

## 🚀 Quick Start

Let's start simple and build up your understanding step by step.

### Understanding Routes

A **route** in Combi-Router is a blueprint that describes a URL's structure and behavior.

```typescript
import { route, path } from 'combi-router';

// This route matches the exact path "/users"
export const usersRoute = route(path('users'));
```

The `route()` function creates a new route from **matchers**. Matchers are small building blocks that each handle one part of a URL.

**Why export routes?** Routes are first-class objects you'll reference throughout your app for navigation, so treating them as exportable values makes them reusable and type-safe.

### Basic Matchers

```typescript
import { route, path, param } from 'combi-router';
import { z } from 'zod';

// Static path segment
export const aboutRoute = route(path('about'));  // matches "/about"

// Dynamic parameter with validation
export const userRoute = route(
  path('users'),
  param('id', z.number())  // matches "/users/123" -> params.id is a number
);
```

**Why validation?** URLs are just strings. By validating during route matching, you catch errors early and get proper TypeScript types for your parameters.

### Building Route Trees

The real power comes from **composing routes by reference**. Instead of redefining common parts, you `extend` existing routes:

```typescript
import { extend } from 'combi-router';

// Base route
export const dashboardRoute = route(path('dashboard'));

// Extend the base route
export const usersRoute = extend(dashboardRoute, path('users'));
export const userRoute = extend(usersRoute, param('id', z.number()));

// This creates a natural tree:
// /dashboard           <- dashboardRoute
// /dashboard/users     <- usersRoute  
// /dashboard/users/123 <- userRoute
```

**Why extend?** When you change the base route (e.g., to `/admin`), all extended routes automatically update. Your route structure mirrors your application structure.

### Adding Behavior with Higher-Order Functions

Enhance routes with additional behavior using `pipe()` and higher-order functions:

```typescript
import { meta, loader, layout, pipe } from 'combi-router';

export const enhancedUserRoute = pipe(
  userRoute,
  meta({ title: 'User Profile' }),
  loader(async ({ params }) => {
    const user = await fetchUser(params.id);
    return { user };
  }),
  layout(ProfileLayout)
);
```

**Why higher-order functions?** They're composable and reusable. You can create your own enhancers and mix them with built-in ones.

### Creating the Router

Once you have routes, create a router instance from an array of all your routes:

```typescript
import { createRouter } from 'combi-router';

const router = createRouter([
  dashboardRoute,
  usersRoute,
  enhancedUserRoute
]);

// Reference-based navigation with perfect type safety
await router.navigate(enhancedUserRoute, { id: 123 });

// Type-safe URL building
const userUrl = router.build(enhancedUserRoute, { id: 123 }); // "/dashboard/users/123"
```

**Why route references?** Using actual route objects instead of string names provides perfect type inference and makes refactoring safe. TypeScript knows exactly what parameters each route needs.

<br />

## 🏗️ Core Concepts

### Route Matchers

Matchers are the building blocks of routes. Each matcher handles one aspect of URL parsing:

```typescript
// Path segments
path('users')                    // matches "/users"
path.optional('category')        // matches "/category" or ""
path.wildcard('segments')        // matches "/any/number/of/segments"

// Parameters with validation
param('id', z.number())          // matches "/123" and validates as number
param('slug', z.string().min(3)) // matches "/hello" with minimum length

// Query parameters
query('page', z.number().default(1)) // matches "?page=5"
query.optional('search', z.string()) // matches "?search=term"

// Other components
end                              // ensures no remaining path segments
// subdomain(...) and hash(...) can be added with similar patterns
```

### Route Composition

Routes are composed functionally using `extend()`:

```typescript
export const apiRoute = route(path('api'), path('v1'));
export const usersRoute = extend(apiRoute, path('users'));
export const userRoute = extend(usersRoute, param('id', z.number()));

// userRoute now matches /api/v1/users/123
```

Parameters from parent routes are automatically inherited and merged into a single `params` object.

### Higher-Order Route Enhancers

Enhance routes with additional functionality:

```typescript
import { pipe, meta, loader, guard, cache, lazy } from 'combi-router';

export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  meta({ title: (params) => `User ${params.id}` }),
  loader(async ({ params }) => ({ user: await fetchUser(params.id) })),
  guard(async () => await isAuthenticated() || '/login'),
  cache({ ttl: 5 * 60 * 1000 }), // Cache for 5 minutes
  lazy(() => import('./UserProfile'))
);
```

<br />

## 🗂️ Advanced Features

### Nested Routes and Parallel Data Loading

When a nested route like `/dashboard/users/123` is matched, Combi-Router builds a tree of match objects. If both `dashboardRoute` and `userRoute` have a `loader`, they are executed **in parallel**, and you can access data from any level of the hierarchy.

```typescript
// dashboard-layout.ts
const dashboardRoute = pipe(
  route(path('dashboard')),
  loader(async () => ({ stats: await fetchDashboardStats() })),
  layout(DashboardLayout) // Layout component with <Outlet />
);

// user-profile.ts
const userRoute = pipe(
  extend(dashboardRoute, path('users'), param('id', z.number())),
  loader(async ({ params }) => ({ user: await fetchUser(params.id) }))
);

// In your view for the user route, you can access both sets of data:
const dashboardData = router.currentMatch.data; // { stats: ... }
const userData = router.currentMatch.child.data; // { user: ... }
```

### Suspense-based Data Loading with Resources

For a more granular loading experience, `loader` functions can return `Resource` objects. This allows your UI to "suspend" rendering until the data is ready, which is perfect for showing fine-grained loading spinners.

```typescript
import { createResource } from 'combi-router';

export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  loader(({ params }) => ({
    // Each of these will be fetched in parallel by the browser
    user: createResource(() => fetchUser(params.id)),
    posts: createResource(() => fetchUserPosts(params.id))
  }))
);

// In your UI component (pseudo-code):
function UserProfile() {
  const { user, posts } = router.currentMatch.data;
  
  return (
    <div>
      {/* This component suspends until user data is ready */}
      <UserDetails resource={user} />
      {/* This component suspends until posts data is ready */}
      <PostList resource={posts} />
    </div>
  );
}
```

### Predictive Preloading

Improve perceived performance by loading a route's code and data *before* the user clicks a link. The `router.peek()` method is perfect for this.

```typescript
// Preload on hover to make navigation feel instantaneous
myLink.addEventListener('mouseenter', () => {
  router.peek(userRoute, { id: 123 });
});

// Navigate as usual on click
myLink.addEventListener('click', (e) => {
  e.preventDefault();
  router.navigate(userRoute, { id: 123 });
});
```

### View Transitions

Combi-Router automatically uses the browser's native [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) for smooth, app-like page transitions. To enable it, simply add a CSS `view-transition-name` to elements that should animate between pages.

```css
/* On a list page */
.product-thumbnail {
  view-transition-name: product-image-123;
}

/* On a detail page */
.product-hero-image {
  view-transition-name: product-image-123; /* Same name! */
}
```

The router handles the rest. No JavaScript changes are needed.

<br />

## ⚙️ Configuration & API

### Router Creation

```typescript
const router = createRouter(
  [homeRoute, usersRoute, userRoute], // An array of all routes
  {
    baseURL: 'https://myapp.com', // For running in a subdirectory
    hashMode: false, // Use `/#/path` style URLs
  }
);
```

### Error Handling

```typescript
// Define a fallback route for any URL that doesn't match
router.fallback(notFoundRoute);

// Define a global error handler for failures during navigation
router.onError(({ error, to, from }) => {
  console.error('Navigation error:', error);
  // Send to an error tracking service
});
```

### API Reference

#### Core Functions

- `route(...matchers)`: Creates a new base route.
- `extend(baseRoute, ...matchers)`: Creates a new child route from a base.
- `createRouter(routes, options?)`: Creates the router instance.
- `createResource(promiseFn)`: Wraps an async function in a suspense-ready resource.

#### Route Matchers

- `path(segment)`: Matches a static path segment.
- `path.optional(segment)`: Matches an optional path segment.
- `path.wildcard(name?)`: Matches all remaining path segments into an array.
- `param(name, schema)`: Matches a dynamic parameter with Zod validation.
- `query(name, schema)`: Declares a required query parameter with Zod validation.
- `query.optional(name, schema)`: Declares an optional query parameter.
- `end`: Ensures the path has no remaining segments.

#### Higher-Order Enhancers

- `pipe(route, ...enhancers)`: Applies a series of enhancers to a route.
- `meta(metadata)`: Attaches arbitrary metadata to a route.
- `loader(loaderFn)`: Adds a data-loading function to a route.
- `layout(component)`: Associates a layout component with a route.
- `guard(...guardFns)`: Protects a route with one or more guard functions.
- `cache(options)`: Adds caching behavior to a route's loader.
- `lazy(importFn)`: Makes a route's component lazy-loaded.

#### Router Methods

- `navigate(route, params)`: Programmatically navigates to a route.
- `build(route, params)`: Generates a URL string for a route.
- `match(url)`: Matches a URL and returns the corresponding `RouteMatch` tree.
- `peek(route, params)`: Proactively loads a route's code and data.
- `subscribe(listener)`: Subscribes to route changes.

#### Router Properties

- `currentMatch`: The currently active `RouteMatch` object tree, or `null`.
- `isNavigating`: A boolean indicating if a navigation is in progress.
- `isFetching`: A boolean indicating if any route loaders are active.
- `routes`: A flat array of all registered route objects.

<br />

## 🎁 Benefits of Reference-Based Approach

- **Perfect Type Safety**: Impossible to make typos in route names or pass incorrect parameter types.
- **Better IDE Support**: Get autocompletion for routes and `go-to-definition` that works.
- **Confident Refactoring**: Rename a route or change its parameters, and TypeScript will instantly show you everywhere that needs to be updated.
- **Functional Composition**: Routes are first-class values that can be imported, exported, and composed with pure functions.
- **Framework Agnostic**: The core logic is pure TypeScript, allowing for simple integration with any framework or vanilla JS.

<br />

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

<br />

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.
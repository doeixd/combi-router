# Combi-Router

A composable, type-safe router built on parser combinators that thinks in trees. Routes are defined functionally and composed by reference, creating natural hierarchies that mirror your application structure.

<br />

## 📦 Installation

```bash
npm install @doeixd/combi-router @doeixd/combi-parse zod
```

Combi-Router is built on `@doeixd/combi-parse` for robust URL parsing and uses `zod` or another Standard Schema compliant library for parameter validation.

<br />

## ✨ Key Features

- **Reference-Based Navigation**: Navigate using route objects for perfect type safety
- **Functional Composition**: Routes are built by composing pure functions, not method chaining
- **Natural Tree Structure**: Routes extend each other by reference, creating intuitive hierarchies  
- **Parser Combinator Foundation**: Built on proven parsing technology for reliable URL matching
- **End-to-End Type Safety**: Full TypeScript inference from route definition to navigation
- **Framework Agnostic**: Works with React, Vue, Svelte, or vanilla JavaScript
- **Production Ready**: SSR, lazy loading, error boundaries, analytics, accessibility
- **Nested Routes**: First-class support for layouts and nested UI structures
- **Advanced Features**: Caching, preloading, guards, middleware, plugins

<br />

## 🚀 Quick Start

Let's start simple and build up your understanding step by step.

### Understanding Routes

A **route** in Combi-Router is like a URL pattern that knows how to match and extract data from URLs. Think of it as a blueprint that describes what a URL should look like.

```typescript
import { route, path } from 'combi-router';

// This route matches the exact path "/users"
export const usersRoute = route(path('users'));
```

The `route()` function creates a new route from **matchers**. Matchers are small building blocks that each handle one part of a URL.

**Why export routes?** Routes are objects you'll reference throughout your app for navigation, so treating them as exportable values makes them reusable and type-safe.

### Basic Matchers

```typescript
import { route, path, param } from 'combi-router';
import { z } from 'zod';

// Static path segment
export const aboutRoute = route(path('about'));  // matches "/about"

// Dynamic parameter with validation
export const userRoute = route(
  path('users'),
  param('userId', z.number())  // matches "/users/123"
);
```

**Why validation?** URLs are just strings, but your application expects typed data. By validating during route matching, you catch errors early and get proper TypeScript types.

### Building Route Trees

The real power comes from **composing routes by reference**. Instead of redefining common parts, you extend existing routes:

```typescript
import { extend } from 'combi-router';

// Base route
export const dashboardRoute = route(path('dashboard'));

// Extend the base route
export const usersRoute = extend(dashboardRoute, path('users'));
export const userRoute = extend(usersRoute, param('userId', z.number()));

// This creates a natural tree:
// /dashboard           <- dashboardRoute
// /dashboard/users     <- usersRoute  
// /dashboard/users/123 <- userRoute
```

**Why extend instead of redefine?** When you change the base route, all extended routes automatically update. Your route structure mirrors your application structure.

### Adding Behavior with Higher-Order Functions

Routes can be enhanced with additional behavior using **higher-order functions**. These are functions that take a route and return an enhanced version:

```typescript
import { meta, loader, layout, pipe } from 'combi-router';

export const enhancedUserRoute = pipe(
  userRoute,
  meta({ title: 'User Profile' }),
  loader(async ({ params }) => {
    const user = await fetchUser(params.userId);
    return { user };
  }),
  layout(ProfileLayout)
);
```

**Why higher-order functions?** They're composable and reusable. You can create your own enhancers and mix them with built-in ones.

### Creating the Router

Once you have routes, create a router from an array of routes:

```typescript
import { createRouter } from 'combi-router';

const router = createRouter([
  dashboardRoute,
  usersRoute,
  enhancedUserRoute
]);

// Reference-based navigation with perfect type safety
await router.navigate(enhancedUserRoute, { userId: 123 });

// Type-safe URL building
const userUrl = router.build(enhancedUserRoute, { userId: 123 }); // "/dashboard/users/123"
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
query('page', z.number().default(1))           // matches "?page=5"
query.optional('search', z.string())           // matches "?search=term"

// Other components
subdomain('api')                 // matches "api.example.com"
hash(z.string())                 // matches "#section"
end                              // ensures no remaining path
```

### Route Composition

Routes are composed functionally using `extend()`:

```typescript
export const apiRoute = route(subdomain('api'), path('v1'));
export const usersRoute = extend(apiRoute, path('users'));
export const userRoute = extend(usersRoute, param('id', z.number()));

// Results in: api.example.com/v1/users/123
```

Parameters from parent routes are automatically inherited:

```typescript
// userRoute has access to all parameters from its ancestors
type UserParams = InferParams<typeof userRoute>; // { id: number }
```

### Higher-Order Route Enhancers

Enhance routes with additional functionality:

```typescript
import { pipe, meta, loader, guard, cache } from 'combi-router';

export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  meta({
    title: (params) => `User ${params.id}`,
    description: 'User profile page'
  }),
  loader(async ({ params }) => {
    return { user: await fetchUser(params.id) };
  }),
  guard(async ({ params }) => {
    return await canViewUser(params.id) || '/unauthorized';
  }),
  cache({ ttl: 5 * 60 * 1000 }) // Cache for 5 minutes
);
```

<br />

## 🎯 Framework Integration

### React

```typescript
import { userRoute, usersRoute } from './routes';

const { RouterProvider, useRouter, useParams, Link, Outlet } = router.createReactIntegration();

function App() {
  return (
    <RouterProvider>
      <nav>
        <Link to={userRoute} params={{ userId: 123 }}>
          User Profile
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </RouterProvider>
  );
}

function UserPage() {
  const { userId } = useParams<{ userId: number }>();
  const navigate = useNavigate();
  
  return (
    <div>
      <h1>User {userId}</h1>
      <button onClick={() => navigate(usersRoute, {})}>
        Back to Users
      </button>
    </div>
  );
}
```

### Vue

```typescript
import { userRoute } from './routes';

const { RouterPlugin, useRoute, RouterView } = router.createVueIntegration();

// Install plugin
app.use(RouterPlugin, router);

// Use in components
const UserPage = defineComponent({
  setup() {
    const route = useRoute();
    const params = useParams();
    
    return { route, params };
  }
});
```

### Svelte

```typescript
import { userRoute } from './routes';

const { route, navigate, link } = router.createSvelteIntegration();

// Use in Svelte components
<script>
  import { route, navigate } from './router.js';
  
  $: currentRoute = $route;
  
  function goToUser(id) {
    navigate(userRoute, { userId: id });
  }
</script>

<a href="/users/123" use:link={{ to: userRoute, params: { userId: 123 } }}>
  User Profile
</a>
```

<br />

## 🗂️ Advanced Features

### Nested Routes and Layouts

Create nested UI structures with layouts and outlets:

```typescript
export const dashboardRoute = pipe(
  route(path('dashboard')),
  layout(DashboardLayout) // Layout component with <Outlet />
);

export const userRoute = pipe(
  extend(dashboardRoute, path('users'), param('id', z.number())),
  meta({ outlet: 'main' }) // Render in specific outlet
);

// DashboardLayout.jsx
function DashboardLayout() {
  return (
    <div>
      <aside>Dashboard Sidebar</aside>
      <main>
        <Outlet name="main" />
      </main>
    </div>
  );
}
```

### Data Loading

Load data before rendering components:

```typescript
export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  loader(async ({ params, signal }) => {
    // Data is available to components as props or through hooks
    const user = await fetchUser(params.id, { signal });
    const posts = await fetchUserPosts(params.id);
    return { user, posts };
  }),
  // Parallel loading
  loader(async ({ params }) => ({
    $parallel: true,
    user: () => fetchUser(params.id),
    profile: () => fetchUserProfile(params.id),
    settings: () => fetchUserSettings(params.id)
  }))
);
```

### Route Guards

Protect routes with guards:

```typescript
export const adminRoute = pipe(
  route(path('admin')),
  guard(async (context) => {
    const user = await getCurrentUser();
    if (!user) return '/login';
    if (!user.isAdmin) return '/forbidden';
    return true; // Allow navigation
  })
);
```

### Lazy Loading

Split code with lazy routes:

```typescript
export const adminRoute = pipe(
  route(path('admin')),
  lazy(() => import('./AdminPanel'), {
    preload: 'hover', // Preload on hover
    fallback: { component: LoadingSpinner }
  })
);
```

### Caching

Cache route data and components:

```typescript
export const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  cache({
    key: (params) => `user-${params.id}`,
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: true
  })
);
```

<br />

## ⚙️ Configuration

### Router Creation Options

```typescript
// Array-based (primary API)
const router = createRouter([homeRoute, usersRoute, userRoute], {
  baseURL: 'https://myapp.com',
  hashMode: false,
  
  // Performance optimization
  compilation: {
    enableCaching: true,
    optimization: 'balanced'
  },
  
  // Server-side rendering
  ssr: true,
  
  // Internationalization
  i18n: {
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en',
    strategy: 'prefix'
  },
  
  // Security
  security: {
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", 'cdn.example.com']
    }
  },
  
  // Accessibility
  a11y: {
    focusManagement: 'auto',
    announceRouteChanges: true
  }
});

// Named routes (backward compatibility)
const router = createRouter({
  HOME: homeRoute,
  USERS: usersRoute,
  USER: userRoute
});
```

### Error Handling

```typescript
import { notFoundRoute, serverErrorRoute, defaultRoute } from './errorRoutes';

// Custom error routes
router.catch(404, notFoundRoute);
router.catch(500, serverErrorRoute);
router.fallback(defaultRoute);

// Global error handler
router.onError((error, context) => {
  console.error('Navigation error:', error);
  // Send to error tracking service
});
```

### Lifecycle Hooks

```typescript
// Global hooks
router.beforeLoad(async (context) => {
  if (context.to.metadata?.requiresAuth && !await isAuthenticated()) {
    await router.navigate(loginRoute, {});
    return 'redirect';
  }
  return 'allow';
});

// Route-specific hooks using references
router.beforeLoad(userRoute, async (context) => {
  // context.params is perfectly typed as { userId: number }
  const userExists = await checkUserExists(context.params.userId);
  return userExists ? 'allow' : 'block';
});
```

<br />

## 📚 API Reference

### Core Functions

#### `route(...matchers)`
Creates a new route from matchers.

```typescript
export const userRoute = route(
  path('users'),
  param('id', z.number())
);
```

#### `extend(baseRoute, ...additionalMatchers)`
Extends an existing route with additional matchers.

```typescript
export const userPostsRoute = extend(
  userRoute,
  path('posts')
);
```

#### `createRouter(routes, options?)`
Creates a router instance.

```typescript
// Array-based (primary API)
const router = createRouter([userRoute, userPostsRoute]);

// Named routes (backward compatibility)
const router = createRouter({
  USER: userRoute,
  USER_POSTS: userPostsRoute
});
```

### Route Matchers

#### Path Matchers
- `path(segment)` - Matches static path segment
- `path.optional(segment)` - Matches optional path segment
- `path.wildcard(name?)` - Matches remaining path segments
- `param(name, schema)` - Matches dynamic parameter with validation

#### Query Matchers
- `query(name, schema)` - Matches required query parameter
- `query.optional(name, schema)` - Matches optional query parameter

#### Other Matchers
- `subdomain(name)` - Matches static subdomain
- `subdomain.param(name, schema)` - Matches dynamic subdomain
- `hash(schema)` - Matches URL hash fragment
- `end` - Ensures end of path

### Higher-Order Enhancers

#### `meta(metadata)`
Adds metadata to a route.

```typescript
meta({
  title: 'Page Title',
  description: 'Page description',
  breadcrumbs: ['Home', 'Users']
})
```

#### `loader(loaderFunction)`
Adds data loading to a route.

```typescript
loader(async ({ params, signal }) => {
  return await fetchData(params.id);
})
```

#### `layout(component, props?)`
Wraps route with a layout component.

```typescript
layout(MainLayout, { showSidebar: true })
```

#### `lazy(importFunction, options?)`
Makes route lazy-loaded.

```typescript
lazy(() => import('./Component'), {
  preload: 'hover',
  fallback: LoadingComponent
})
```

#### `guard(...guardFunctions)`
Adds route guards.

```typescript
guard(async (context) => {
  return await checkPermission() || '/unauthorized';
})
```

#### `cache(options)`
Adds caching to route.

```typescript
cache({
  key: (params) => `cache-key-${params.id}`,
  ttl: 300000
})
```

### Router Methods

#### Navigation (Reference-Based)
- `navigate(route, params, options?)` - Navigate using route reference
- `build(route, params)` - Build URL using route reference
- `navigate(routeName, params, options?)` - Navigate using route name (legacy)
- `build(routeName, params)` - Build URL using route name (legacy)

#### Other Methods
- `match(url)` - Match URL against routes
- `goBack()` - Navigate back in history
- `goForward()` - Navigate forward in history

#### Lifecycle
- `beforeLoad(hook)` - Add global before load hook
- `beforeLoad(route, hook)` - Add route-specific before load hook
- `beforeLeave(hook)` - Add global before leave hook
- `beforeLeave(route, hook)` - Add route-specific before leave hook
- `onRedirect(hook)` - Add redirect hook
- `onError(handler)` - Add error handler

#### Properties
- `currentMatch` - Current route match
- `isNavigating` - Whether navigation is in progress
- `routes` - Array of all routes

### Framework Integration

#### React Hooks
- `useRouter()` - Access router instance
- `useCurrentRoute()` - Access current route
- `useParams<T>()` - Access route parameters
- `useSearchParams()` - Access search parameters
- `useNavigate()` - Get navigation function

#### React Components
- `<RouterProvider>` - Provides router context
- `<Link to={route} params={...}>` - Navigation link with route reference
- `<Outlet name="default">` - Renders child routes

### Development Tools

#### `router.devTools(options)`
Enable development features.

```typescript
router.devTools({
  showRouteTree: true,
  trackPerformance: true,
  logNavigations: true
});
```

#### Performance Monitoring
- `getPerformanceMetrics()` - Get route timing data
- `getSlowRoutes(threshold)` - Find slow routes
- `debug(route)` - Debug specific route

#### Route Introspection
- `tree()` - Display route hierarchy
- `isAncestor(ancestor, descendant)` - Check route relationships
- `getChildren(baseRoute)` - Get child routes
- `getParams(route)` - Get route parameter names
- `findRoute(routeOrName)` - Find route by reference or name

<br />

## 🧪 Testing

### Mock Router

```typescript
import { userRoute } from './routes';

const mockRouter = CombiRouter.createMockRouter([userRoute], {
  initialRoute: userRoute,
  initialParams: { userId: 123 },
  mockLoaders: {
    [userRoute.id]: { user: { name: 'Test User' } }
  }
});

// Test navigation
await mockRouter.navigate(userRoute, { userId: 456 });
mockRouter.expectRoute(userRoute, { userId: 456 });
```

### React Testing

```typescript
const TestWrapper = router.createTestWrapper(userRoute, { userId: 123 });

render(
  <TestWrapper>
    <UserComponent />
  </TestWrapper>
);
```

<br />

## 🔧 Migration & Compatibility

### From React Router

```typescript
// React Router
<Route path="/users/:id" component={UserPage} />

// Combi Router
export const userRoute = pipe(
  route(path('users'), param('id', z.string())),
  meta({ component: UserPage })
);
```

### From String-Based Routing

```typescript
// Old approach (still supported)
await router.navigate('USER', { userId: 123 });
const url = router.build('USER', { userId: 123 });

// New reference-based approach (recommended)
await router.navigate(userRoute, { userId: 123 });
const url = router.build(userRoute, { userId: 123 });
```

### Migration Strategy

1. **Start with named routes**: Keep your existing string-based navigation
2. **Export route objects**: Begin exporting routes as reusable objects
3. **Gradually migrate navigation**: Replace string navigation with route references
4. **Update framework integration**: Use route references in Link components
5. **Switch to array-based router**: Move from named routes to route arrays

<br />

## 🎁 Benefits of Reference-Based Approach

### Perfect Type Safety
- TypeScript infers parameter types directly from route objects
- Impossible to make typos in route names
- Refactoring route definitions shows immediate type errors everywhere

### Better IDE Support
- Autocomplete for route objects
- Go-to-definition jumps to route definitions
- Rename refactoring works across the entire codebase

### Functional Composition
- Routes are first-class values that can be imported/exported
- Natural composition with `extend()` and `pipe()`
- Clean separation of route definition and usage

### Framework Agnostic
- Route references work identically in React, Vue, Svelte
- No framework-specific route naming conventions
- Consistent API across all environments

<br />

## 📖 Examples

- [Basic Routing](./examples/basic-routing.md)
- [Reference-Based Navigation](./examples/reference-navigation.md)
- [Nested Layouts](./examples/nested-layouts.md)
- [Authentication](./examples/authentication.md)
- [Data Loading](./examples/data-loading.md)
- [Server-Side Rendering](./examples/ssr.md)
- [TypeScript Integration](./examples/typescript.md)
- [Migration Guide](./examples/migration.md)

<br />

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

<br />

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.
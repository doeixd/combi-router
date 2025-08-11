# Error Handling Strategies

The CombiRouter error strategy system provides flexible control over how navigation errors are handled throughout your application. This allows different layers and use cases to handle errors in ways that make sense for their specific context.

## Table of Contents

- [Philosophy](#philosophy)
- [Basic Usage](#basic-usage)
- [Available Strategies](#available-strategies)
- [Custom Strategies](#custom-strategies)
- [Error Types](#error-types)
- [Integration with Layers](#integration-with-layers)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Philosophy

### The Problem

In a layered router architecture, different layers have different error handling needs:

- **Testing layers** expect errors to be thrown so tests can assert on them
- **View layers** want to catch errors and display error UI gracefully
- **Data layers** might want to retry on certain errors
- **Analytics layers** want to observe all errors without interfering

Previously, the router would always throw errors, forcing view layers to wrap every navigation in try-catch blocks, leading to verbose and error-prone code.

### The Solution

The error strategy pattern separates error **notification** from error **propagation**:

1. **All errors are always communicated through lifecycle hooks** (the separate error channel)
2. **The strategy determines if errors also cause promise rejection**
3. **Each layer can choose its appropriate strategy**

This provides both flexibility and predictability:
- Layers that need to handle errors in UI get graceful handling
- Layers that need to test error conditions get thrown errors
- All layers can observe errors through hooks regardless of strategy

## Basic Usage

### Setting a Strategy

Configure the error strategy when creating the core navigation layer:

```typescript
import { 
  createLayeredRouter, 
  createCoreNavigationLayer,
  createViewLayer 
} from '@doeixd/combi-router';

// For UI applications - errors handled gracefully
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    errorStrategy: 'graceful' 
  })
)(
  createViewLayer({
    root: '#app',
    errorView: (error) => `<div class="error">${error.message}</div>`,
    notFoundView: () => '<h1>404 - Page Not Found</h1>'
  })
)();

// Navigation won't throw, even for errors
await router.navigate('/nonexistent'); // Returns false, shows 404 view
```

### Default Behavior (Backward Compatible)

If no strategy is specified, the default `'throw'` strategy is used, maintaining backward compatibility:

```typescript
// Default behavior - throws errors
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer() // Uses 'throw' strategy by default
)();

// This will throw an error
try {
  await router.navigate('/nonexistent');
} catch (error) {
  console.error('Navigation failed:', error);
}
```

## Available Strategies

### `'throw'` Strategy (Default)

All errors cause promise rejection. Use this for:
- Testing environments
- Backward compatibility
- Applications with global error handlers

```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'throw' 
})
```

**Behavior:**
- ✅ Route not found → Throws error
- ✅ Loader failure → Throws error  
- ✅ Guard rejection → Throws error
- ✅ Other navigation errors → Throws error

### `'graceful'` Strategy

Errors are handled through lifecycle hooks only, navigation returns `false` on failure. Use this for:
- Production UI applications
- View layers with error UI
- User-facing applications

```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'graceful' 
})
```

**Behavior:**
- ✅ Route not found → Returns `false`, triggers `onNavigationError`
- ✅ Loader failure → Returns `false`, triggers `onNavigationError`
- ✅ Guard rejection → Returns `false`, triggers `onNavigationError`
- ✅ Other navigation errors → Returns `false`, triggers `onNavigationError`

### `'selective'` Strategy

Fine-grained control over which errors throw. Use this for:
- Mixed environments
- Gradual migration
- Complex error handling requirements

```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'selective',
  selectiveStrategyOptions: {
    throwNotFound: false,      // Don't throw for 404s
    throwLoaderError: true,    // Throw for loader failures
    throwGuardRejection: true, // Throw for guard rejections
    throwNavigationError: true // Throw for other errors
  }
})
```

## Custom Strategies

Create custom strategies by implementing the `ErrorStrategy` interface:

```typescript
import { ErrorStrategy } from '@doeixd/combi-router';

class CustomErrorStrategy implements ErrorStrategy {
  shouldThrowNotFound(url: string): boolean {
    // Don't throw for 404s in production
    return process.env.NODE_ENV !== 'production';
  }

  shouldThrowLoaderError(error: Error): boolean {
    // Only throw for non-network errors
    return !error.message.includes('NetworkError');
  }

  shouldThrowGuardRejection(reason: any): boolean {
    // Always throw for guard rejections (security)
    return true;
  }

  shouldThrowNavigationError(error: Error): boolean {
    // Throw for unexpected errors
    return true;
  }
}

// Use the custom strategy
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    errorStrategy: new CustomErrorStrategy() 
  })
)();
```

### Example: Retry Strategy

```typescript
class RetryErrorStrategy implements ErrorStrategy {
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  shouldThrowNotFound(url: string): boolean {
    // Always handle 404s gracefully
    return false;
  }

  shouldThrowLoaderError(error: Error): boolean {
    const key = error.message;
    const attempts = this.retryAttempts.get(key) || 0;
    
    if (attempts < this.maxRetries) {
      this.retryAttempts.set(key, attempts + 1);
      return false; // Don't throw, allow retry
    }
    
    return true; // Throw after max retries
  }

  shouldThrowGuardRejection(reason: any): boolean {
    return true; // Always throw for security
  }

  shouldThrowNavigationError(error: Error): boolean {
    return true;
  }
}
```

### Example: Logging Strategy

```typescript
class LoggingErrorStrategy extends GracefulErrorStrategy {
  shouldThrowNotFound(url: string): boolean {
    console.warn(`[Router] 404 Not Found: ${url}`);
    analytics.track('404_error', { url });
    return super.shouldThrowNotFound(url);
  }

  shouldThrowLoaderError(error: Error): boolean {
    console.error('[Router] Loader Error:', error);
    errorReporting.captureException(error);
    return super.shouldThrowLoaderError(error);
  }
}
```

## Error Types

The strategy methods correspond to different error scenarios:

### Not Found Errors
Triggered when no route matches the navigation URL.

```typescript
shouldThrowNotFound(url: string): boolean
```

**When it occurs:**
- Navigating to a URL with no matching route
- No fallback route configured

**Hook data:**
```typescript
{
  type: 'not-found',
  url: string,
  message: 'No route matches: ...'
}
```

### Loader Errors
Triggered when a route's data loader throws an error.

```typescript
shouldThrowLoaderError(error: Error): boolean
```

**When it occurs:**
- Loader function throws
- Async loader rejects
- Data fetching fails

**Hook data:**
```typescript
{
  type: 'loader-error',
  error: Error,
  route: Route,
  params: RouteParams
}
```

### Guard Rejections
Triggered when a route guard prevents navigation.

```typescript
shouldThrowGuardRejection(reason: any): boolean
```

**When it occurs:**
- Guard returns `false`
- Guard throws error
- Authentication/authorization fails

**Hook data:**
```typescript
{
  type: 'guard-rejection',
  reason: any,
  route: Route,
  params: RouteParams
}
```

### Navigation Errors
Generic navigation errors not covered by other categories.

```typescript
shouldThrowNavigationError(error: Error): boolean
```

**When it occurs:**
- Timeout errors
- Unexpected exceptions
- System errors

## Integration with Layers

### View Layer Integration

The view layer works seamlessly with the graceful strategy:

```typescript
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    errorStrategy: 'graceful' // No throwing
  })
)(
  createViewLayer({
    root: '#app',
    errorView: (error) => `
      <div class="error">
        <h2>Error</h2>
        <p>${error.message}</p>
        <button onclick="history.back()">Go Back</button>
      </div>
    `,
    notFoundView: () => `
      <div class="not-found">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/">Go Home</a>
      </div>
    `
  })
)();

// Clean navigation without try-catch
await router.navigate('/users/123'); // Success
await router.navigate('/nonexistent'); // Shows 404 view
```

### Testing Layer Integration

Tests can use the throw strategy for assertions:

```typescript
describe('Router Tests', () => {
  const router = createLayeredRouter(routes)(
    createCoreNavigationLayer({ 
      errorStrategy: 'throw' // Errors throw for testing
    })
  )();

  it('should throw on invalid route', async () => {
    await expect(router.navigate('/invalid')).rejects.toThrow(
      'No route matches: /invalid'
    );
  });

  it('should throw on loader error', async () => {
    await expect(router.navigate('/error-route')).rejects.toThrow(
      'Data loading failed'
    );
  });
});
```

### Mixed Strategy Example

Different strategies for different environments:

```typescript
const errorStrategy = process.env.NODE_ENV === 'test' 
  ? 'throw'           // Throw in tests
  : process.env.NODE_ENV === 'development'
  ? 'selective'       // Selective in development
  : 'graceful';       // Graceful in production

const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    errorStrategy,
    selectiveStrategyOptions: {
      throwNotFound: false,  // Show 404 page
      throwLoaderError: true, // Throw to see stack traces
      throwGuardRejection: false,
      throwNavigationError: true
    }
  })
)(/* other layers */)();
```

## Migration Guide

### From Try-Catch Pattern

**Before:**
```typescript
// Old pattern - verbose try-catch everywhere
try {
  await router.navigate('/users/123');
} catch (error) {
  if (error.message.includes('No route matches')) {
    showNotFoundPage();
  } else if (error.message.includes('Loader failed')) {
    showErrorPage(error);
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

**After:**
```typescript
// New pattern - clean navigation with graceful strategy
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ errorStrategy: 'graceful' })
)(
  createViewLayer({
    errorView: showErrorPage,
    notFoundView: showNotFoundPage
  })
)();

// No try-catch needed!
await router.navigate('/users/123');
```

### From Global Error Handlers

**Before:**
```typescript
// Global error boundary catching router errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.source === 'router') {
    handleRouterError(event.reason);
    event.preventDefault();
  }
});
```

**After:**
```typescript
// Use lifecycle hooks for centralized error handling
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ errorStrategy: 'graceful' })
)();

// Register error handler via lifecycle hook
router._registerLifecycleHook('onNavigationError', (error) => {
  handleRouterError(error);
});
```

## Best Practices

### 1. Choose Strategy Based on Layer Purpose

- **UI Layers**: Use `'graceful'` for better UX
- **Test Layers**: Use `'throw'` for assertions
- **Data Layers**: Consider custom strategies with retry logic
- **Development**: Use `'selective'` for debugging

### 2. Always Handle Errors Somewhere

Even with graceful strategy, ensure errors are handled:

```typescript
// Good: Error handling via view layer
createViewLayer({
  errorView: (error) => `<div>Error: ${error.message}</div>`,
  notFoundView: () => '<div>404 Not Found</div>'
})

// Good: Error handling via lifecycle hooks
router._registerLifecycleHook('onNavigationError', (error) => {
  console.error('Navigation error:', error);
  errorReporter.log(error);
});
```

### 3. Use Type-Safe Strategies

Leverage TypeScript for type-safe custom strategies:

```typescript
import { ErrorStrategy, ErrorStrategyConfig } from '@doeixd/combi-router';

const createTypedStrategy = (
  config: ErrorStrategyConfig
): ErrorStrategy => {
  return createErrorStrategy(config);
};

// Type-safe configuration
const strategy = createTypedStrategy('graceful');
```

### 4. Document Strategy Choice

Make strategy choice explicit and documented:

```typescript
const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    // Using graceful strategy because this is a user-facing app
    // where we want to show error UI instead of crashing
    errorStrategy: 'graceful' 
  })
)();
```

### 5. Test Different Strategies

Test your application with different strategies:

```typescript
describe('Error Handling', () => {
  it('should handle errors gracefully in production', () => {
    const router = createRouter({ errorStrategy: 'graceful' });
    const result = await router.navigate('/invalid');
    expect(result).toBe(false); // No throw
  });

  it('should throw errors in development', () => {
    const router = createRouter({ errorStrategy: 'throw' });
    await expect(router.navigate('/invalid')).rejects.toThrow();
  });
});
```

## API Reference

### Types

```typescript
interface ErrorStrategy {
  shouldThrowNotFound(url: string): boolean;
  shouldThrowLoaderError(error: Error): boolean;
  shouldThrowGuardRejection(reason: any): boolean;
  shouldThrowNavigationError(error: Error): boolean;
}

type ErrorStrategyConfig = 
  | 'throw'           // Always throw
  | 'graceful'        // Never throw  
  | 'selective'       // Conditional throwing
  | ErrorStrategy;    // Custom implementation

interface CoreNavigationLayerConfig {
  errorStrategy?: ErrorStrategyConfig;
  selectiveStrategyOptions?: {
    throwNotFound?: boolean;
    throwLoaderError?: boolean;
    throwGuardRejection?: boolean;
    throwNavigationError?: boolean;
  };
}
```

### Factory Functions

```typescript
function createErrorStrategy(
  config: ErrorStrategyConfig,
  selectiveOptions?: SelectiveStrategyOptions
): ErrorStrategy

function createCoreNavigationLayer(
  config?: CoreNavigationLayerConfig
): RouterLayer
```

### Predefined Strategies

```typescript
const ErrorStrategies = {
  throw: new ThrowErrorStrategy(),
  graceful: new GracefulErrorStrategy(),
  selective: (options) => new SelectiveErrorStrategy(options)
};
```

### Classes

```typescript
class ThrowErrorStrategy implements ErrorStrategy
class GracefulErrorStrategy implements ErrorStrategy  
class SelectiveErrorStrategy implements ErrorStrategy
```

## Examples

### Complete Application Example

```typescript
import { 
  createLayeredRouter,
  createCoreNavigationLayer,
  createLoaderLayer,
  createViewLayer,
  route, 
  path, 
  loader,
  view
} from '@doeixd/combi-router';

// Define routes with loaders and views
const userRoute = pipe(
  route(path('users'), param('id')),
  loader(async ({ params }) => {
    const response = await fetch(`/api/users/${params.id}`);
    if (!response.ok) throw new Error('User not found');
    return response.json();
  }),
  view(({ match }) => `
    <div class="user-profile">
      <h1>${match.data.name}</h1>
      <p>${match.data.email}</p>
    </div>
  `)
);

// Create router with graceful error handling
const router = createLayeredRouter([userRoute])(
  createCoreNavigationLayer({ 
    errorStrategy: 'graceful' 
  })
)(
  createLoaderLayer()
)(
  createViewLayer({
    root: '#app',
    loadingView: () => '<div class="spinner">Loading...</div>',
    errorView: (error) => `
      <div class="error-page">
        <h1>Oops!</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `,
    notFoundView: () => `
      <div class="not-found">
        <h1>404</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go Home</a>
      </div>
    `
  })
)();

// Clean navigation without error handling boilerplate
await router.navigate('/users/123'); // Shows user or error view
await router.navigate('/unknown');   // Shows 404 view
```

This completes the comprehensive documentation for the error strategy API, providing users with everything they need to understand and effectively use this powerful feature.
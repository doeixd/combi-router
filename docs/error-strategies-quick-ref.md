# Error Strategies - Quick Reference

## Choose Your Strategy

### For Production Apps with UI
```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'graceful' 
})
```
✅ No try-catch needed  
✅ Errors shown in UI  
✅ Navigation returns `false` on error  

### For Tests
```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'throw' // Default
})
```
✅ Errors throw for assertions  
✅ Backward compatible  
✅ Works with `expect().rejects.toThrow()`  

### For Custom Control
```typescript
createCoreNavigationLayer({ 
  errorStrategy: 'selective',
  selectiveStrategyOptions: {
    throwNotFound: false,     // Show 404 page
    throwLoaderError: true,   // Throw for debugging
    throwGuardRejection: true,
    throwNavigationError: true
  }
})
```

## Complete Example

```typescript
import { 
  createLayeredRouter,
  createCoreNavigationLayer,
  createViewLayer 
} from '@doeixd/combi-router';

const router = createLayeredRouter(routes)(
  createCoreNavigationLayer({ 
    errorStrategy: 'graceful' // 👈 Key setting
  })
)(
  createViewLayer({
    root: '#app',
    errorView: (error) => `<div>Error: ${error.message}</div>`,
    notFoundView: () => '<h1>404 Not Found</h1>'
  })
)();

// Clean navigation - no try-catch! 🎉
await router.navigate('/users/123');
await router.navigate('/nonexistent'); // Shows 404, doesn't throw
```

## Strategy Comparison

| Strategy | 404 | Loader Error | Guard Reject | Use Case |
|----------|-----|--------------|--------------|----------|
| `'throw'` | ❌ Throws | ❌ Throws | ❌ Throws | Testing, CLI |
| `'graceful'` | ✅ Returns false | ✅ Returns false | ✅ Returns false | UI Apps |
| `'selective'` | 🔧 Configurable | 🔧 Configurable | 🔧 Configurable | Mixed |

## Custom Strategy

```typescript
class MyStrategy implements ErrorStrategy {
  shouldThrowNotFound(url: string): boolean {
    return false; // Never throw 404s
  }
  
  shouldThrowLoaderError(error: Error): boolean {
    // Only throw for non-network errors
    return !error.message.includes('fetch');
  }
  
  shouldThrowGuardRejection(reason: any): boolean {
    return true; // Always throw (security)
  }
  
  shouldThrowNavigationError(error: Error): boolean {
    return true;
  }
}

createCoreNavigationLayer({ 
  errorStrategy: new MyStrategy() 
})
```

## Migration

### Before (Verbose)
```typescript
try {
  await router.navigate('/users/123');
} catch (error) {
  if (error.message.includes('No route matches')) {
    show404();
  } else {
    showError(error);
  }
}
```

### After (Clean)
```typescript
// Set strategy once
createCoreNavigationLayer({ errorStrategy: 'graceful' })

// Navigate without try-catch
await router.navigate('/users/123');
```

## Lifecycle Hooks (Always Available)

Regardless of strategy, errors always trigger hooks:

```typescript
router._registerLifecycleHook('onNavigationError', (error) => {
  console.error('Nav error:', error);
  analytics.track('error', error);
});
```

## Common Patterns

### Development vs Production
```typescript
const errorStrategy = process.env.NODE_ENV === 'production' 
  ? 'graceful' 
  : 'throw';
```

### Testing
```typescript
// In tests, use throw strategy
const testRouter = createLayeredRouter(routes)(
  createCoreNavigationLayer({ errorStrategy: 'throw' })
)();

await expect(testRouter.navigate('/bad')).rejects.toThrow();
```

### With View Layer
```typescript
// View layer + graceful = Perfect match
createCoreNavigationLayer({ errorStrategy: 'graceful' })
// ... then ...
createViewLayer({
  errorView: (e) => `<div class="error">${e.message}</div>`,
  notFoundView: () => '<h1>404</h1>'
})
```

## Type Reference

```typescript
type ErrorStrategyConfig = 
  | 'throw'        // Always throw (default)
  | 'graceful'     // Never throw
  | 'selective'    // Configurable
  | ErrorStrategy; // Custom object

interface ErrorStrategy {
  shouldThrowNotFound(url: string): boolean;
  shouldThrowLoaderError(error: Error): boolean;
  shouldThrowGuardRejection(reason: any): boolean;
  shouldThrowNavigationError(error: Error): boolean;
}
```

# Enhanced Resource/Suspense Implementation

This document describes the enhanced Resource/Suspense implementation that makes Combi-Router competitive with modern data fetching libraries like React Query, SWR, and Apollo Client.

## Overview

The enhanced Resource implementation provides advanced features while maintaining backward compatibility with the existing `createResource` function. The new `createAdvancedResource` function offers production-ready capabilities for modern applications.

## Key Features

### 1. **Retry Mechanisms**
- Configurable retry attempts with exponential backoff
- Custom retry conditions based on error types
- Retry callbacks for monitoring and logging
- Automatic network error detection

### 2. **Advanced Caching**
- Cache tags for targeted invalidation
- Priority-based cache eviction
- Stale-while-revalidate strategy
- Background refresh capabilities
- TTL and access-based expiration

### 3. **Loading State Management**
- Individual resource loading states
- Global loading state aggregation
- Non-suspending peek reads
- Background refetch support

### 4. **Observability**
- Resource lifecycle events
- Performance metrics tracking
- Cache hit/miss monitoring
- Error tracking and reporting

## Basic Usage

### Simple Enhanced Resource

```typescript
import { createAdvancedResource } from '@doeixd/combi-router';

// Basic usage with default retry and caching
const userResource = createAdvancedResource(
  () => fetch('/api/user/123').then(r => r.json())
);

// Check loading state
console.log(userResource.isLoading); // true/false

// Non-suspending read (returns undefined if not loaded)
const cachedUser = userResource.peek();

// Suspending read (throws promise if loading, data if ready, error if failed)
const user = userResource.read();
```

### Advanced Configuration

```typescript
const userResource = createAdvancedResource(
  () => fetchUser(userId),
  {
    // Retry configuration
    retry: {
      attempts: 3,
      delay: (attempt) => Math.min(1000 * Math.pow(2, attempt - 1), 10000),
      shouldRetry: (error, attempt) => {
        // Retry on network errors and 5xx status codes
        return error.name === 'TypeError' || 
               (error as any).status >= 500;
      },
      onRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt} for error:`, error);
      }
    },
    
    // Cache configuration
    cache: {
      ttl: 300000, // 5 minutes
      staleWhileRevalidate: true,
      invalidateOn: ['user', 'profile'], // Cache tags
      priority: 'high' // Cache priority
    },
    
    // Stale data management
    staleTime: 60000, // Data is stale after 1 minute
    backgroundRefetch: true // Refetch stale data in background
  },
  'user-123' // Optional explicit cache key
);
```

## Manual Control

### Refetch and Invalidation

```typescript
// Force refetch (bypasses cache)
await userResource.refetch();

// Invalidate (marks as stale, triggers refetch on next read)
userResource.invalidate();

// Check if data is stale
if (userResource.isStale) {
  console.log('Data is stale, consider refreshing');
}
```

### Error Handling

```typescript
// Access last error
if (userResource.error) {
  console.error('Failed to load user:', userResource.error);
}

// Resource state
console.log(userResource.status); // 'pending' | 'success' | 'error'
console.log(userResource.lastFetched); // Date | undefined
```

## Global State Management

### Loading State Aggregation

```typescript
import { resourceState } from '@doeixd/combi-router';

// Get global loading state
const globalState = resourceState.getGlobalState();
console.log(globalState.isLoading); // true if any resource is loading
console.log(globalState.loadingCount); // number of loading resources
console.log(globalState.loadingResources); // array of loading resources

// Show global loading indicator
function GlobalLoadingIndicator() {
  const { isLoading } = resourceState.getGlobalState();
  return isLoading ? <div>Loading...</div> : null;
}
```

### Event Monitoring

```typescript
// Listen to all resource events
const unsubscribe = resourceState.onEvent((event) => {
  console.log('Resource event:', event.type, event.resource, event.data);
  
  switch (event.type) {
    case 'fetch-start':
      console.log('Started fetching');
      break;
    case 'fetch-success':
      console.log('Fetch succeeded:', event.data);
      break;
    case 'fetch-error':
      console.log('Fetch failed:', event.error);
      break;
    case 'retry':
      console.log('Retrying fetch, attempt:', event.attempt);
      break;
    case 'invalidate':
      console.log('Resource invalidated');
      break;
  }
});

// Clean up listener
unsubscribe();
```

## Cache Management

### Tag-Based Invalidation

```typescript
import { resourceState, globalCache } from '@doeixd/combi-router';

// Create resources with cache tags
const userResource = createAdvancedResource(
  () => fetchUser(id),
  { cache: { invalidateOn: ['user'] } }
);

const postsResource = createAdvancedResource(
  () => fetchUserPosts(id),
  { cache: { invalidateOn: ['user', 'posts'] } }
);

// Invalidate all resources with 'user' tag
resourceState.invalidateByTags(['user']);

// Direct cache management
globalCache.set('custom-key', data, { ttl: 60000, invalidateOn: ['custom'] });
globalCache.invalidateByTags(['custom']);
globalCache.clear(); // Clear entire cache
```

### Cache Statistics

```typescript
const stats = globalCache.getStats();
console.log({
  totalEntries: stats.totalEntries,
  expired: stats.expired,
  byPriority: stats.byPriority, // { low: 5, normal: 10, high: 2 }
  tags: stats.tags,
  hitRatio: stats.hitRatio
});
```

## Router Integration

### Enhanced Route Loaders

```typescript
import { route, path, param, loader, createAdvancedResource } from '@doeixd/combi-router';
import * as z from 'zod';

const userRoute = route(
  path('users'),
  param('id', z.number()),
  loader(({ params, signal }) => ({
    // Basic resource
    user: createResource(() => fetchUser(params.id)),
    
    // Enhanced resource with retry and caching
    posts: createAdvancedResource(
      () => fetchUserPosts(params.id, { signal }),
      {
        retry: { attempts: 3 },
        cache: { 
          ttl: 300000,
          invalidateOn: ['user', 'posts'],
          staleWhileRevalidate: true
        },
        staleTime: 60000,
        backgroundRefetch: true
      },
      `user-${params.id}-posts` // Explicit cache key
    )
  }))
);

// In your component/view
const { user, posts } = router.currentMatch.data;

// Check loading states
if (posts.isLoading) {
  return <div>Loading posts...</div>;
}

// Use data (will suspend if not ready)
const userData = user.read();
const postsData = posts.read();
```

## Migration Guide

### From Basic Resources

```typescript
// Before: Basic resource
const resource = createResource(() => fetchData());

// After: Enhanced resource with same behavior
const resource = createAdvancedResource(() => fetchData());

// After: Enhanced resource with advanced features
const resource = createAdvancedResource(
  () => fetchData(),
  {
    retry: { attempts: 3 },
    cache: { ttl: 300000 },
    staleTime: 60000
  }
);
```

### Backward Compatibility

The existing `createResource` function remains unchanged and fully compatible. You can migrate incrementally by replacing `createResource` with `createAdvancedResource` where needed.

## Performance Considerations

### Memory Management

- Cache has configurable size limits with LRU eviction
- Priority-based eviction ensures important data stays cached
- Automatic cleanup of expired entries
- Resource deregistration prevents memory leaks

### Network Optimization

- Request deduplication prevents duplicate fetches
- Background refetch keeps data fresh without blocking UI
- Stale-while-revalidate serves cached data while updating
- Configurable retry with exponential backoff reduces server load

### Best Practices

1. **Use cache tags** for efficient invalidation
2. **Set appropriate stale times** based on data freshness requirements
3. **Configure retry policies** based on API characteristics
4. **Monitor resource events** for debugging and analytics
5. **Use priority caching** for critical data
6. **Implement proper error boundaries** for suspense handling

## Error Handling

### Error Boundaries

```typescript
// Enhanced resources work with React error boundaries
function ErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong</div>}
      onError={(error, errorInfo) => {
        console.error('Resource error:', error);
      }}
    >
      <Suspense fallback={<div>Loading...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Custom Error Handling

```typescript
const resource = createAdvancedResource(
  () => fetchData(),
  {
    retry: {
      shouldRetry: (error) => {
        // Don't retry auth errors
        if (error.status === 401) {
          redirectToLogin();
          return false;
        }
        return error.status >= 500;
      },
      onRetry: (error, attempt) => {
        analytics.track('resource_retry', { error, attempt });
      }
    }
  }
);
```

## TypeScript Support

The enhanced Resource implementation provides full TypeScript support with proper type inference:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Type is automatically inferred as AdvancedResource<User>
const userResource = createAdvancedResource(
  (): Promise<User> => fetchUser(123),
  { cache: { ttl: 300000 } }
);

// TypeScript knows this is User | undefined
const userData = userResource.peek();

// TypeScript knows this is User (or throws)
const user = userResource.read();
```

## Comparison with Other Libraries

| Feature | Basic Resource | Enhanced Resource | React Query | SWR |
|---------|----------------|-------------------|-------------|-----|
| Suspense | ✅ | ✅ | ❌ | ❌ |
| Retry | ❌ | ✅ | ✅ | ✅ |
| Cache Tags | ❌ | ✅ | ✅ | ❌ |
| Background Refetch | ❌ | ✅ | ✅ | ✅ |
| Stale While Revalidate | ❌ | ✅ | ✅ | ✅ |
| Global Loading State | ❌ | ✅ | ❌ | ❌ |
| Framework Agnostic | ✅ | ✅ | ❌ | ❌ |
| Bundle Size | Small | Medium | Large | Medium |

This enhanced implementation positions Combi-Router as a competitive alternative to dedicated data fetching libraries while maintaining its router-first approach and framework-agnostic design.

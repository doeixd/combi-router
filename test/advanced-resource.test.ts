/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createAdvancedResource, 
  resourceState, 
  AdvancedCache,
  type AdvancedResource,
  type ResourceEvent 
} from '../src';

// Helper to flush promises
const flushPromises = () => new Promise(setImmediate);

// Helper to wait for specific time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('AdvancedResource', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let events: ResourceEvent[] = [];
  let unsubscribe: (() => void) | null = null;

  beforeEach(() => {
    mockFetch = vi.fn();
    events = [];
    unsubscribe = resourceState.onEvent((event) => events.push(event));
  });

  afterEach(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should start in pending state and transition to success', async () => {
      const data = { message: 'Success!' };
      mockFetch.mockResolvedValue(data);
      
      const resource = createAdvancedResource(mockFetch);
      
      expect(resource.status).toBe('pending');
      expect(resource.isLoading).toBe(true);
      
      await flushPromises();
      
      expect(resource.status).toBe('success');
      expect(resource.isLoading).toBe(false);
      expect(resource.read()).toBe(data);
    });

    it('should handle errors and transition to error state', async () => {
      const error = new Error('Fetch failed');
      mockFetch.mockRejectedValue(error);
      
      const resource = createAdvancedResource(mockFetch);
      
      await flushPromises();
      
      expect(resource.status).toBe('error');
      expect(resource.isLoading).toBe(false);
      expect(resource.error).toBe(error);
      expect(() => resource.read()).toThrow(error);
    });

    it('should support non-suspending peek reads', async () => {
      const data = { message: 'Success!' };
      mockFetch.mockResolvedValue(data);
      
      const resource = createAdvancedResource(mockFetch);
      
      // Should return undefined when pending
      expect(resource.peek()).toBeUndefined();
      
      await flushPromises();
      
      // Should return data when loaded
      expect(resource.peek()).toBe(data);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          const error = new Error('fetch failed');
          error.name = 'TypeError'; // Network error
          return Promise.reject(error);
        }
        return Promise.resolve({ success: true });
      });

      const resource = createAdvancedResource(mockFetch, {
        retry: {
          attempts: 3,
          delay: 10 // Short delay for tests
        }
      });

      await flushPromises();
      await wait(100); // Wait for retries

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(resource.status).toBe('success');
      expect(resource.read()).toEqual({ success: true });
    });

    it('should respect custom retry conditions', async () => {
      const networkError = new Error('Network error');
      const authError = new Error('Unauthorized');
      authError.name = 'AuthError';

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.reject(callCount === 1 ? networkError : authError);
      });

      const resource = createAdvancedResource(mockFetch, {
        retry: {
          attempts: 3,
          delay: 10,
          shouldRetry: (error) => error.message.includes('Network')
        }
      });

      await flushPromises();
      await wait(50);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(resource.status).toBe('error');
      expect(resource.error).toBe(authError);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const error = new Error('fetch timeout');
      error.name = 'TypeError';
      
      mockFetch
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });

      const resource = createAdvancedResource(mockFetch, {
        retry: {
          attempts: 3,
          delay: 10,
          onRetry
        }
      });

      await flushPromises();
      await wait(100);

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(error, 1);
      expect(onRetry).toHaveBeenCalledWith(error, 2);
    });
  });

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      const data = { cached: true };
      mockFetch.mockResolvedValue(data);

      const cacheKey = 'test-cache-key';
      const resource1 = createAdvancedResource(mockFetch, {
        cache: { ttl: 60000 }
      }, cacheKey);

      await flushPromises();

      // Create second resource with same cache key
      const resource2 = createAdvancedResource(vi.fn(), {
        cache: { ttl: 60000 }
      }, cacheKey);

      await flushPromises();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(resource1.read()).toBe(data);
      expect(resource2.read()).toBe(data);
    });

    it('should respect cache TTL', async () => {
      const data = { expired: true };
      mockFetch.mockResolvedValue(data);

      const cache = new AdvancedCache();
      const cacheKey = 'expiring-key';
      
      // Set with very short TTL
      cache.set(cacheKey, data, { ttl: 1 });
      
      // Should be available immediately
      expect(cache.has(cacheKey)).toBe(true);
      
      // Wait for expiration
      await wait(5);
      
      // Should be expired
      expect(cache.has(cacheKey)).toBe(false);
    });

    it('should support cache tag invalidation', async () => {
      const cache = new AdvancedCache();
      
      cache.set('user-1', { id: 1 }, { invalidateOn: ['user'] });
      cache.set('user-2', { id: 2 }, { invalidateOn: ['user'] });
      cache.set('post-1', { id: 1 }, { invalidateOn: ['post'] });
      
      expect(cache.has('user-1')).toBe(true);
      expect(cache.has('user-2')).toBe(true);
      expect(cache.has('post-1')).toBe(true);
      
      // Invalidate user tags
      const invalidated = cache.invalidateByTags(['user']);
      
      expect(invalidated).toBe(2);
      expect(cache.has('user-1')).toBe(false);
      expect(cache.has('user-2')).toBe(false);
      expect(cache.has('post-1')).toBe(true);
    });
  });

  describe('Stale Data Management', () => {
    it('should detect stale data', async () => {
      const data = { stale: false };
      mockFetch.mockResolvedValue(data);

      const resource = createAdvancedResource(mockFetch, {
        staleTime: 50 // 50ms stale time
      });

      await flushPromises();

      expect(resource.isStale).toBe(false);
      
      // Wait for data to become stale
      await wait(60);
      
      expect(resource.isStale).toBe(true);
    });

    it('should support background refetch for stale data', async () => {
      const initialData = { version: 1 };
      const updatedData = { version: 2 };
      
      mockFetch
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      const resource = createAdvancedResource(mockFetch, {
        staleTime: 50,
        backgroundRefetch: true
      });

      await flushPromises();
      expect(resource.read()).toEqual(initialData);

      // Wait for data to become stale
      await wait(60);
      
      // Trigger background refetch by reading
      const result = resource.read();
      expect(result).toEqual(initialData); // Still returns stale data immediately
      
      // Wait for background refetch to complete
      await flushPromises();
      await wait(10);
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(resource.read()).toEqual(updatedData);
    });
  });

  describe('Manual Control', () => {
    it('should support manual refetch', async () => {
      const initialData = { version: 1 };
      const updatedData = { version: 2 };
      
      mockFetch
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      const resource = createAdvancedResource(mockFetch);

      await flushPromises();
      expect(resource.read()).toEqual(initialData);

      // Manual refetch
      const refetchPromise = resource.refetch();
      expect(resource.isLoading).toBe(true);
      
      const result = await refetchPromise;
      
      expect(result).toEqual(updatedData);
      expect(resource.read()).toEqual(updatedData);
      expect(resource.isLoading).toBe(false);
    });

    it('should support manual invalidation', async () => {
      const data = { invalidated: false };
      mockFetch.mockResolvedValue(data);

      const resource = createAdvancedResource(mockFetch);

      await flushPromises();
      expect(resource.status).toBe('success');

      resource.invalidate();

      expect(resource.status).toBe('pending');
      expect(resource.peek()).toBeUndefined();
    });
  });

  describe('Global State Management', () => {
    it('should track global loading state', async () => {
      const delay = () => new Promise(resolve => setTimeout(resolve, 50));
      
      mockFetch.mockImplementation(delay);

      const resource1 = createAdvancedResource(mockFetch);
      const resource2 = createAdvancedResource(mockFetch);

      const globalState = resourceState.getGlobalState();
      
      expect(globalState.isLoading).toBe(true);
      expect(globalState.loadingCount).toBe(2);
      expect(globalState.loadingResources).toContain(resource1);
      expect(globalState.loadingResources).toContain(resource2);

      await flushPromises();
      await wait(60);

      const finalState = resourceState.getGlobalState();
      expect(finalState.isLoading).toBe(false);
      expect(finalState.loadingCount).toBe(0);
    });

    it('should emit resource events', async () => {
      const data = { event: true };
      mockFetch.mockResolvedValue(data);

      const resource = createAdvancedResource(mockFetch);
      
      await flushPromises();

      expect(events.length).toBeGreaterThan(0);
      
      const fetchStartEvent = events.find(e => e.type === 'fetch-start');
      const fetchSuccessEvent = events.find(e => e.type === 'fetch-success');
      
      expect(fetchStartEvent).toBeDefined();
      expect(fetchStartEvent?.resource).toBe(resource);
      
      expect(fetchSuccessEvent).toBeDefined();
      expect(fetchSuccessEvent?.data).toBe(data);
    });

    it('should support global tag invalidation', async () => {
      const userData = { user: true };
      const postData = { post: true };
      
      mockFetch
        .mockResolvedValueOnce(userData)
        .mockResolvedValueOnce(postData);

      const userResource = createAdvancedResource(mockFetch, {
        cache: { invalidateOn: ['user'] }
      }, 'user-data');

      const postResource = createAdvancedResource(mockFetch, {
        cache: { invalidateOn: ['post'] }
      }, 'post-data');

      await flushPromises();

      expect(userResource.status).toBe('success');
      expect(postResource.status).toBe('success');

      // Invalidate user resources globally
      const invalidated = resourceState.invalidateByTags(['user']);
      
      expect(invalidated).toBeGreaterThan(0);
      expect(userResource.status).toBe('pending');
      expect(postResource.status).toBe('success'); // Should not be affected
    });
  });

  describe('Error Boundary Integration', () => {
    it('should throw suspense promise during pending state', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const resource = createAdvancedResource(mockFetch);
      
      let thrownPromise: any;
      try {
        resource.read();
      } catch (e) {
        thrownPromise = e;
      }
      
      expect(thrownPromise).toBeInstanceOf(Promise);
    });

    it('should throw error during error state', async () => {
      const error = new Error('Test error');
      mockFetch.mockRejectedValue(error);
      
      const resource = createAdvancedResource(mockFetch);
      
      await flushPromises();
      
      expect(() => resource.read()).toThrow(error);
    });
  });

  describe('Performance and Memory', () => {
    it('should not call promiseFn multiple times for same resource', async () => {
      const data = { single: true };
      mockFetch.mockResolvedValue(data);

      const resource = createAdvancedResource(mockFetch);

      // Multiple status checks and reads
      expect(resource.status).toBe('pending');
      try { resource.read(); } catch (e) {}
      expect(resource.status).toBe('pending');
      try { resource.read(); } catch (e) {}

      await flushPromises();

      expect(resource.status).toBe('success');
      resource.read();
      resource.read();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle cache eviction based on priority', () => {
      const cache = new AdvancedCache({ maxSize: 2 });
      
      cache.set('low-priority', 'data1', { priority: 'low' });
      cache.set('high-priority', 'data2', { priority: 'high' });
      
      expect(cache.has('low-priority')).toBe(true);
      expect(cache.has('high-priority')).toBe(true);
      
      // Adding third item should evict low priority
      cache.set('normal-priority', 'data3', { priority: 'normal' });
      
      expect(cache.has('low-priority')).toBe(false);
      expect(cache.has('high-priority')).toBe(true);
      expect(cache.has('normal-priority')).toBe(true);
    });
  });
});

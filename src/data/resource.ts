// =================================================================
//
//      Combi-Router: Resource/Suspense Implementation
//
//      This module contains the Resource implementation for suspense-like
//      features and asynchronous data handling.
//
// =================================================================

import type {
  Resource,
  ResourceStatus,
  AdvancedResource,
  ResourceConfig,
  ResourceEvent,
  RetryConfig,
  GlobalResourceState,
} from "../core/types";
import { globalCache } from "./cache";

// =================================================================
// ----------------- SUSPENSE & RESOURCE IMPLEMENTATION -----------
// =================================================================

/** A special promise subclass thrown during suspense to signal loading. @internal */
export class SuspensePromise extends Promise<void> {}

/**
 * Creates a Resource object from a promise-returning function.
 * This is the primary utility for enabling suspense-based data fetching.
 *
 * @param promiseFn A function that returns the promise to be wrapped.
 * @returns A `Resource` object.
 *
 * @example
 * // In a route loader:
 * const userRoute = route(
 *   path('users'),
 *   param('id', z.number()),
 *   loader(({ params }) => ({
 *     user: createResource(() => api.fetchUser(params.id))
 *   }))
 * );
 *
 * // In a component/view:
 * const { user } = router.currentMatch.data;
 * // This will either return the user data or suspend rendering.
 * const userData = user.read();
 */
export function createResource<T>(promiseFn: () => Promise<T>): Resource<T> {
  let status: ResourceStatus = "pending";
  let result: T | any;
  let suspender = promiseFn().then(
    (r) => {
      status = "success";
      result = r;
    },
    (e) => {
      status = "error";
      result = e;
    },
  );

  return {
    get status() {
      return status;
    },
    read(): T {
      switch (status) {
        case "pending":
          throw new SuspensePromise((resolve) =>
            suspender.then(resolve, resolve),
          );
        case "error":
          throw result;
        case "success":
          return result as T;
      }
    },
  };
}

// =================================================================
// --------------- ENHANCED RESOURCE IMPLEMENTATION ---------------
// =================================================================

/**
 * Global state manager for tracking all enhanced resources.
 */
class ResourceManager {
  private resources = new Set<AdvancedResourceImpl<any>>();
  private listeners = new Set<(event: ResourceEvent) => void>();

  register<T>(resource: AdvancedResourceImpl<T>): void {
    this.resources.add(resource);
  }

  unregister<T>(resource: AdvancedResourceImpl<T>): void {
    this.resources.delete(resource);
  }

  emit<T>(event: ResourceEvent<T>): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[ResourceManager] Event listener error:", error);
      }
    }
  }

  onEvent(listener: (event: ResourceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getGlobalState(): GlobalResourceState {
    const loadingResources = Array.from(this.resources).filter(
      (r) => r.isLoading,
    );
    return {
      loadingCount: loadingResources.length,
      isLoading: loadingResources.length > 0,
      loadingResources,
    };
  }

  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    for (const resource of this.resources) {
      if (
        resource.config.cache?.invalidateOn?.some((tag) => tags.includes(tag))
      ) {
        resource.invalidate();
        invalidated++;
      }
    }
    return invalidated + globalCache.invalidateByTags(tags);
  }
}

const resourceManager = new ResourceManager();

/**
 * Default retry configuration with exponential backoff.
 */
const defaultRetryConfig: Required<RetryConfig> = {
  attempts: 3,
  delay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt - 1), 10000),
  shouldRetry: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx status codes
    return (
      error.name === "TypeError" || // Network errors
      error.message.includes("fetch") ||
      error.message.includes("timeout") ||
      (error as any)?.status >= 500
    );
  },
  onRetry: () => {},
};

/**
 * Implementation of AdvancedResource with all enhanced features.
 */
class AdvancedResourceImpl<T> implements AdvancedResource<T> {
  private _status: ResourceStatus = "pending";
  private _data: T | undefined;
  private _error: Error | undefined;
  private _lastFetched: Date | undefined;
  private _isLoading = false;
  private _abortController: AbortController | null = null;
  private _suspender: Promise<void> | null = null;
  private _cacheKey: string;

  constructor(
    private promiseFn: () => Promise<T>,
    public readonly config: ResourceConfig,
    cacheKey?: string,
  ) {
    this._cacheKey = cacheKey || this.generateCacheKey();
    resourceManager.register(this);
    this.initializeFetch();
  }

  // Basic Resource interface
  get status(): ResourceStatus {
    return this._status;
  }

  read(): T {
    switch (this._status) {
      case "pending":
        if (!this._suspender) {
          this._suspender = this.createSuspender();
        }
        throw new SuspensePromise((resolve) =>
          this._suspender!.then(resolve, resolve),
        );
      case "error":
        throw this._error;
      case "success":
        // Check if data is stale and background refetch is enabled
        if (this.isStale && this.config.backgroundRefetch && !this._isLoading) {
          this.backgroundRefetch();
        }
        return this._data as T;
    }
  }

  // Enhanced Resource interface
  get isLoading(): boolean {
    return this._isLoading;
  }
  get isStale(): boolean {
    if (!this._lastFetched || !this.config.staleTime) return false;
    return Date.now() - this._lastFetched.getTime() > this.config.staleTime;
  }
  get lastFetched(): Date | undefined {
    return this._lastFetched;
  }
  get error(): Error | undefined {
    return this._error;
  }

  async refetch(): Promise<T> {
    this.invalidate();
    return this.fetch();
  }

  invalidate(): void {
    this._status = "pending";
    this._data = undefined;
    this._error = undefined;
    this._suspender = null;
    this._fetchPromise = null;

    // Abort current fetch if in progress
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    globalCache.delete(this._cacheKey);

    this.emit({
      type: "invalidate",
      resource: this,
      timestamp: new Date(),
    });
  }

  peek(): T | undefined {
    if (this._status === "success") {
      return this._data;
    }

    // Try cache
    const cached = globalCache.get<T>(this._cacheKey);
    return cached?.data;
  }

  private async initializeFetch(): Promise<void> {
    // Check cache first
    const cached = globalCache.get<T>(this._cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      this._status = "success";
      this._data = cached.data;
      this._lastFetched = cached.timestamp;
      return;
    }

    // Start fetch - don't await to avoid blocking constructor
    this.fetch().catch(() => {
      // Error handled in fetch method
    });
  }

  private _fetchPromise: Promise<T> | null = null;

  private async fetch(): Promise<T> {
    if (this._fetchPromise) {
      return this._fetchPromise;
    }

    this._isLoading = true;
    this._abortController = new AbortController();

    this.emit({
      type: "fetch-start",
      resource: this,
      timestamp: new Date(),
    });

    this._fetchPromise = this.fetchWithRetry()
      .then((data) => {
        this._status = "success";
        this._data = data;
        this._error = undefined;
        this._lastFetched = new Date();
        this._isLoading = false;

        // Update cache
        if (this.config.cache) {
          globalCache.set(this._cacheKey, data, this.config.cache);
        }

        this.emit({
          type: "fetch-success",
          resource: this,
          data,
          timestamp: new Date(),
        });

        this._fetchPromise = null;
        return data;
      })
      .catch((error) => {
        this._status = "error";
        this._error = error as Error;
        this._isLoading = false;

        this.emit({
          type: "fetch-error",
          resource: this,
          error: error as Error,
          timestamp: new Date(),
        });

        this._fetchPromise = null;
        this._abortController = null;
        throw error;
      });

    try {
      return await this._fetchPromise;
    } finally {
      this._abortController = null;
    }
  }

  private async fetchWithRetry(): Promise<T> {
    const retryConfig = { ...defaultRetryConfig, ...this.config.retry };
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        if (this._abortController?.signal.aborted) {
          throw new Error("Fetch aborted");
        }

        return await this.promiseFn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry if aborted or on last attempt
        if (
          this._abortController?.signal.aborted ||
          attempt === retryConfig.attempts
        ) {
          throw lastError;
        }

        // Check if should retry
        if (!retryConfig.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        // Emit retry event
        this.emit({
          type: "retry",
          resource: this,
          error: lastError,
          attempt,
          timestamp: new Date(),
        });

        // Call retry callback
        retryConfig.onRetry(lastError, attempt);

        // Wait before retrying
        const delay =
          typeof retryConfig.delay === "function"
            ? retryConfig.delay(attempt)
            : retryConfig.delay;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private async backgroundRefetch(): Promise<void> {
    try {
      await this.fetch();
    } catch (error) {
      // Background refetch failures should not affect current state
      console.warn("[AdvancedResource] Background refetch failed:", error);
    }
  }

  private createSuspender(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkStatus = () => {
        if (this._status === "success" || this._status === "error") {
          resolve();
        } else {
          setTimeout(checkStatus, 16); // Check every frame
        }
      };
      checkStatus();
    });
  }

  private generateCacheKey(): string {
    return `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCacheExpired(cached: { expires: number }): boolean {
    return cached.expires <= Date.now();
  }

  private emit(event: ResourceEvent<T>): void {
    resourceManager.emit(event);
  }
}

/**
 * Creates an enhanced Resource with advanced features like retry, caching, and state management.
 * This is the modern alternative to createResource with production-ready capabilities.
 *
 * @param promiseFn A function that returns the promise to be wrapped.
 * @param config Configuration for retry, caching, and other behaviors.
 * @param cacheKey Optional cache key for manual cache management.
 * @returns An `AdvancedResource` object.
 *
 * @example
 * // Basic usage with retry and caching
 * const userResource = createAdvancedResource(
 *   () => api.fetchUser(userId),
 *   {
 *     retry: { attempts: 3 },
 *     cache: { ttl: 300000, invalidateOn: ['user'] },
 *     staleTime: 60000,
 *     backgroundRefetch: true
 *   }
 * );
 *
 * // Check loading state
 * if (userResource.isLoading) {
 *   console.log('Loading user...');
 * }
 *
 * // Non-suspending read
 * const cachedUser = userResource.peek();
 * if (cachedUser) {
 *   console.log('Cached user:', cachedUser);
 * }
 *
 * // Force refetch
 * await userResource.refetch();
 */
export function createAdvancedResource<T>(
  promiseFn: () => Promise<T>,
  config: ResourceConfig = {},
  cacheKey?: string,
): AdvancedResource<T> {
  return new AdvancedResourceImpl(promiseFn, config, cacheKey);
}

/**
 * Global resource state and event management.
 */
export const resourceState = {
  /**
   * Get current global loading state.
   */
  getGlobalState: () => resourceManager.getGlobalState(),

  /**
   * Listen to resource events for observability.
   */
  onEvent: (listener: (event: ResourceEvent) => void) =>
    resourceManager.onEvent(listener),

  /**
   * Invalidate all resources with specific cache tags.
   */
  invalidateByTags: (tags: string[]) => resourceManager.invalidateByTags(tags),

  /**
   * Get the resource manager instance (for advanced usage).
   */
  getManager: () => resourceManager,
};

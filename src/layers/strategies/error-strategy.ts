// =================================================================
//
//      Combi-Router: Error Handling Strategies
//
//      Defines how different types of navigation errors should be handled
//
// =================================================================

/**
 * Strategy interface for handling navigation errors.
 * Determines whether errors should cause promise rejection or be handled gracefully.
 *
 * @example Using a predefined strategy
 * ```typescript
 * const router = createLayeredRouter(routes)(
 *   createCoreNavigationLayer({
 *     errorStrategy: 'graceful'
 *   })
 * )();
 * ```
 *
 * @example Implementing a custom strategy
 * ```typescript
 * class MyStrategy implements ErrorStrategy {
 *   shouldThrowNotFound(url: string): boolean {
 *     return process.env.NODE_ENV === 'test';
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface ErrorStrategy {
  /**
   * Determines if a "route not found" error should cause navigation to throw.
   * @param url The URL that didn't match any routes
   * @returns true to throw the error, false to handle gracefully
   */
  shouldThrowNotFound(url: string): boolean;

  /**
   * Determines if a loader error should cause navigation to throw.
   * @param error The error thrown by the loader
   * @returns true to throw the error, false to handle gracefully
   */
  shouldThrowLoaderError(error: Error): boolean;

  /**
   * Determines if a guard rejection should cause navigation to throw.
   * @param reason The reason for guard rejection
   * @returns true to throw the error, false to handle gracefully
   */
  shouldThrowGuardRejection(reason: any): boolean;

  /**
   * Determines if a generic navigation error should cause navigation to throw.
   * @param error The navigation error
   * @returns true to throw the error, false to handle gracefully
   */
  shouldThrowNavigationError(error: Error): boolean;
}

/**
 * Throw strategy: All errors cause promise rejection (legacy behavior).
 * Use this for backward compatibility or when you want errors to bubble up.
 *
 * @remarks
 * This is the default strategy to maintain backward compatibility with existing code.
 * All navigation errors will cause the navigation promise to reject.
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)(
 *   createCoreNavigationLayer({
 *     errorStrategy: 'throw'
 *   })
 * )();
 *
 * try {
 *   await router.navigate('/nonexistent');
 * } catch (error) {
 *   console.error('Navigation failed:', error);
 * }
 * ```
 */
export class ThrowErrorStrategy implements ErrorStrategy {
  shouldThrowNotFound(_url: string): boolean {
    return true;
  }

  shouldThrowLoaderError(_error: Error): boolean {
    return true;
  }

  shouldThrowGuardRejection(_reason: any): boolean {
    return true;
  }

  shouldThrowNavigationError(_error: Error): boolean {
    return true;
  }
}

/**
 * Graceful strategy: Errors are communicated through lifecycle hooks only.
 * Navigation promises resolve with false instead of rejecting.
 * Use this when you have UI error handling (e.g., view layer).
 *
 * @remarks
 * Perfect for production applications with view layers that handle errors in the UI.
 * Errors are still reported via lifecycle hooks, but navigation returns `false` instead of throwing.
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)(
 *   createCoreNavigationLayer({
 *     errorStrategy: 'graceful'
 *   })
 * )(
 *   createViewLayer({
 *     errorView: (error) => `<div class="error">${error.message}</div>`,
 *     notFoundView: () => '<h1>404</h1>'
 *   })
 * )();
 *
 * // No try-catch needed!
 * const success = await router.navigate('/users/123');
 * if (!success) {
 *   console.log('Navigation failed, but error was handled gracefully');
 * }
 * ```
 */
export class GracefulErrorStrategy implements ErrorStrategy {
  shouldThrowNotFound(_url: string): boolean {
    return false;
  }

  shouldThrowLoaderError(_error: Error): boolean {
    return false;
  }

  shouldThrowGuardRejection(_reason: any): boolean {
    return false;
  }

  shouldThrowNavigationError(_error: Error): boolean {
    return false;
  }
}

/**
 * Selective strategy: Only throws for specific error types.
 * Allows fine-grained control over error handling.
 *
 * @remarks
 * Use this when you need different behavior for different error types.
 * For example, you might want to handle 404s gracefully but throw for loader errors during development.
 *
 * @example
 * ```typescript
 * const router = createLayeredRouter(routes)(
 *   createCoreNavigationLayer({
 *     errorStrategy: 'selective',
 *     selectiveStrategyOptions: {
 *       throwNotFound: false,      // Show 404 page
 *       throwLoaderError: true,    // Throw for debugging
 *       throwGuardRejection: true, // Throw for security
 *       throwNavigationError: true // Throw for unexpected errors
 *     }
 *   })
 * )();
 * ```
 */
export class SelectiveErrorStrategy implements ErrorStrategy {
  constructor(
    private options: {
      throwNotFound?: boolean;
      throwLoaderError?: boolean;
      throwGuardRejection?: boolean;
      throwNavigationError?: boolean;
    } = {},
  ) {}

  shouldThrowNotFound(_url: string): boolean {
    return this.options.throwNotFound ?? false;
  }

  shouldThrowLoaderError(_error: Error): boolean {
    return this.options.throwLoaderError ?? true;
  }

  shouldThrowGuardRejection(_reason: any): boolean {
    return this.options.throwGuardRejection ?? true;
  }

  shouldThrowNavigationError(_error: Error): boolean {
    return this.options.throwNavigationError ?? true;
  }
}

/**
 * Type for error strategy configuration.
 * Can be a string preset or a custom strategy object.
 *
 * @remarks
 * - `'throw'` - All errors cause promise rejection (default, backward compatible)
 * - `'graceful'` - Errors handled through lifecycle hooks only, navigation returns false
 * - `'selective'` - Fine-grained control via selectiveStrategyOptions
 * - Custom `ErrorStrategy` object - Full control over error handling behavior
 */
export type ErrorStrategyConfig =
  | "throw"
  | "graceful"
  | "selective"
  | ErrorStrategy;

/**
 * Creates an error strategy from configuration.
 *
 * @param config - Strategy configuration (preset name or custom strategy)
 * @param selectiveOptions - Options for selective strategy (only used when config is 'selective')
 * @returns The error strategy instance
 *
 * @example Using a preset strategy
 * ```typescript
 * const strategy = createErrorStrategy('graceful');
 * ```
 *
 * @example Using selective strategy with options
 * ```typescript
 * const strategy = createErrorStrategy('selective', {
 *   throwNotFound: false,
 *   throwLoaderError: true
 * });
 * ```
 *
 * @example Using a custom strategy
 * ```typescript
 * const strategy = createErrorStrategy(new MyCustomStrategy());
 * ```
 */
export function createErrorStrategy(
  config: ErrorStrategyConfig = "throw",
  selectiveOptions?: Parameters<typeof SelectiveErrorStrategy>[0],
): ErrorStrategy {
  if (typeof config === "string") {
    switch (config) {
      case "throw":
        return new ThrowErrorStrategy();
      case "graceful":
        return new GracefulErrorStrategy();
      case "selective":
        return new SelectiveErrorStrategy(selectiveOptions);
      default:
        throw new Error(`Unknown error strategy: ${config}`);
    }
  }
  return config;
}

/**
 * Default error strategies for common use cases.
 *
 * @example
 * ```typescript
 * // Use predefined strategy
 * const router = createLayeredRouter(routes)(
 *   createCoreNavigationLayer({
 *     errorStrategy: ErrorStrategies.graceful
 *   })
 * )();
 *
 * // Create selective strategy with options
 * const selectiveStrategy = ErrorStrategies.selective({
 *   throwNotFound: false,
 *   throwLoaderError: true
 * });
 * ```
 */
export const ErrorStrategies = {
  /**
   * Always throw errors (backward compatible behavior).
   * Use for testing and CLI applications.
   */
  throw: new ThrowErrorStrategy(),

  /**
   * Never throw application errors (for UI error handling).
   * Use for production web applications with view layers.
   */
  graceful: new GracefulErrorStrategy(),

  /**
   * Create a selective strategy with custom options.
   * Use when you need fine-grained control over different error types.
   */
  selective: (options?: Parameters<typeof SelectiveErrorStrategy>[0]) =>
    new SelectiveErrorStrategy(options),
} as const;

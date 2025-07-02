// =================================================================
//
//      Combi-Router: Advanced Transitions Feature
//
//      Sophisticated page transitions beyond basic View Transitions API
//
// =================================================================

import type { RouteMatch } from '../core/types';

export type TransitionType = 'view-transitions' | 'custom' | 'fade' | 'slide' | 'none';
export type TransitionDirection = 'forward' | 'back' | 'replace';

export interface TransitionContext {
  from: RouteMatch | null;
  to: RouteMatch;
  direction: TransitionDirection;
  isInitial: boolean;
  element?: Element;
}

export interface TransitionFunction {
  (context: TransitionContext): Promise<void> | void;
}

export interface TransitionConfig {
  enabled: boolean;
  type: TransitionType;
  duration?: number;
  easing?: string;
  customTransition?: TransitionFunction | undefined;
  skipSameRoute?: boolean;
  fallbackTransition?: TransitionType;
  debugMode?: boolean;
  respectPreferences?: boolean;
}

export interface TransitionAnimation {
  name: string;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

export class TransitionManager {
  private config: Required<TransitionConfig>;
  private isTransitioning = false;
  private currentAnimation?: Animation;
  private transitionQueue: (() => Promise<void>)[] = [];
  private hasViewTransitions: boolean;
  private reducedMotionQuery?: MediaQueryList;

  constructor(config: TransitionConfig) {
    this.config = {
      ...defaultTransitionConfig,
      ...config
    };

    this.hasViewTransitions = typeof document !== 'undefined' && 
      'startViewTransition' in document;

    if (typeof window !== 'undefined') {
      this.initializeMotionPreferences();
    }
  }

  private initializeMotionPreferences(): void {
    if (!this.config.respectPreferences) return;

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotionQuery.addEventListener('change', this.handleMotionPreferenceChange.bind(this));
  }

  private handleMotionPreferenceChange(): void {
    if (this.reducedMotionQuery?.matches) {
      // User prefers reduced motion, use minimal transitions
      this.log('Reduced motion preference detected, using minimal transitions');
    }
  }

  private shouldUseTransitions(): boolean {
    if (!this.config.enabled) return false;
    
    // Respect user's motion preferences
    if (this.config.respectPreferences && this.reducedMotionQuery?.matches) {
      return false;
    }

    return true;
  }

  private log(message: string, ...args: any[]): void {
    if (this.config.debugMode) {
      console.log(`[TransitionManager] ${message}`, ...args);
    }
  }

  public async executeTransition(context: TransitionContext): Promise<void> {
    if (!this.shouldUseTransitions()) {
      this.log('Transitions disabled, performing instant navigation');
      return;
    }

    // Skip transition if navigating to the same route
    if (this.config.skipSameRoute && context.from?.route.id === context.to.route.id) {
      this.log('Skipping transition for same route');
      return;
    }

    // Queue transitions to prevent conflicts
    return new Promise((resolve, reject) => {
      this.transitionQueue.push(async () => {
        try {
          await this.performTransition(context);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.processTransitionQueue();
    });
  }

  private async processTransitionQueue(): Promise<void> {
    if (this.isTransitioning || this.transitionQueue.length === 0) {
      return;
    }

    this.isTransitioning = true;
    
    try {
      const transition = this.transitionQueue.shift();
      if (transition) {
        await transition();
      }
    } finally {
      this.isTransitioning = false;
      
      // Process next transition in queue
      if (this.transitionQueue.length > 0) {
        requestAnimationFrame(() => this.processTransitionQueue());
      }
    }
  }

  private async performTransition(context: TransitionContext): Promise<void> {
    this.log('Executing transition', { 
      type: this.config.type, 
      direction: context.direction,
      from: context.from?.route.id,
      to: context.to.route.id
    });

    try {
      switch (this.config.type) {
        case 'view-transitions':
          await this.executeViewTransition(context);
          break;
        case 'custom':
          await this.executeCustomTransition(context);
          break;
        case 'fade':
          await this.executeFadeTransition(context);
          break;
        case 'slide':
          await this.executeSlideTransition(context);
          break;
        case 'none':
          // No transition
          break;
        default:
          this.log('Unknown transition type, falling back to fade');
          await this.executeFadeTransition(context);
      }
    } catch (error) {
      this.log('Transition failed, falling back', error);
      await this.executeFallbackTransition(context);
    }
  }

  private async executeViewTransition(context: TransitionContext): Promise<void> {
    if (!this.hasViewTransitions) {
      this.log('View Transitions API not supported, using fallback');
      return this.executeFallbackTransition(context);
    }

    return new Promise((resolve, reject) => {
      const updateDOM = () => {
        // DOM update would be handled by the router
        // This is just the transition wrapper
      };

      try {
        const transition = (document as any).startViewTransition(updateDOM);
        
        transition.ready.then(() => {
          this.log('View transition ready');
        });

        transition.finished.then(() => {
          this.log('View transition completed');
          resolve();
        }).catch((error: Error) => {
          this.log('View transition failed', error);
          reject(error);
        });

      } catch (error) {
        this.log('Failed to start view transition', error);
        reject(error);
      }
    });
  }

  private async executeCustomTransition(context: TransitionContext): Promise<void> {
    if (!this.config.customTransition) {
      throw new Error('Custom transition function not provided');
    }

    const result = this.config.customTransition(context);
    if (result instanceof Promise) {
      await result;
    }
  }

  private async executeFadeTransition(context: TransitionContext): Promise<void> {
    const container = this.getTransitionContainer(context);
    if (!container) return;

    const animation = this.createFadeAnimation();
    return this.runAnimation(container, animation);
  }

  private async executeSlideTransition(context: TransitionContext): Promise<void> {
    const container = this.getTransitionContainer(context);
    if (!container) return;

    const animation = this.createSlideAnimation(context.direction);
    return this.runAnimation(container, animation);
  }

  private async executeFallbackTransition(context: TransitionContext): Promise<void> {
    switch (this.config.fallbackTransition) {
      case 'fade':
        return this.executeFadeTransition(context);
      case 'slide':
        return this.executeSlideTransition(context);
      default:
        // No fallback transition
        return;
    }
  }

  private getTransitionContainer(context: TransitionContext): Element | null {
    // Try to use provided element
    if (context.element) return context.element;

    // Look for common container selectors
    const selectors = ['main', '[data-router-view]', '#app', '.app'];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    // Fall back to document body
    return document.body;
  }

  private createFadeAnimation(): TransitionAnimation {
    return {
      name: 'fade',
      keyframes: [
        { opacity: 1 },
        { opacity: 0 },
        { opacity: 1 }
      ],
      options: {
        duration: this.config.duration,
        easing: this.config.easing,
        fill: 'forwards'
      }
    };
  }

  private createSlideAnimation(direction: TransitionDirection): TransitionAnimation {
    const isForward = direction === 'forward';
    const slideDirection = isForward ? 'translateX(100%)' : 'translateX(-100%)';

    return {
      name: 'slide',
      keyframes: [
        { transform: 'translateX(0)' },
        { transform: slideDirection },
        { transform: 'translateX(0)' }
      ],
      options: {
        duration: this.config.duration,
        easing: this.config.easing,
        fill: 'forwards'
      }
    };
  }

  private async runAnimation(element: Element, animation: TransitionAnimation): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.currentAnimation = element.animate(animation.keyframes, animation.options);
        
        this.currentAnimation.addEventListener('finish', () => {
          this.log(`Animation ${animation.name} completed`);
          this.currentAnimation = undefined;
          resolve();
        });

        this.currentAnimation.addEventListener('cancel', () => {
          this.log(`Animation ${animation.name} cancelled`);
          this.currentAnimation = undefined;
          resolve();
        });

      } catch (error) {
        this.log(`Animation ${animation.name} failed`, error);
        reject(error);
      }
    });
  }

  public cancelCurrentTransition(): void {
    if (this.currentAnimation) {
      this.currentAnimation.cancel();
      this.currentAnimation = undefined;
    }

    // Clear transition queue
    this.transitionQueue.length = 0;
    this.isTransitioning = false;
  }

  public getTransitionDirection(from: RouteMatch | null, to: RouteMatch): TransitionDirection {
    if (!from) return 'forward';

    // Simple heuristic: compare route depth
    const fromDepth = this.getRouteDepth(from);
    const toDepth = this.getRouteDepth(to);

    if (toDepth > fromDepth) return 'forward';
    if (toDepth < fromDepth) return 'back';
    
    return 'replace';
  }

  private getRouteDepth(match: RouteMatch): number {
    let depth = 0;
    let current: RouteMatch | undefined = match;
    
    while (current) {
      depth++;
      current = current.child;
    }
    
    return depth;
  }

  public updateConfig(newConfig: Partial<TransitionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getStatus() {
    return {
      isTransitioning: this.isTransitioning,
      queueLength: this.transitionQueue.length,
      hasViewTransitions: this.hasViewTransitions,
      reducedMotion: this.reducedMotionQuery?.matches || false
    };
  }

  public destroy(): void {
    this.cancelCurrentTransition();
    
    if (this.reducedMotionQuery) {
      this.reducedMotionQuery.removeEventListener('change', this.handleMotionPreferenceChange.bind(this));
    }
  }
}

// Predefined transition functions
export const transitionPresets = {
  slideLeft: (_context: TransitionContext) => {
    const container = document.querySelector('[data-router-view]') || document.body;
    return container.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-100%)' },
      { transform: 'translateX(0)' }
    ], {
      duration: 300,
      easing: 'ease-in-out'
    }).finished;
  },

  slideRight: (_context: TransitionContext) => {
    const container = document.querySelector('[data-router-view]') || document.body;
    return container.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(100%)' },
      { transform: 'translateX(0)' }
    ], {
      duration: 300,
      easing: 'ease-in-out'
    }).finished;
  },

  scaleUp: (_context: TransitionContext) => {
    const container = document.querySelector('[data-router-view]') || document.body;
    return container.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.1)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ], {
      duration: 400,
      easing: 'ease-in-out'
    }).finished;
  }
};

// Default configuration
export const defaultTransitionConfig: Required<TransitionConfig> = {
  enabled: true,
  type: 'view-transitions',
  duration: 300,
  easing: 'ease-in-out',
  customTransition: null as any,
  skipSameRoute: true,
  fallbackTransition: 'fade',
  debugMode: false,
  respectPreferences: true
};

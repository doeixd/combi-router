// =================================================================
//
//      Combi-Router: Performance Monitoring and Analysis
//
//      This module provides comprehensive performance monitoring
//      for route navigation, data loading, and guard execution.
//
// =================================================================

import type { Route, RouteMatch } from '../core/types';
import type { CombiRouter } from '../core/router';

// =================================================================
// ---------------- PERFORMANCE TYPES & INTERFACES ---------------
// =================================================================

export interface NavigationTiming {
  id: string;
  route: Route<any>;
  params: any;
  startTime: number;
  endTime?: number;
  duration?: number;
  phases: {
    matching: number;
    guards: number;
    loaders: number;
    rendering: number;
  };
  cancelled: boolean;
  error?: any;
}

export interface LoaderTiming {
  routeId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  cached: boolean;
  error?: any;
  dataSize?: number;
}

export interface GuardTiming {
  routeId: string;
  guardIndex: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  result: boolean | string;
  error?: any;
}

export interface PerformanceMetrics {
  navigation: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    averageDuration: number;
    slowestNavigation: NavigationTiming | null;
    fastestNavigation: NavigationTiming | null;
  };
  loaders: {
    total: number;
    successful: number;
    failed: number;
    cacheHits: number;
    averageDuration: number;
    slowestLoader: LoaderTiming | null;
    totalDataSize: number;
  };
  guards: {
    total: number;
    allowed: number;
    blocked: number;
    redirected: number;
    averageDuration: number;
    slowestGuard: GuardTiming | null;
  };
}

export interface PerformanceInsights {
  bottlenecks: string[];
  recommendations: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of navigations to monitor
  slowNavigationThreshold: number; // ms
  slowLoaderThreshold: number; // ms
  slowGuardThreshold: number; // ms
  maxHistorySize: number;
}

// =================================================================
// ---------------- PERFORMANCE MONITOR CLASS --------------------
// =================================================================

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private router: CombiRouter;
  
  private navigationHistory: NavigationTiming[] = [];
  private loaderHistory: LoaderTiming[] = [];
  private guardHistory: GuardTiming[] = [];
  
  private currentNavigation: NavigationTiming | null = null;
  private activeLoaders = new Map<string, LoaderTiming>();
  private activeGuards = new Map<string, GuardTiming>();

  constructor(router: CombiRouter, config: Partial<PerformanceConfig> = {}) {
    this.router = router;
    this.config = {
      enabled: process.env.NODE_ENV !== 'production',
      sampleRate: 1.0,
      slowNavigationThreshold: 1000,
      slowLoaderThreshold: 500,
      slowGuardThreshold: 100,
      maxHistorySize: 100,
      ...config
    };

    if (this.config.enabled) {
      this.init();
    }
  }

  private init(): void {
    this.setupNavigationMonitoring();
    this.setupPerformanceObserver();
  }

  private setupNavigationMonitoring(): void {
    this.router.subscribe((match) => {
      if (this.router.isNavigating && !this.currentNavigation) {
        this.startNavigationTiming();
      } else if (!this.router.isNavigating && this.currentNavigation) {
        this.endNavigationTiming(match);
      }
    });
  }

  private setupPerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.name.startsWith('combi-router-')) {
              this.handlePerformanceEntry(entry);
            }
          });
        });
        
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (error) {
        console.warn('[CombiRouter] Performance observer not supported');
      }
    }
  }

  // =================================================================
  // ---------------- NAVIGATION TIMING ----------------------------
  // =================================================================

  private startNavigationTiming(): void {
    if (!this.shouldSample()) return;

    const navigation = this.router.currentNavigation;
    if (!navigation) return;

    this.currentNavigation = {
      id: this.generateId(),
      route: navigation.route,
      params: navigation.params,
      startTime: performance.now(),
      phases: {
        matching: 0,
        guards: 0,
        loaders: 0,
        rendering: 0
      },
      cancelled: false
    };

    this.markPerformance(`navigation-start-${this.currentNavigation.id}`);
  }

  private endNavigationTiming(match: RouteMatch<any> | null): void {
    if (!this.currentNavigation) return;

    const endTime = performance.now();
    this.currentNavigation.endTime = endTime;
    this.currentNavigation.duration = endTime - this.currentNavigation.startTime;
    this.currentNavigation.cancelled = this.router.currentNavigation?.cancelled || false;

    this.markPerformance(`navigation-end-${this.currentNavigation.id}`);

    // Calculate phases
    this.calculateNavigationPhases();

    // Store in history
    this.addToHistory(this.navigationHistory, this.currentNavigation);

    // Check for performance issues
    this.analyzeNavigationPerformance(this.currentNavigation);

    this.currentNavigation = null;
  }

  private calculateNavigationPhases(): void {
    if (!this.currentNavigation) return;

    // This is a simplified calculation
    // In a real implementation, you'd track each phase separately
    const totalDuration = this.currentNavigation.duration || 0;
    
    // Estimate phase durations based on route characteristics
    const hasGuards = this.currentNavigation.route.metadata.guards?.length || 0;
    const hasLoader = !!this.currentNavigation.route.metadata.loader;
    
    if (hasGuards > 0) {
      this.currentNavigation.phases.guards = totalDuration * 0.1; // 10%
    }
    
    if (hasLoader) {
      this.currentNavigation.phases.loaders = totalDuration * 0.6; // 60%
    }
    
    this.currentNavigation.phases.matching = totalDuration * 0.1; // 10%
    this.currentNavigation.phases.rendering = totalDuration * 0.2; // 20%
  }

  // =================================================================
  // ---------------- LOADER TIMING --------------------------------
  // =================================================================

  public startLoaderTiming(routeId: string): string {
    if (!this.config.enabled) return '';

    const timingId = this.generateId();
    const timing: LoaderTiming = {
      routeId,
      startTime: performance.now(),
      cached: false
    };

    this.activeLoaders.set(timingId, timing);
    this.markPerformance(`loader-start-${routeId}-${timingId}`);

    return timingId;
  }

  public endLoaderTiming(timingId: string, result: { cached?: boolean; dataSize?: number; error?: any } = {}): void {
    if (!this.config.enabled || !timingId) return;

    const timing = this.activeLoaders.get(timingId);
    if (!timing) return;

    timing.endTime = performance.now();
    timing.duration = timing.endTime - timing.startTime;
    timing.cached = result.cached || false;
    timing.dataSize = result.dataSize;
    timing.error = result.error;

    this.markPerformance(`loader-end-${timing.routeId}-${timingId}`);

    // Store in history
    this.addToHistory(this.loaderHistory, timing);

    // Check for performance issues
    this.analyzeLoaderPerformance(timing);

    this.activeLoaders.delete(timingId);
  }

  private analyzeLoaderPerformance(timing: LoaderTiming): void {
    if (timing.duration && timing.duration > this.config.slowLoaderThreshold) {
      console.warn(
        `[CombiRouter] Slow loader detected: Route ${timing.routeId} took ${timing.duration.toFixed(2)}ms`,
        timing.cached ? '(cached)' : '(network)'
      );
    }

    if (timing.dataSize && timing.dataSize > 1024 * 1024) { // 1MB
      console.warn(
        `[CombiRouter] Large data load: Route ${timing.routeId} loaded ${(timing.dataSize / 1024 / 1024).toFixed(2)}MB`
      );
    }
  }

  // =================================================================
  // ---------------- GUARD TIMING ---------------------------------
  // =================================================================

  public startGuardTiming(routeId: string, guardIndex: number): string {
    if (!this.config.enabled) return '';

    const timingId = this.generateId();
    const timing: GuardTiming = {
      routeId,
      guardIndex,
      startTime: performance.now(),
      result: false
    };

    this.activeGuards.set(timingId, timing);
    this.markPerformance(`guard-start-${routeId}-${guardIndex}-${timingId}`);

    return timingId;
  }

  public endGuardTiming(timingId: string, result: boolean | string, error?: any): void {
    if (!this.config.enabled || !timingId) return;

    const timing = this.activeGuards.get(timingId);
    if (!timing) return;

    timing.endTime = performance.now();
    timing.duration = timing.endTime - timing.startTime;
    timing.result = result;
    timing.error = error;

    this.markPerformance(`guard-end-${timing.routeId}-${timing.guardIndex}-${timingId}`);

    // Store in history
    this.addToHistory(this.guardHistory, timing);

    // Check for performance issues
    this.analyzeGuardPerformance(timing);

    this.activeGuards.delete(timingId);
  }

  private analyzeGuardPerformance(timing: GuardTiming): void {
    if (timing.duration && timing.duration > this.config.slowGuardThreshold) {
      console.warn(
        `[CombiRouter] Slow guard detected: Route ${timing.routeId} guard ${timing.guardIndex} took ${timing.duration.toFixed(2)}ms`
      );
    }
  }

  private analyzeNavigationPerformance(timing: NavigationTiming): void {
    if (timing.duration && timing.duration > this.config.slowNavigationThreshold) {
      console.warn(
        `[CombiRouter] Slow navigation detected: ${timing.duration.toFixed(2)}ms to route ${timing.route.id}`
      );
      
      // Break down the slow phases
      Object.entries(timing.phases).forEach(([phase, duration]) => {
        if (duration > timing.duration! * 0.3) { // Phase taking >30% of total time
          console.warn(`  - ${phase} phase took ${duration.toFixed(2)}ms (${((duration / timing.duration!) * 100).toFixed(1)}%)`);
        }
      });
    }
  }

  // =================================================================
  // ---------------- METRICS AND ANALYSIS -------------------------
  // =================================================================

  public getMetrics(): PerformanceMetrics {
    return {
      navigation: this.getNavigationMetrics(),
      loaders: this.getLoaderMetrics(),
      guards: this.getGuardMetrics()
    };
  }

  private getNavigationMetrics() {
    const navigations = this.navigationHistory;
    const successful = navigations.filter(n => !n.cancelled && !n.error);
    const failed = navigations.filter(n => n.error);
    const cancelled = navigations.filter(n => n.cancelled);

    const durations = successful.map(n => n.duration!).filter(d => d);
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total: navigations.length,
      successful: successful.length,
      failed: failed.length,
      cancelled: cancelled.length,
      averageDuration,
      slowestNavigation: successful.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] || null,
      fastestNavigation: successful.sort((a, b) => (a.duration || 0) - (b.duration || 0))[0] || null
    };
  }

  private getLoaderMetrics() {
    const loaders = this.loaderHistory;
    const successful = loaders.filter(l => !l.error);
    const failed = loaders.filter(l => l.error);
    const cached = loaders.filter(l => l.cached);

    const durations = successful.map(l => l.duration!).filter(d => d);
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const totalDataSize = loaders.reduce((total, l) => total + (l.dataSize || 0), 0);

    return {
      total: loaders.length,
      successful: successful.length,
      failed: failed.length,
      cacheHits: cached.length,
      averageDuration,
      slowestLoader: successful.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] || null,
      totalDataSize
    };
  }

  private getGuardMetrics() {
    const guards = this.guardHistory;
    const allowed = guards.filter(g => g.result === true);
    const blocked = guards.filter(g => g.result === false);
    const redirected = guards.filter(g => typeof g.result === 'string');

    const durations = guards.map(g => g.duration!).filter(d => d);
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total: guards.length,
      allowed: allowed.length,
      blocked: blocked.length,
      redirected: redirected.length,
      averageDuration,
      slowestGuard: guards.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] || null
    };
  }

  public getInsights(): PerformanceInsights {
    const metrics = this.getMetrics();
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Analyze navigation performance
    if (metrics.navigation.averageDuration > this.config.slowNavigationThreshold) {
      bottlenecks.push('Slow average navigation time');
      recommendations.push('Consider optimizing loaders or adding loading states');
    }

    // Analyze loader performance
    if (metrics.loaders.averageDuration > this.config.slowLoaderThreshold) {
      bottlenecks.push('Slow data loading');
      recommendations.push('Implement caching or optimize data fetching');
    }

    const cacheHitRate = metrics.loaders.total > 0 ? metrics.loaders.cacheHits / metrics.loaders.total : 0;
    if (cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate - consider implementing better caching strategies');
    }

    // Analyze guard performance
    if (metrics.guards.averageDuration > this.config.slowGuardThreshold) {
      bottlenecks.push('Slow route guards');
      recommendations.push('Optimize guard logic or reduce number of guards');
    }

    const blockRate = metrics.guards.total > 0 ? metrics.guards.blocked / metrics.guards.total : 0;
    if (blockRate > 0.2) {
      warnings.push('High guard block rate - users may be frequently blocked from routes');
    }

    // Calculate performance score (0-100)
    let score = 100;
    if (metrics.navigation.averageDuration > this.config.slowNavigationThreshold) score -= 20;
    if (metrics.loaders.averageDuration > this.config.slowLoaderThreshold) score -= 15;
    if (metrics.guards.averageDuration > this.config.slowGuardThreshold) score -= 10;
    if (cacheHitRate < 0.3) score -= 15;
    if (blockRate > 0.2) score -= 10;
    if (metrics.navigation.failed > metrics.navigation.successful * 0.1) score -= 20;

    return {
      bottlenecks,
      recommendations,
      warnings,
      score: Math.max(0, score)
    };
  }

  // =================================================================
  // ---------------- UTILITY METHODS ------------------------------
  // =================================================================

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private generateId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private markPerformance(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(name);
      } catch (error) {
        // Ignore marking errors
      }
    }
  }

  private addToHistory<T>(history: T[], item: T): void {
    history.push(item);
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    // Handle performance observer entries
    // This could be used for additional browser-level performance monitoring
  }

  // =================================================================
  // ---------------- PUBLIC API -----------------------------------
  // =================================================================

  public clearHistory(): void {
    this.navigationHistory = [];
    this.loaderHistory = [];
    this.guardHistory = [];
  }

  public updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public exportReport(): string {
    const metrics = this.getMetrics();
    const insights = this.getInsights();

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics,
      insights,
      history: {
        navigations: this.navigationHistory,
        loaders: this.loaderHistory,
        guards: this.guardHistory
      }
    }, null, 2);
  }

  public logReport(): void {
    if (!this.config.enabled) return;

    const metrics = this.getMetrics();
    const insights = this.getInsights();

    console.group('[CombiRouter] Performance Report');
    console.log(`Performance Score: ${insights.score}/100`);
    
    console.group('Navigation Metrics');
    console.log(`Total: ${metrics.navigation.total}`);
    console.log(`Success Rate: ${(metrics.navigation.successful / metrics.navigation.total * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${metrics.navigation.averageDuration.toFixed(2)}ms`);
    console.groupEnd();

    console.group('Loader Metrics');
    console.log(`Total: ${metrics.loaders.total}`);
    console.log(`Cache Hit Rate: ${(metrics.loaders.cacheHits / metrics.loaders.total * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${metrics.loaders.averageDuration.toFixed(2)}ms`);
    console.groupEnd();

    console.group('Guard Metrics');
    console.log(`Total: ${metrics.guards.total}`);
    console.log(`Block Rate: ${(metrics.guards.blocked / metrics.guards.total * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${metrics.guards.averageDuration.toFixed(2)}ms`);
    console.groupEnd();

    if (insights.bottlenecks.length > 0) {
      console.warn('Bottlenecks:', insights.bottlenecks);
    }

    if (insights.recommendations.length > 0) {
      console.info('Recommendations:', insights.recommendations);
    }

    if (insights.warnings.length > 0) {
      console.warn('Warnings:', insights.warnings);
    }

    console.groupEnd();
  }
}

// =================================================================
// ---------------- CONVENIENCE FUNCTIONS ------------------------
// =================================================================

/**
 * Creates a performance monitor for a router
 */
export function createPerformanceMonitor(router: CombiRouter, config?: Partial<PerformanceConfig>): PerformanceMonitor | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return new PerformanceMonitor(router, config);
}

/**
 * Quick function to log current performance metrics
 */
export function logPerformanceMetrics(router: CombiRouter): void {
  if (process.env.NODE_ENV === 'production') return;
  
  const monitor = new PerformanceMonitor(router);
  monitor.logReport();
}

// =================================================================
//
//      Combi-Router: Development Mode Features
//
//      This module aggregates all development mode utilities including
//      warnings, conflict detection, performance monitoring, and
//      enhanced debugging capabilities.
//
// =================================================================

import type { CombiRouter } from "../core/router";

// Import all dev modules
export * from "./warnings";
export * from "./conflicts";
export * from "./performance";
export * from "./debugging";
export * from "./validation";

import {
  DevWarningSystem,
  createWarningSystem,
  type WarningConfig,
} from "./warnings";
import {
  RouteConflictDetector,
  analyzeRouteConflicts,
  logRouteConflicts,
} from "./conflicts";
import {
  PerformanceMonitor,
  createPerformanceMonitor,
  type PerformanceConfig,
} from "./performance";
import {
  RouterDebugger,
  createDebugger,
  analyzeRouterStructure,
} from "./debugging";

// =================================================================
// -------------------- HELPER FUNCTIONS -------------------------
// =================================================================

/**
 * Helper function to get routes from router regardless of whether
 * routes is a function (layered router) or array property (CombiRouter)
 */
function getRoutes(router: any): any[] {
  if (typeof router.routes === "function") {
    return router.routes();
  }
  return router.routes || [];
}

// =================================================================
// ---------------- DEV MODE CONFIGURATION -----------------------
// =================================================================

export interface DevModeConfig {
  enabled: boolean;
  warnings: boolean | Partial<WarningConfig>;
  conflictDetection: boolean;
  performanceMonitoring: boolean | Partial<PerformanceConfig>;
  routeValidation: boolean;
  debugMode: boolean;
  autoAnalyze: boolean;
}

export interface DevModeFeatures {
  warningSystem: DevWarningSystem | null;
  conflictDetector: RouteConflictDetector | null;
  performanceMonitor: PerformanceMonitor | null;
  debugger: RouterDebugger | null;
}

// =================================================================
// ---------------- COMPREHENSIVE DEV MODE CLASS -----------------
// =================================================================

export class CombiRouterDevMode {
  private router: CombiRouter;
  private config: DevModeConfig;
  private features: DevModeFeatures;

  constructor(router: CombiRouter, config: Partial<DevModeConfig> = {}) {
    this.router = router;
    this.config = {
      enabled: process.env.NODE_ENV !== "production",
      warnings: true,
      conflictDetection: true,
      performanceMonitoring: true,
      routeValidation: true,
      debugMode: true,
      autoAnalyze: true,
      ...config,
    };

    this.features = {
      warningSystem: null,
      conflictDetector: null,
      performanceMonitor: null,
      debugger: null,
    };

    if (this.config.enabled) {
      this.init();
    }
  }

  private init(): void {
    console.log("[CombiRouter] Initializing development mode...");

    // Initialize warning system
    if (this.config.warnings) {
      const warningConfig =
        typeof this.config.warnings === "object" ? this.config.warnings : {};
      this.features.warningSystem = createWarningSystem(
        this.router,
        warningConfig,
      );
    }

    // Initialize conflict detector
    if (this.config.conflictDetection) {
      this.features.conflictDetector = new RouteConflictDetector(
        getRoutes(this.router),
      );
    }

    // Initialize performance monitor
    if (this.config.performanceMonitoring) {
      const perfConfig =
        typeof this.config.performanceMonitoring === "object"
          ? this.config.performanceMonitoring
          : {};
      this.features.performanceMonitor = createPerformanceMonitor(
        this.router,
        perfConfig,
      );
    }

    // Initialize debugger
    if (this.config.debugMode) {
      this.features.debugger = createDebugger(this.router);
    }

    // Run initial analysis
    if (this.config.autoAnalyze) {
      this.runInitialAnalysis();
    }

    // Log successful initialization
    console.log("[CombiRouter] Development mode initialized successfully");
    this.logFeatureStatus();
  }

  private runInitialAnalysis(): void {
    console.group("[CombiRouter] Running initial analysis...");

    // Analyze route conflicts
    if (this.features.conflictDetector) {
      const conflicts = this.features.conflictDetector.analyzeConflicts();
      if (conflicts.conflicts.length > 0) {
        console.warn(`Found ${conflicts.conflicts.length} route conflicts`);
        logRouteConflicts(getRoutes(this.router));
      } else {
        console.log("✅ No route conflicts detected");
      }
    }

    // Analyze route structure
    if (this.features.debugger) {
      analyzeRouterStructure(this.router);
    }

    // Log warning summary
    if (this.features.warningSystem) {
      const warnings = this.features.warningSystem.getWarnings();
      if (warnings.length > 0) {
        console.warn(`${warnings.length} development warnings detected`);
      } else {
        console.log("✅ No development warnings");
      }
    }

    console.groupEnd();
  }

  private logFeatureStatus(): void {
    console.group("[CombiRouter] Development Features Status");
    console.log(
      "Warning System:",
      this.features.warningSystem ? "✅ Active" : "❌ Disabled",
    );
    console.log(
      "Conflict Detection:",
      this.features.conflictDetector ? "✅ Active" : "❌ Disabled",
    );
    console.log(
      "Performance Monitor:",
      this.features.performanceMonitor ? "✅ Active" : "❌ Disabled",
    );
    console.log(
      "Enhanced Debugger:",
      this.features.debugger ? "✅ Active" : "❌ Disabled",
    );
    console.groupEnd();
  }

  // =================================================================
  // ---------------- PUBLIC API METHODS ---------------------------
  // =================================================================

  /**
   * Get comprehensive development report
   */
  public getDevReport(): any {
    if (!this.config.enabled) {
      return { error: "Development mode is disabled" };
    }

    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      warnings: this.features.warningSystem?.getWarnings() || [],
      conflicts: this.features.conflictDetector?.analyzeConflicts() || {
        conflicts: [],
      },
      performance: this.features.performanceMonitor?.getMetrics() || null,
      routeAnalysis: this.features.debugger?.analyzeRoutes() || [],
      validation: this.features.debugger?.validateRouteConfiguration() || null,
      optimizations: this.features.debugger?.suggestOptimizations() || [],
    };

    return report;
  }

  /**
   * Log comprehensive development report to console
   */
  public logDevReport(): void {
    if (!this.config.enabled) {
      console.log("[CombiRouter] Development mode is disabled");
      return;
    }

    const report = this.getDevReport();

    console.group("[CombiRouter] Comprehensive Development Report");

    // Summary
    console.log(`Generated at: ${report.timestamp}`);
    console.log(`Total Routes: ${getRoutes(this.router).length}`);
    console.log(`Warnings: ${report.warnings.length}`);
    console.log(`Conflicts: ${report.conflicts.conflicts.length}`);

    // Performance summary
    if (report.performance) {
      console.group("Performance Summary");
      console.log(
        `Navigation Success Rate: ${((report.performance.navigation.successful / report.performance.navigation.total) * 100).toFixed(1)}%`,
      );
      console.log(
        `Average Navigation Time: ${report.performance.navigation.averageDuration.toFixed(2)}ms`,
      );
      console.log(
        `Cache Hit Rate: ${((report.performance.loaders.cacheHits / report.performance.loaders.total) * 100).toFixed(1)}%`,
      );
      console.groupEnd();
    }

    // Route analysis summary
    if (report.routeAnalysis.length > 0) {
      const complexRoutes = report.routeAnalysis.filter(
        (r: any) => r.complexity > 20,
      );
      console.group("Route Analysis Summary");
      console.log(`High Complexity Routes: ${complexRoutes.length}`);
      console.log(
        `Total Issues: ${report.routeAnalysis.reduce((acc: number, r: any) => acc + r.potentialIssues.length, 0)}`,
      );
      console.log(
        `Total Optimizations: ${report.routeAnalysis.reduce((acc: number, r: any) => acc + r.optimizations.length, 0)}`,
      );
      console.groupEnd();
    }

    // Recommendations
    const recommendations = this.generateRecommendations(report);
    if (recommendations.length > 0) {
      console.group("📋 Recommendations");
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  private generateRecommendations(report: any): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (report.performance) {
      if (report.performance.navigation.averageDuration > 1000) {
        recommendations.push(
          "Consider optimizing slow routes or adding loading states",
        );
      }

      const cacheHitRate =
        report.performance.loaders.cacheHits / report.performance.loaders.total;
      if (cacheHitRate < 0.3) {
        recommendations.push(
          "Implement better caching strategies to improve performance",
        );
      }
    }

    // Conflict recommendations
    if (report.conflicts.conflicts.length > 0) {
      recommendations.push(
        "Resolve route conflicts to prevent navigation issues",
      );
    }

    // Warning recommendations
    const errorWarnings = report.warnings.filter(
      (w: any) => w.severity === "error",
    );
    if (errorWarnings.length > 0) {
      recommendations.push("Fix critical routing errors immediately");
    }

    // Optimization recommendations
    if (report.optimizations.length > 0) {
      const highPriority = report.optimizations.filter(
        (o: any) => o.priority === "high",
      );
      if (highPriority.length > 0) {
        recommendations.push(
          "Implement high-priority optimizations for better performance",
        );
      }
    }

    return recommendations;
  }

  /**
   * Export development data for external analysis
   */
  public exportDevData(): string {
    return JSON.stringify(this.getDevReport(), null, 2);
  }

  /**
   * Clear all development data and history
   */
  public clearDevData(): void {
    this.features.warningSystem?.clearWarnings();
    this.features.performanceMonitor?.clearHistory();
    this.features.debugger?.clearTraces();
    console.log("[CombiRouter] Development data cleared");
  }

  /**
   * Update development mode configuration
   */
  public updateConfig(newConfig: Partial<DevModeConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update individual feature configs
    if (newConfig.warnings && this.features.warningSystem) {
      const warningConfig =
        typeof newConfig.warnings === "object" ? newConfig.warnings : {};
      this.features.warningSystem.updateConfig(warningConfig);
    }

    if (newConfig.performanceMonitoring && this.features.performanceMonitor) {
      const perfConfig =
        typeof newConfig.performanceMonitoring === "object"
          ? newConfig.performanceMonitoring
          : {};
      this.features.performanceMonitor.updateConfig(perfConfig);
    }

    console.log("[CombiRouter] Development mode configuration updated");
  }

  /**
   * Enable/disable specific development features
   */
  public toggleFeature(feature: keyof DevModeFeatures, enabled: boolean): void {
    switch (feature) {
      case "warningSystem":
        if (this.features.warningSystem) {
          if (enabled) {
            this.features.warningSystem.enable();
          } else {
            this.features.warningSystem.disable();
          }
        }
        break;
      case "performanceMonitor":
        // Performance monitor doesn't have enable/disable, so we'd need to recreate it
        break;
    }
  }

  /**
   * Get access to individual development features
   */
  public getFeature<T extends keyof DevModeFeatures>(
    feature: T,
  ): DevModeFeatures[T] {
    return this.features[feature];
  }

  /**
   * Run on-demand analysis
   */
  public runAnalysis(): void {
    this.runInitialAnalysis();
  }
}

// =================================================================
// ---------------- CONVENIENCE FUNCTIONS ------------------------
// =================================================================

/**
 * Initialize comprehensive development mode for a router
 */
export function enableDevMode(
  router: CombiRouter,
  config?: Partial<DevModeConfig>,
): CombiRouterDevMode | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return new CombiRouterDevMode(router, config);
}

/**
 * Quick function to run development analysis on a router
 */
export function analyzeRouter(router: CombiRouter): void {
  if (process.env.NODE_ENV === "production") return;

  console.group("[CombiRouter] Quick Development Analysis");

  // Run conflict analysis
  const conflicts = analyzeRouteConflicts(getRoutes(router));
  console.log(`Route Conflicts: ${conflicts.conflicts.length}`);

  // Run structure analysis
  analyzeRouterStructure(router);

  // Create temporary warning system for analysis
  const warningSystem = createWarningSystem(router, {
    runtimeWarnings: false,
    staticWarnings: true,
  });

  if (warningSystem) {
    const warnings = warningSystem.getWarnings();
    console.log(`Development Warnings: ${warnings.length}`);
  }

  console.groupEnd();
}

/**
 * Create development tools with minimal setup
 */
export function createDevTools(router: CombiRouter) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return {
    warnings: createWarningSystem(router),
    conflicts: new RouteConflictDetector(getRoutes(router)),
    performance: createPerformanceMonitor(router),
    debugger: createDebugger(router),
    analyze: () => analyzeRouter(router),
  };
}

// =================================================================
// ---------------- GLOBAL DEV MODE SETUP ------------------------
// =================================================================

/**
 * Add development features to window object for browser debugging
 */
export function exposeDevTools(
  router: CombiRouter,
  devMode?: CombiRouterDevMode,
): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined")
    return;

  const tools = devMode || enableDevMode(router);

  // Expose to window for debugging
  (window as any).combiRouterDev = {
    router,
    devMode: tools,
    analyze: () => tools?.runAnalysis(),
    report: () => tools?.logDevReport(),
    export: () => tools?.exportDevData(),
    clear: () => tools?.clearDevData(),
  };

  console.log(
    "[CombiRouter] Development tools exposed to window.combiRouterDev",
  );
}

// =================================================================
// ---------------- TYPE EXPORTS ---------------------------------
// =================================================================

export type {
  DevModeConfig,
  DevModeFeatures,
  WarningConfig,
  PerformanceConfig,
};

// Re-export all types from individual modules
export type { DevWarning, WarningType, WarningSeverity } from "./warnings";

export type {
  RouteConflict,
  ConflictType,
  ConflictAnalysis,
} from "./conflicts";

export type {
  NavigationTiming,
  LoaderTiming,
  GuardTiming,
  PerformanceMetrics,
  PerformanceInsights,
} from "./performance";

export type {
  RouteAnalysis,
  NavigationTrace,
  NavigationStep,
  MatchInspection,
  ValidationReport,
  Optimization,
} from "./debugging";

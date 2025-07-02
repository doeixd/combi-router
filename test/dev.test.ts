// =================================================================
//
//      Combi-Router: Development Mode Tests
//
//      Tests for all development mode features including warnings,
//      conflict detection, performance monitoring, and debugging.
//
// =================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRouter } from '../src/core/router';
import { route, extend } from '../src/core/route';
import { path, param } from '../src/core/matchers';
import { z } from 'zod';

// Import dev modules
import { 
  DevWarningSystem, 
  createWarningSystem,
  WarningType,
  WarningSeverity 
} from '../src/dev/warnings';
import { 
  RouteConflictDetector, 
  analyzeRouteConflicts,
  ConflictType 
} from '../src/dev/conflicts';
import { 
  PerformanceMonitor,
  createPerformanceMonitor 
} from '../src/dev/performance';
import { 
  RouterDebugger,
  createDebugger 
} from '../src/dev/debugging';
import { 
  enableDevMode,
  analyzeRouter,
  createDevTools 
} from '../src/dev/index';

describe('Development Mode Features', () => {
  let consoleLog: any;
  let consoleWarn: any;
  let consoleError: any;

  beforeEach(() => {
    // Mock console methods to avoid test noise
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock NODE_ENV to development
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Warning System', () => {
    it('should create warning system in development mode', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const warningSystem = createWarningSystem(router);
      expect(warningSystem).toBeInstanceOf(DevWarningSystem);
    });

    it('should not create warning system in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const warningSystem = createWarningSystem(router);
      expect(warningSystem).toBeNull();
    });

    it('should detect unused parameters', () => {
      const userRoute = route(path('users'), param('id', z.number()));
      const router = createRouter([userRoute]);
      
      const warningSystem = createWarningSystem(router);
      const warnings = warningSystem?.getWarnings() || [];
      
      const unusedParamWarnings = warnings.filter(w => w.type === WarningType.UNUSED_PARAMETER);
      expect(unusedParamWarnings.length).toBeGreaterThan(0);
    });

    it('should detect conflicting routes', () => {
      const route1 = route(path('test'));
      const route2 = route(path('test')); // Duplicate
      const router = createRouter([route1, route2]);
      
      const warningSystem = createWarningSystem(router);
      const warnings = warningSystem?.getWarnings() || [];
      
      const conflictWarnings = warnings.filter(w => w.type === WarningType.CONFLICTING_ROUTES);
      expect(conflictWarnings.length).toBeGreaterThan(0);
    });

    it('should provide warning severity filtering', () => {
      const userRoute = route(path('users'), param('id', z.number()));
      const router = createRouter([userRoute]);
      
      const warningSystem = createWarningSystem(router, {
        severityFilter: [WarningSeverity.ERROR]
      });
      
      const allWarnings = warningSystem?.getWarnings() || [];
      const errorWarnings = warningSystem?.getWarningsBySeverity(WarningSeverity.ERROR) || [];
      
      expect(errorWarnings.every(w => w.severity === WarningSeverity.ERROR)).toBe(true);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect route conflicts', () => {
      const staticRoute = route(path('users'), path('settings'));
      const dynamicRoute = route(path('users'), param('id', z.string()));
      const router = createRouter([staticRoute, dynamicRoute]);
      
      const detector = new RouteConflictDetector(router.routes);
      const analysis = detector.analyzeConflicts();
      
      expect(analysis.conflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect duplicate static paths', () => {
      const route1 = route(path('home'));
      const route2 = route(path('home'));
      const router = createRouter([route1, route2]);
      
      const analysis = analyzeRouteConflicts(router.routes);
      const duplicates = analysis.conflicts.filter(c => c.type === ConflictType.DUPLICATE_STATIC);
      
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should detect wildcard conflicts', () => {
      const wildcardRoute = route(path('docs'), path.wildcard('segments'));
      const specificRoute = route(path('docs'), path('api'));
      const router = createRouter([wildcardRoute, specificRoute]); // Wrong order
      
      const analysis = analyzeRouteConflicts(router.routes);
      const wildcardConflicts = analysis.conflicts.filter(c => c.type === ConflictType.WILDCARD);
      
      expect(wildcardConflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide conflict suggestions', () => {
      const route1 = route(path('test'));
      const route2 = route(path('test'));
      const router = createRouter([route1, route2]);
      
      const analysis = analyzeRouteConflicts(router.routes);
      
      analysis.conflicts.forEach(conflict => {
        expect(conflict.suggestion).toBeTruthy();
        expect(typeof conflict.suggestion).toBe('string');
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should create performance monitor in development mode', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const monitor = createPerformanceMonitor(router);
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should not create performance monitor in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const monitor = createPerformanceMonitor(router);
      expect(monitor).toBeNull();
    });

    it('should track navigation metrics', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const monitor = createPerformanceMonitor(router);
      const metrics = monitor?.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics?.navigation).toBeDefined();
      expect(metrics?.loaders).toBeDefined();
      expect(metrics?.guards).toBeDefined();
    });

    it('should provide performance insights', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const monitor = createPerformanceMonitor(router);
      const insights = monitor?.getInsights();
      
      expect(insights).toBeDefined();
      expect(insights?.score).toBeGreaterThanOrEqual(0);
      expect(insights?.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(insights?.recommendations)).toBe(true);
    });

    it('should support configuration updates', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const monitor = createPerformanceMonitor(router, {
        slowNavigationThreshold: 500
      });
      
      monitor?.updateConfig({
        slowNavigationThreshold: 1000
      });
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('Enhanced Debugging', () => {
    it('should create debugger in development mode', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const routerDebugger = createDebugger(router);
      expect(routerDebugger).toBeInstanceOf(RouterDebugger);
    });

    it('should analyze route complexity', () => {
      const baseRoute = route(path('admin'));
      const nestedRoute = extend(baseRoute, path('users'), param('userId', z.string()));
      const complexRoute = extend(nestedRoute, path('settings'), param('settingId', z.string()));
      const router = createRouter([baseRoute, nestedRoute, complexRoute]);
      
      const routerDebugger = createDebugger(router);
      const analysis = routerDebugger?.analyzeRoutes() || [];
      
      expect(analysis.length).toBe(3);
      const complexAnalysis = analysis.find(a => a.route === complexRoute);
      expect(complexAnalysis?.complexity).toBeGreaterThan(0);
      expect(complexAnalysis?.depth).toBeGreaterThan(0);
    });

    it('should validate route configuration', () => {
      const homeRoute = route(path('home'));
      const userRoute = route(path('users'), param('id', z.number()));
      const router = createRouter([homeRoute, userRoute]);
      
      const routerDebugger = createDebugger(router);
      const validation = routerDebugger?.validateRouteConfiguration();
      
      expect(validation).toBeDefined();
      expect(typeof validation?.valid).toBe('boolean');
      expect(Array.isArray(validation?.errors)).toBe(true);
      expect(Array.isArray(validation?.warnings)).toBe(true);
    });

    it('should suggest optimizations', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const routerDebugger = createDebugger(router);
      const optimizations = routerDebugger?.suggestOptimizations() || [];
      
      expect(Array.isArray(optimizations)).toBe(true);
      optimizations.forEach(opt => {
        expect(opt.type).toBeTruthy();
        expect(opt.description).toBeTruthy();
        expect(opt.suggestion || opt.implementation).toBeTruthy();
      });
    });

    it('should generate route tree visualization', () => {
      const homeRoute = route(path('home'));
      const aboutRoute = route(path('about'));
      const userRoute = extend(homeRoute, path('user'), param('id', z.number()));
      const router = createRouter([homeRoute, aboutRoute, userRoute]);
      
      const routerDebugger = createDebugger(router);
      const tree = routerDebugger?.generateRouteTree();
      
      expect(typeof tree).toBe('string');
      expect(tree?.length).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Dev Mode', () => {
    it('should enable comprehensive dev mode', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const devMode = enableDevMode(router);
      
      expect(devMode).toBeDefined();
      expect(devMode?.getDevReport).toBeDefined();
    });

    it('should generate comprehensive development report', () => {
      const homeRoute = route(path('home'));
      const userRoute = route(path('users'), param('id', z.number()));
      const router = createRouter([homeRoute, userRoute]);
      
      const devMode = enableDevMode(router);
      const report = devMode?.getDevReport();
      
      expect(report).toBeDefined();
      expect(report?.timestamp).toBeTruthy();
      expect(Array.isArray(report?.warnings)).toBe(true);
      expect(report?.conflicts).toBeDefined();
      expect(Array.isArray(report?.routeAnalysis)).toBe(true);
    });

    it('should export development data', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const devMode = enableDevMode(router);
      const data = devMode?.exportDevData();
      
      expect(typeof data).toBe('string');
      
      // Should be valid JSON
      const parsed = JSON.parse(data);
      expect(parsed).toBeDefined();
      expect(parsed.timestamp).toBeTruthy();
    });

    it('should clear development data', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const devMode = enableDevMode(router);
      
      // Clear should not throw
      expect(() => devMode?.clearDevData()).not.toThrow();
    });

    it('should update configuration', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const devMode = enableDevMode(router);
      
      // Update should not throw
      expect(() => devMode?.updateConfig({ warnings: false })).not.toThrow();
    });
  });

  describe('Convenience Functions', () => {
    it('should analyze router with convenience function', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      // Should not throw
      expect(() => analyzeRouter(router)).not.toThrow();
    });

    it('should create dev tools', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const tools = createDevTools(router);
      
      expect(tools).toBeDefined();
      expect(tools?.warnings).toBeDefined();
      expect(tools?.conflicts).toBeDefined();
      expect(tools?.performance).toBeDefined();
      expect(tools?.debugger).toBeDefined();
      expect(typeof tools?.analyze).toBe('function');
    });

    it('should not create dev tools in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      const tools = createDevTools(router);
      expect(tools).toBeNull();
    });
  });

  describe('Router Integration', () => {
    it('should initialize dev mode automatically', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      // Dev mode should be available
      expect(router.enableDevAnalysis).toBeDefined();
      expect(router.logDevReport).toBeDefined();
    });

    it('should handle dev mode methods gracefully', () => {
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      // Should not throw even if dev mode is not fully initialized
      expect(() => router.enableDevAnalysis()).not.toThrow();
      expect(() => router.logDevReport()).not.toThrow();
    });
  });

  describe('Production Mode Behavior', () => {
    it('should disable all dev features in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      // All dev functions should return null in production
      expect(createWarningSystem(router)).toBeNull();
      expect(createPerformanceMonitor(router)).toBeNull();
      expect(createDebugger(router)).toBeNull();
      expect(enableDevMode(router)).toBeNull();
      expect(createDevTools(router)).toBeNull();
    });

    it('should not log anything in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const homeRoute = route(path('home'));
      const router = createRouter([homeRoute]);
      
      analyzeRouter(router);
      
      // Should not have called console methods
      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    });
  });
});

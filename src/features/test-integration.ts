// =================================================================
//
//      Combi-Router: Production Features Integration Test
//
//      Basic test to ensure features integrate properly
//
// =================================================================

import { createRouter, route, path, param } from '../core';
import { defaultScrollRestorationConfig, defaultCodeSplittingConfig, defaultTransitionConfig, defaultPerformanceConfig } from './index';
import { z } from 'zod';

// Create test routes
const homeRoute = route(path('home'));
const userRoute = route(path('users'), param('id', z.number()));

// Create router with production features
const router = createRouter([homeRoute, userRoute], {
  features: {
    scrollRestoration: {
      ...defaultScrollRestorationConfig,
      enabled: true
    },
    codeSplitting: {
      ...defaultCodeSplittingConfig,
      strategy: 'route-based',
      preloadStrategy: 'hover'
    },
    transitions: {
      ...defaultTransitionConfig,
      type: 'fade',
      duration: 200
    },
    performance: {
      ...defaultPerformanceConfig,
      prefetchOnHover: true,
      prefetchViewport: false
    }
  }
});

// Test feature access
console.log('Router features initialized:');
console.log('- Scroll restoration:', !!router.scrollRestoration);
console.log('- Code splitting:', !!router.codeSplitting);
console.log('- Transitions:', !!router.transitions);
console.log('- Performance:', !!router.performance);

export { router };

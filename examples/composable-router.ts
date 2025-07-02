// =================================================================
//
//      Combi-Router: Composable API Examples
//
//      Examples demonstrating the new layered, composable router API
//
// =================================================================

import { 
  route, 
  createLayeredRouter,
  createCoreNavigationLayer,
  withPerformance,
  withScrollRestoration,
  makeLayered
} from '../src';

// =================================================================
// Example 1: Basic Composable Router
// =================================================================

const basicRoutes = [
  route('/').id('home'),
  route('/about').id('about'),
  route('/user/:id').id('user')
];

// Create a router with just core navigation
const basicRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  ();

// Usage
basicRouter.navigate('/user/123');
console.log(basicRouter.currentMatch?.params); // { id: '123' }

// =================================================================
// Example 2: Router with Performance Layer
// =================================================================

const performanceRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  (withPerformance({
    prefetchOnHover: true,
    prefetchViewport: true,
    enablePerformanceMonitoring: true
  }))
  ();

// Now we have performance methods available
performanceRouter.prefetchRoute('user');
performanceRouter.setupHoverPrefetch(document.getElementById('link')!, 'about');

// =================================================================
// Example 3: Full-Featured Router
// =================================================================

const fullRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  (withPerformance({
    prefetchOnHover: true,
    connectionAware: true
  }))
  (withScrollRestoration({
    strategy: 'smooth',
    restoreOnBack: true
  }))
  ();

// All features are now available
fullRouter.navigate('/about');
fullRouter.saveScrollPosition();
fullRouter.prefetchRoute('user', 'high');

// =================================================================
// Example 4: Custom User Layer
// =================================================================

// Create a custom analytics layer
const withAnalytics = (config: { trackingId: string }) => (self: any) => {
  // Register lifecycle hooks
  if ('_registerLifecycleHook' in self) {
    self._registerLifecycleHook('onNavigationStart', (context: any) => {
      console.log(`[Analytics] Navigation started: ${context.to?.path}`);
      // Send to analytics service
    });

    self._registerLifecycleHook('onNavigationComplete', (match: any) => {
      console.log(`[Analytics] Page view: ${match.path}`);
      // Track page view
    });
  }

  return {
    trackEvent: (event: string, data?: any) => {
      console.log(`[Analytics] Event: ${event}`, data);
      // Send custom event
    },
    
    trackError: (error: Error, context?: any) => {
      console.log(`[Analytics] Error: ${error.message}`, context);
      // Track error
    }
  };
};

const analyticsRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  (withPerformance())
  (withAnalytics({ trackingId: 'UA-123456-7' }))
  ();

// Use custom analytics methods
analyticsRouter.trackEvent('button_click', { button: 'signup' });

// =================================================================
// Example 5: Conditional Layers (Based on Environment)
// =================================================================

import { conditionalLayer } from '../src';

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

const environmentalRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  // Only add performance layer in production
  (conditionalLayer(isProd, withPerformance({
    prefetchOnHover: true,
    enablePerformanceMonitoring: true
  })))
  // Only add debug layer in development
  (conditionalLayer(isDev, (self: any) => ({
    debug: () => console.log('Router state:', self.currentMatch),
    logNavigation: () => {
      if ('_registerLifecycleHook' in self) {
        self._registerLifecycleHook('onNavigationStart', (context: any) => {
          console.log('[DEBUG] Navigation:', context);
        });
      }
      return {};
    }
  })))
  ();

// =================================================================
// Example 6: Advanced Layer Composition
// =================================================================

// Create a custom layer that orchestrates other layers
const withAdvancedFeatures = (self: any) => {
  // This layer can call methods from previously applied layers
  const enhancedPrefetch = async (routeId: string) => {
    // Use performance layer if available
    if ('prefetchRoute' in self) {
      await self.prefetchRoute(routeId, 'high');
    }
    
    // Also save scroll position before navigation
    if ('saveScrollPosition' in self) {
      self.saveScrollPosition();
    }
  };

  const smartNavigate = async (path: string, options: any = {}) => {
    // Track with analytics if available
    if ('trackEvent' in self) {
      self.trackEvent('navigation_intent', { path });
    }

    // Perform the navigation
    const result = await self.navigate(path, options);
    
    if (result && 'trackEvent' in self) {
      self.trackEvent('navigation_complete', { path });
    }
    
    return result;
  };

  return {
    enhancedPrefetch,
    smartNavigate
  };
};

const advancedRouter = createLayeredRouter(basicRoutes)
  (createCoreNavigationLayer())
  (withPerformance())
  (withScrollRestoration())
  (withAnalytics({ trackingId: 'UA-123456-7' }))
  (withAdvancedFeatures)
  ();

// Use the orchestrated functionality
advancedRouter.smartNavigate('/user/456');
advancedRouter.enhancedPrefetch('about');

// =================================================================
// Example 7: Using makeLayered Directly for Maximum Control
// =================================================================

// For ultimate control, use makeLayered directly
const customRouter = makeLayered({
  routes: basicRoutes,
  currentPath: '/',
  config: { enableFeatureX: true }
})
// Base navigation
(createCoreNavigationLayer())
// Custom business logic layer
((self: any) => ({
  businessLogic: {
    checkPermissions: (routeId: string) => {
      console.log(`Checking permissions for: ${routeId}`);
      return true;
    },
    
    logAccess: (routeId: string) => {
      console.log(`Access logged for: ${routeId}`);
    }
  },
  
  navigateWithPermissions: async (path: string) => {
    const match = self.match(path);
    if (match && self.businessLogic.checkPermissions(match.route.id)) {
      self.businessLogic.logAccess(match.route.id);
      return self.navigate(path);
    }
    throw new Error('Permission denied');
  }
}))
// Feature layers
(withPerformance())
// Finalize
();

// Use the fully custom router
customRouter.navigateWithPermissions('/admin');

// =================================================================
// Example 8: Migration from Old to New API
// =================================================================

// Old API (still works due to backwards compatibility)
import { CombiRouter } from '../src';

const oldRouter = new CombiRouter(basicRoutes, {
  baseURL: '/app',
  features: {
    performance: {
      prefetchOnHover: true
    },
    scrollRestoration: {
      strategy: 'smooth'
    }
  }
});

// New API (equivalent functionality)
const newRouter = createLayeredRouter(basicRoutes, { baseURL: '/app' })
  (createCoreNavigationLayer())
  (withPerformance({ prefetchOnHover: true }))
  (withScrollRestoration({ strategy: 'smooth' }))
  ();

// Both have the same API surface
oldRouter.navigate('/about');
newRouter.navigate('/about');

console.log('Migration complete! Both routers work identically.');

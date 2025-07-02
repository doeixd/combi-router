/**
 * Example: Using the Head Management Module with Combi-Router
 * 
 * This example demonstrates how to use the powerful head management 
 * module to manage document head tags in your application.
 */

import { route, path, param, extend, pipe, createRouter } from '@doeixd/combi-router';
import { head, seoMeta, HeadManager, resolveHeadData } from '@doeixd/combi-router/features';
import { z } from 'zod';

// ======================================================================
// 1. Basic head data with static content
// ======================================================================

const homeRoute = pipe(
  route(path('')),
  head({
    title: 'Welcome to Our Site',
    meta: [
      { name: 'description', content: 'The best website for amazing content' },
      { name: 'keywords', content: 'home, welcome, amazing' }
    ],
    link: [
      { rel: 'canonical', href: 'https://example.com' }
    ]
  })
);

// ======================================================================
// 2. Dynamic head data based on route parameters
// ======================================================================

const blogRoute = route(path('blog'));

const blogPostRoute = pipe(
  extend(blogRoute, param('slug', z.string())),
  head(({ params }) => ({
    title: `Blog Post: ${params.slug}`,
    meta: [
      { name: 'description', content: `Read our latest blog post about ${params.slug}` },
      { name: 'author', content: 'Our Blog Team' }
    ],
    link: [
      { rel: 'canonical', href: `https://example.com/blog/${params.slug}` }
    ]
  }))
);

// ======================================================================
// 3. SEO-optimized routes with Open Graph and Twitter Cards
// ======================================================================

const productRoute = pipe(
  route(path('products'), param('id', z.number())),
  head(({ params }) => ({
    title: `Product ${params.id} - Amazing Store`,
    titleTemplate: 'Store | %s', // Results in: "Store | Product 123 - Amazing Store"
    
    // Combine multiple SEO utilities
    ...seoMeta.basic({
      description: `Check out our amazing product ${params.id}`,
      keywords: ['product', 'store', 'shopping'],
      robots: 'index,follow'
    }),
    
    ...seoMeta.og({
      title: `Amazing Product ${params.id}`,
      description: 'The best product you will ever buy',
      image: `https://example.com/products/${params.id}/image.jpg`,
      url: `https://example.com/products/${params.id}`,
      type: 'product'
    }),
    
    ...seoMeta.twitter({
      card: 'summary_large_image',
      title: `Product ${params.id}`,
      description: 'An amazing product that will change your life',
      image: `https://example.com/products/${params.id}/twitter-image.jpg`,
      creator: '@amazingstore'
    })
  }))
);

// ======================================================================
// 4. Advanced head features: scripts, styles, and attributes
// ======================================================================

const dashboardRoute = pipe(
  route(path('dashboard')),
  head({
    title: 'Dashboard',
    
    // Add custom scripts
    script: [
      {
        src: 'https://analytics.example.com/track.js',
        async: true,
        defer: true
      },
      {
        // Inline script
        innerHTML: `
          window.dashboardConfig = {
            theme: 'dark',
            version: '2.0'
          };
        `
      }
    ],
    
    // Add custom styles
    style: [
      {
        innerHTML: `
          body.dashboard {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
        `
      }
    ],
    
    // Set HTML and body attributes
    htmlAttrs: {
      lang: 'en',
      'data-theme': 'dark'
    },
    
    bodyAttrs: {
      class: 'dashboard dark-mode'
    }
  })
);

// ======================================================================
// 5. Setting up the router and head manager
// ======================================================================

const routes = [
  homeRoute,
  blogRoute,
  blogPostRoute,
  productRoute,
  dashboardRoute
];

const router = createRouter(routes);

// Initialize the head manager
const headManager = new HeadManager(document);

// ======================================================================
// 6. Integrating with navigation
// ======================================================================

// Listen for navigation changes and update head tags
router.onNavigate((match) => {
  if (match?.route._head) {
    // Resolve the head data with current route context
    const resolvedHead = resolveHeadData(match.route._head, match);
    
    // Apply to the DOM
    headManager.apply(resolvedHead);
    
    console.log('Updated head tags for route:', match.route);
  }
});

// ======================================================================
// 7. Server-Side Rendering support
// ======================================================================

// For SSR, you can generate HTML strings
async function renderPageWithSSR(url: string) {
  const match = await router.match(url);
  
  if (match?.route._head) {
    const resolvedHead = resolveHeadData(match.route._head, match);
    const { headTags, htmlAttrs, bodyAttrs } = HeadManager.generateSSR(resolvedHead);
    
    return `
      <!DOCTYPE html>
      <html ${htmlAttrs}>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          ${headTags}
        </head>
        <body ${bodyAttrs}>
          <div id="app">
            <!-- Your app content here -->
          </div>
        </body>
      </html>
    `;
  }
  
  return '<html><head></head><body>Page not found</body></html>';
}

// ======================================================================
// 8. Example usage
// ======================================================================

// Navigate to different routes to see head tags update
async function demo() {
  // Navigate to home
  await router.navigate(homeRoute, {});
  // Head: "Welcome to Our Site" + meta description + canonical link
  
  // Navigate to blog post
  await router.navigate(blogPostRoute, { slug: 'awesome-post' });
  // Head: "Blog Post: awesome-post" + dynamic meta tags
  
  // Navigate to product
  await router.navigate(productRoute, { id: 123 });
  // Head: "Store | Product 123 - Amazing Store" + full SEO suite
  
  // Navigate to dashboard
  await router.navigate(dashboardRoute, {});
  // Head: Custom scripts, styles, and body classes applied
}

// Start the demo
demo();

// ======================================================================
// 9. Framework integration examples
// ======================================================================

// React Hook
function useHeadManager() {
  const [router] = React.useState(() => createRouter(routes));
  const [headManager] = React.useState(() => new HeadManager());
  
  React.useEffect(() => {
    return router.onNavigate((match) => {
      if (match?.route._head) {
        const resolvedHead = resolveHeadData(match.route._head, match);
        headManager.apply(resolvedHead);
      }
    });
  }, [router, headManager]);
  
  return router;
}

// Vue Composable
function useHead(router: Router) {
  const headManager = new HeadManager();
  
  watch(
    () => router.currentMatch,
    (match) => {
      if (match?.route._head) {
        const resolvedHead = resolveHeadData(match.route._head, match);
        headManager.apply(resolvedHead);
      }
    },
    { immediate: true }
  );
}

export {
  homeRoute,
  blogPostRoute,
  productRoute,
  dashboardRoute,
  router,
  headManager,
  renderPageWithSSR
};

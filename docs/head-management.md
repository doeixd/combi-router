# Head Management with Combi-Router

The head management module provides a powerful alternative to the basic `meta` function, offering comprehensive document head management inspired by [Unhead](https://unhead.unjs.io). This module allows you to dynamically manage titles, meta tags, links, scripts, and other head elements based on your routes.

## Installation

The head management module is part of the features package:

```typescript
import { head, seoMeta, HeadManager } from '@doeixd/combi-router/features';
```

## Basic Usage

### Simple Head Data

```typescript
import { route, path, param, pipe } from '@doeixd/combi-router';
import { head } from '@doeixd/combi-router/features';
import { z } from 'zod';

// Static head data
const aboutRoute = pipe(
  route(path('about')),
  head({
    title: 'About Us',
    meta: [
      { name: 'description', content: 'Learn more about our company' },
      { name: 'keywords', content: 'about, company, team' }
    ],
    link: [
      { rel: 'canonical', href: 'https://example.com/about' }
    ]
  })
);
```

### Dynamic Head Data

```typescript
// Dynamic head data based on route parameters
const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  head(({ params }) => ({
    title: `User Profile - ${params.id}`,
    meta: [
      { name: 'description', content: `Profile page for user ${params.id}` },
      { property: 'og:title', content: `User ${params.id} Profile` }
    ]
  }))
);
```

## SEO Meta Utilities

The `seoMeta` object provides convenient helpers for common SEO patterns:

### Open Graph Tags

```typescript
const productRoute = pipe(
  route(path('products'), param('slug', z.string())),
  head(({ params }) => ({
    title: `Product: ${params.slug}`,
    ...seoMeta.og({
      title: `Amazing Product - ${params.slug}`,
      description: 'The best product you will ever buy',
      image: `https://example.com/products/${params.slug}/image.jpg`,
      url: `https://example.com/products/${params.slug}`,
      type: 'product'
    })
  }))
);
```

### Twitter Cards

```typescript
const articleRoute = pipe(
  route(path('articles'), param('slug', z.string())),
  head(({ params }) => ({
    title: `Article: ${params.slug}`,
    ...seoMeta.twitter({
      card: 'summary_large_image',
      title: `Great Article - ${params.slug}`,
      description: 'An insightful article about important topics',
      image: `https://example.com/articles/${params.slug}/cover.jpg`,
      creator: '@yourhandle'
    })
  }))
);
```

### Basic SEO

```typescript
const pageRoute = pipe(
  route(path('page'), param('slug', z.string())),
  head(({ params }) => ({
    ...seoMeta.basic({
      title: `Page: ${params.slug}`,
      description: 'A detailed page description',
      keywords: ['keyword1', 'keyword2', 'keyword3'],
      robots: 'index,follow',
      canonical: `https://example.com/page/${params.slug}`
    })
  }))
);
```

## Advanced Features

### Title Templates

```typescript
// Global title template
const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  head(({ params }) => ({
    title: `User ${params.id}`,
    titleTemplate: 'My App | %s' // Results in: "My App | User 123"
  }))
);

// Function-based title template
const customRoute = pipe(
  route(path('custom')),
  head({
    title: 'Custom Page',
    titleTemplate: (title) => `🚀 ${title} - Amazing App`
  })
);
```

### Scripts and Styles

```typescript
const analyticsRoute = pipe(
  route(path('dashboard')),
  head({
    title: 'Dashboard',
    script: [
      {
        src: 'https://analytics.example.com/script.js',
        async: true,
        defer: true
      },
      {
        innerHTML: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        `
      }
    ],
    style: [
      {
        innerHTML: `
          .dashboard-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
        `
      }
    ]
  })
);
```

### HTML and Body Attributes

```typescript
const darkModeRoute = pipe(
  route(path('settings')),
  head({
    title: 'Settings',
    htmlAttrs: {
      lang: 'en',
      'data-theme': 'dark'
    },
    bodyAttrs: {
      class: 'settings-page dark-mode'
    }
  })
);
```

## Web Components Integration

### Automatic Discovery (Recommended)

Place `view-head` components directly inside `view-template` elements for automatic discovery:

```html
<view-area match="/users/:id" view-id="user-profile"></view-area>

<template is="view-template" view-id="user-profile">
  <!-- Automatically discovered and linked to the view-area above -->
  <view-head 
    title="User Profile"
    description="View user details and information"
    og-type="profile">
  </view-head>
  
  <h1>User Profile</h1>
  <p>Content goes here...</p>
</template>
```

### Manual Linking

You can still use explicit `head-id` linking when needed:

```html
<view-area match="/users/:id" view-id="user-profile" head-id="user-head"></view-area>
<view-head head-id="user-head" title="User Profile"></view-head>
```

### Nested Templates

Head tags automatically merge hierarchically in nested routes:

```html
<!-- Parent template -->
<template is="view-template" view-id="dashboard">
  <view-head title="Dashboard" title-template="Admin | %s"></view-head>
  <h1>Dashboard</h1>
</template>

<!-- Child template -->
<template is="view-template" view-id="users">
  <view-head title="Users" description="User management"></view-head>
  <h2>Users</h2>
</template>

<!-- Result: "Admin | Users" with merged meta tags -->
```

## DOM Integration

### Client-Side Rendering

```typescript
import { HeadManager, resolveHeadData } from '@doeixd/combi-router/features';

// Create head manager
const headManager = new HeadManager(document);

// In your router's navigation handler
router.onNavigate((match) => {
  if (match.route._head) {
    const resolvedHead = resolveHeadData(match.route._head, match);
    headManager.apply(resolvedHead);
  }
});
```

### Server-Side Rendering

```typescript
import { HeadManager } from '@doeixd/combi-router/features';

// Generate SSR head tags
const match = await router.match('/users/123');
if (match?.route._head) {
  const resolvedHead = resolveHeadData(match.route._head, match);
  const { headTags, htmlAttrs, bodyAttrs } = HeadManager.generateSSR(resolvedHead);
  
  // Use in your HTML template
  const html = `
    <!DOCTYPE html>
    <html ${htmlAttrs}>
      <head>
        ${headTags}
      </head>
      <body ${bodyAttrs}>
        <div id="app">${appContent}</div>
      </body>
    </html>
  `;
}
```

## Nested Routes and Merging

When working with nested routes, head data from parent routes can be merged with child routes:

```typescript
import { mergeHeadData } from '@doeixd/combi-router/features';

// Parent route with base head data
const dashboardRoute = pipe(
  route(path('dashboard')),
  head({
    titleTemplate: 'Dashboard | %s',
    meta: [
      { name: 'section', content: 'dashboard' }
    ]
  })
);

// Child route with specific head data
const usersRoute = pipe(
  extend(dashboardRoute, path('users')),
  head({
    title: 'Users',
    meta: [
      { name: 'description', content: 'User management page' }
    ]
  })
);

// Merge head data from all active routes
const mergedHead = mergeHeadData(
  resolveHeadData(dashboardRoute._head, parentMatch),
  resolveHeadData(usersRoute._head, childMatch)
);
```

## Framework Integration Examples

### React Example

```typescript
import { useEffect } from 'react';
import { useRouter } from './router-context';
import { HeadManager, resolveHeadData } from '@doeixd/combi-router/features';

function HeadProvider({ children }) {
  const router = useRouter();
  const headManager = new HeadManager();

  useEffect(() => {
    const unsubscribe = router.onNavigate((match) => {
      if (match.route._head) {
        const resolvedHead = resolveHeadData(match.route._head, match);
        headManager.apply(resolvedHead);
      }
    });

    return unsubscribe;
  }, [router, headManager]);

  return <>{children}</>;
}
```

### Vue Example

```typescript
import { watch } from 'vue';
import { HeadManager, resolveHeadData } from '@doeixd/combi-router/features';

export function useHead(router) {
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
```

## TypeScript Support

The head module provides full TypeScript support with proper type inference:

```typescript
import type { HeadInput, HeadFunction } from '@doeixd/combi-router/features';

// Type-safe head function
const typedHeadFunction: HeadFunction<{ id: number }> = ({ params }) => ({
  title: `User ${params.id}`, // params.id is properly typed as number
  meta: [
    { name: 'description', content: `Profile for user ${params.id}` }
  ]
});

// The head enhancer automatically infers parameter types from the route
const userRoute = pipe(
  route(path('users'), param('id', z.number())),
  head(({ params }) => ({
    // params.id is automatically inferred as number
    title: `User ${params.id}`
  }))
);
```

## Performance Considerations

- Head data is resolved lazily when routes are navigated to
- The HeadManager efficiently manages DOM elements, cleaning up previous tags
- SSR generation is optimized for minimal string operations
- Function-based head data is only executed when needed

## Comparison with Basic `meta` Function

| Feature | `meta` Function | Head Module |
|---------|----------------|-------------|
| Basic meta tags | ✅ | ✅ |
| Dynamic content | ✅ | ✅ |
| Title management | ❌ | ✅ |
| Title templates | ❌ | ✅ |
| Script/style tags | ❌ | ✅ |
| HTML/body attributes | ❌ | ✅ |
| SEO utilities | ❌ | ✅ |
| SSR support | ❌ | ✅ |
| DOM management | ❌ | ✅ |
| Type safety | ✅ | ✅ |

The head module provides a more comprehensive solution for document head management while maintaining the same ease of use and type safety as the basic `meta` function.

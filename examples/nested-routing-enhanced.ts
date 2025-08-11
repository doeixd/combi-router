// =================================================================
//
//      Combi-Router: Enhanced Nested Routing Example
//
//      Demonstrates hierarchical routing with enhanced view support,
//      morphdom integration, and multiple templating systems
//
// =================================================================

import { createLayeredRouter, createCoreNavigationLayer } from '../src/core/layered-router';
import { route, extend, pipe } from '../src/core/route';
import { path, param, end } from '../src/core/matchers';
import { loader } from '../src/core/meta';
import { createEnhancedViewLayer } from '../src/layers/enhanced-view/enhanced-view';
import {
  enhancedView,
  htmlTemplate,
  lazyView,
  conditionalView,
  errorBoundaryView,
  composeViews,
  cachedView
} from '../src/layers/enhanced-view/enhanced-meta';
import { z } from 'zod';

// Example with lit-html (you'd import this from lit-html in a real app)
const html = (strings: TemplateStringsArray, ...values: any[]) => ({
  _$litType$: 1,
  strings,
  values
});

// =================================================================
// Mock Data & Services
// =================================================================

const mockDatabase = {
  users: [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' }
  ],
  posts: [
    { id: '1', userId: '1', title: 'Getting Started with Combi-Router', content: 'Learn the basics...' },
    { id: '2', userId: '1', title: 'Advanced Routing Patterns', content: 'Dive deeper into...' },
    { id: '3', userId: '2', title: 'My First Post', content: 'Hello world!' }
  ],
  settings: {
    theme: 'dark',
    notifications: true,
    language: 'en'
  }
};

const fetchUser = (id: string) =>
  Promise.resolve(mockDatabase.users.find(u => u.id === id));

const fetchPosts = (userId: string) =>
  Promise.resolve(mockDatabase.posts.filter(p => p.userId === userId));

const fetchSettings = () =>
  Promise.resolve(mockDatabase.settings);

// =================================================================
// Route Definitions - Hierarchical Structure
// =================================================================

// Root application route
const appRoute = pipe(
  route(path('')),
  enhancedView(() => html`
    <div class="app">
      <header class="app-header">
        <nav>
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/users">Users</a>
          <a href="/about">About</a>
        </nav>
      </header>
      <main class="app-content" router-outlet></main>
    </div>
  `)
);

// Home route (child of app)
const homeRoute = pipe(
  extend(appRoute, end),
  enhancedView(() => html`
    <div class="home">
      <h1>Welcome to Enhanced Combi-Router</h1>
      <p>This example demonstrates:</p>
      <ul>
        <li>Hierarchical nested routing</li>
        <li>HTML template support (lit-html style)</li>
        <li>Morphdom integration for efficient updates</li>
        <li>Multiple view composition patterns</li>
      </ul>
    </div>
  `)
);

// Dashboard route with nested structure
const dashboardRoute = pipe(
  extend(appRoute, path('dashboard')),
  loader(async () => ({
    stats: {
      users: mockDatabase.users.length,
      posts: mockDatabase.posts.length
    }
  })),
  enhancedView(({ match }) => html`
    <div class="dashboard">
      <aside class="dashboard-sidebar">
        <h2>Dashboard</h2>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/analytics">Analytics</a>
          <a href="/dashboard/settings">Settings</a>
        </nav>
      </aside>
      <div class="dashboard-content" router-outlet router-outlet-parent="${match.route.id}">
        <!-- Nested routes will render here -->
      </div>
    </div>
  `)
);

// Dashboard overview (nested under dashboard)
const dashboardOverviewRoute = pipe(
  extend(dashboardRoute, end),
  enhancedView(({ match }) => html`
    <div class="overview">
      <h3>Overview</h3>
      <div class="stats">
        <div class="stat-card">
          <h4>Total Users</h4>
          <p>${match.data.stats.users}</p>
        </div>
        <div class="stat-card">
          <h4>Total Posts</h4>
          <p>${match.data.stats.posts}</p>
        </div>
      </div>
    </div>
  `)
);

// Dashboard analytics (nested under dashboard)
const dashboardAnalyticsRoute = pipe(
  extend(dashboardRoute, path('analytics'), end),
  // Example using htmlTemplate helper
  enhancedView(() => htmlTemplate(`
    <div class="analytics">
      <h3>Analytics</h3>
      <canvas id="chart"></canvas>
    </div>
  `, {
    afterRender: (element) => {
      // Post-render DOM manipulation
      const canvas = element.querySelector('#chart') as HTMLCanvasElement;
      if (canvas) {
        // Initialize chart library here
        console.log('Chart canvas ready for initialization');
      }
    }
  }))
);

// Dashboard settings (nested under dashboard)
const dashboardSettingsRoute = pipe(
  extend(dashboardRoute, path('settings'), end),
  loader(fetchSettings),
  // Example using composed views
  composeViews({
    header: () => html`<h3>Settings</h3>`,
    themeSection: ({ match }) => html`
      <section>
        <h4>Theme</h4>
        <select value="${match.data.theme}">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
      </section>
    `,
    notificationSection: ({ match }) => html`
      <section>
        <h4>Notifications</h4>
        <label>
          <input type="checkbox" ${match.data.notifications ? 'checked' : ''}>
          Enable notifications
        </label>
      </section>
    `
  }, (parts) => html`
    <div class="settings">
      ${parts.header}
      ${parts.themeSection}
      ${parts.notificationSection}
    </div>
  `)
);

// Users route with list/detail pattern
const usersRoute = pipe(
  extend(appRoute, path('users')),
  loader(async () => ({ users: mockDatabase.users })),
  enhancedView(({ match }) => html`
    <div class="users-layout">
      <div class="users-list">
        <h2>Users</h2>
        <ul>
          ${match.data.users.map((user: any) => html`
            <li>
              <a href="/users/${user.id}">${user.name}</a>
            </li>
          `)}
        </ul>
      </div>
      <div class="user-detail" router-outlet router-outlet-parent="${match.route.id}">
        <p>Select a user to view details</p>
      </div>
    </div>
  `)
);

// User detail route (nested under users)
const userDetailRoute = pipe(
  extend(usersRoute, param('id', z.string()), end),
  loader(async ({ params }) => ({
    user: await fetchUser(params.id),
    posts: await fetchPosts(params.id)
  })),
  // Example with conditional rendering based on user role
  conditionalView(
    ({ match }) => match.data.user?.role === 'admin',
    // Admin view
    ({ match }) => html`
      <div class="user-detail admin">
        <h3>${match.data.user.name} (Admin)</h3>
        <p>Email: ${match.data.user.email}</p>
        <div class="admin-controls">
          <button>Edit User</button>
          <button>Delete User</button>
          <button>View Logs</button>
        </div>
        <h4>Posts (${match.data.posts.length})</h4>
        <ul>
          ${match.data.posts.map((post: any) => html`
            <li>${post.title}</li>
          `)}
        </ul>
      </div>
    `,
    // Regular user view
    ({ match }) => html`
      <div class="user-detail">
        <h3>${match.data.user?.name || 'User not found'}</h3>
        <p>Email: ${match.data.user?.email || 'N/A'}</p>
        <h4>Posts (${match.data.posts?.length || 0})</h4>
        <ul>
          ${match.data.posts?.map((post: any) => html`
            <li>${post.title}</li>
          `) || html`<li>No posts</li>`}
        </ul>
      </div>
    `
  )
);

// About route with lazy loading example
const aboutRoute = pipe(
  extend(appRoute, path('about'), end),
  lazyView(
    // Simulate lazy loading a heavy component
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return () => html`
        <div class="about">
          <h1>About Enhanced Combi-Router</h1>
          <p>This is a demonstration of the enhanced view layer with:</p>
          <ul>
            <li>Support for HTML template literals</li>
            <li>Morphdom integration for efficient DOM updates</li>
            <li>Hierarchical nested routing</li>
            <li>Lazy loading capabilities</li>
            <li>Error boundaries</li>
            <li>View composition</li>
          </ul>
        </div>
      `;
    },
    // Loading view shown while the component loads
    () => html`
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading about page...</p>
      </div>
    `
  )
);

// Error example route
const errorExampleRoute = pipe(
  extend(appRoute, path('error-example'), end),
  errorBoundaryView(
    () => {
      // This will throw an error
      throw new Error('Intentional error for demonstration');
    },
    (error) => html`
      <div class="error-boundary">
        <h2>Oops! Something went wrong</h2>
        <p class="error-message">${error.message}</p>
        <button onclick="window.location.href='/'">Go Home</button>
      </div>
    `
  )
);

// Cached view example
const cachedDataRoute = pipe(
  extend(appRoute, path('data'), param('id', z.string()), end),
  loader(async ({ params }) => {
    // Simulate expensive data fetching
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      timestamp: new Date().toISOString(),
      id: params.id,
      data: `Expensive data for ${params.id}`
    };
  }),
  cachedView(
    ({ match }) => html`
      <div class="cached-data">
        <h2>Cached Data View</h2>
        <p>ID: ${match.params.id}</p>
        <p>Data: ${match.data.data}</p>
        <p>Loaded at: ${match.data.timestamp}</p>
        <p class="note">This view is cached for 30 seconds</p>
      </div>
    `,
    ({ match }) => `data-${match.params.id}`,
    30000 // Cache for 30 seconds
  )
);

// =================================================================
// Router Configuration
// =================================================================

export function initializeApp() {
  // Create the router with all routes
  const router = createLayeredRouter([
    appRoute,
    homeRoute,
    dashboardRoute,
    dashboardOverviewRoute,
    dashboardAnalyticsRoute,
    dashboardSettingsRoute,
    usersRoute,
    userDetailRoute,
    aboutRoute,
    errorExampleRoute,
    cachedDataRoute
  ])
    (createCoreNavigationLayer())
    (createEnhancedViewLayer({
      root: '#app',
      useMorphdom: true,
      morphdomOptions: {
        onBeforeElUpdated: (fromEl, toEl) => {
          // Preserve focus state
          if (fromEl === document.activeElement) {
            return false;
          }
          // Preserve form input values
          if (fromEl.tagName === 'INPUT' && (fromEl as HTMLInputElement).value) {
            (toEl as HTMLInputElement).value = (fromEl as HTMLInputElement).value;
          }
          return true;
        }
      },
      enableOutlets: true,
      loadingView: () => html`
        <div class="global-loading">
          <div class="spinner"></div>
        </div>
      `,
      errorView: (error) => html`
        <div class="global-error">
          <h1>Navigation Error</h1>
          <p>${error.message}</p>
        </div>
      `,
      notFoundView: () => html`
        <div class="not-found">
          <h1>404</h1>
          <p>Page not found</p>
          <a href="/">Go home</a>
        </div>
      `,
      templateRenderer: (result, container) => {
        // Custom renderer for lit-html style templates
        if (result._$litType$) {
          // In a real app, you'd use lit-html's render function
          // This is a simplified version
          const template = result.strings.join('${...}');
          container.innerHTML = template;
        }
      }
    }))
    ();

  // Start the router
  router.start();

  return router;
}

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializeApp);
}

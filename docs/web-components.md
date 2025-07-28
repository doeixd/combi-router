# A Developer's Guide to Combi-Router Web Components

Combi-Router provides a powerful and declarative way to handle client-side routing directly in your HTML using a suite of custom Web Components. This approach allows you to build sophisticated Single-Page Applications (SPAs) with minimal JavaScript, often requiring zero manual setup.

This guide will walk you through everything from basic setup to advanced features like nested routing, data loading, and automatic SEO management.

### **Table of Contents**

1.  **The 60-Second Setup: Zero-Config Routing**
2.  **The Core Duo: `<view-area>` & `<view-template>`**
3.  **Making it Interactive: Navigation & Active Links**
4.  **Dynamic Content: Routes with Parameters & Data**
5.  **Automatic SEO: The `<view-head>` Component**
6.  **Building Layouts: Nested Routing & Outlets**
7.  **Real-World UX: Loading, Error & Fallback States**
8.  **Advanced Features: Data Loading & Route Guards**
9.  **Escaping the HTML: Programmatic Control**

---

### **1. The 60-Second Setup: Zero-Config Routing**

The easiest way to use the components is with the standalone bundle. It includes the router, the components, and all necessary setup.

1.  **Install the library:**
    ```bash
    npm install @doeixd/combi-router
    ```

2.  **Create an `index.html` file and add the magic script tag:**

    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>My App</title>
        <script type="module">
            // This single line imports and activates everything!
            import '@doeixd/combi-router/components-standalone';
        </script>
    </head>
    <body>
        <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
        </nav>

        <main>
            <!-- WHERE content will appear -->
            <view-area match="/" view-id="home-page"></view-area>
            <view-area match="/about" view-id="about-page"></view-area>
        </main>

        <!-- WHAT content to show -->
        <template is="view-template" view-id="home-page">
            <h1>Welcome Home!</h1>
        </template>
        <template is="view-template" view-id="about-page">
            <h1>About Us</h1>
        </template>
    </body>
    </html>
    ```

3.  **Serve it:** You must use a local web server (like `npx serve`) because this uses ES Modules.

You now have a working, multi-page SPA. The components automatically discovered each other, built the routing configuration, and are handling navigation.

> **Good to know:** The `components-standalone` import is a self-contained bundle. The `components` import is for when you are setting up the Combi-Router JavaScript API manually. For declarative use, always start with `standalone`.

### **2. The Core Duo: `<view-area>` & `<view-template>`**

*   **`<view-area>`:** A container in your DOM that becomes active when its `match` pattern corresponds to the browser's URL.
    *   `match`: The URL pattern it responds to (e.g., `/`, `/about`, `/users/:id`).
    *   `view-id`: A unique ID that links it to a `<view-template>`.

*   **`<view-template>`:** Defines the HTML content that will be rendered inside the active `<view-area>`.
    *   `is="view-template"`: The special attribute that identifies it.
    *   `view-id`: The ID that connects it to a `<view-area>`.

### **3. Making it Interactive: Navigation & Active Links**

#### **Automatic Navigation**
You don't need any special components for navigation. The router automatically intercepts clicks on standard `<a>` tags and handles the navigation without a full page reload.

#### **Styling Active Links**
A common requirement is to style the link for the currently active page. You can easily add this functionality with a small script that subscribes to the router's state.

```html
<nav>
    <a href="/">Home</a>
    <a href="/dashboard">Dashboard</a>
</nav>

<script type="module">
    // Wait for the router to be available on the window object
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { // Timeout ensures router has initialized
            const router = window.myAppRouter;
            if (!router) return;

            const navLinks = document.querySelectorAll('nav a');

            const updateActiveLinks = (match) => {
                if (!match) return; // No route is active
                navLinks.forEach(link => {
                    const linkPath = link.getAttribute('href');
                    // Use startsWith for nested routes (e.g., /dashboard/users)
                    if (match.pathname.startsWith(linkPath)) {
                        link.style.textDecoration = 'underline'; // Or add/remove an "active" class
                    } else {
                        link.style.textDecoration = 'none';
                    }
                });
            };

            // Subscribe to route changes and update the links
            router.subscribe(updateActiveLinks);
        }, 100);
    });
</script>
```

### **4. Dynamic Content: Routes with Parameters & Data**

To handle dynamic parameters, use the `:paramName` syntax. The router makes the matched parameters and any loaded data available to your template via a `match-changed` event.

```html
<view-area match="/products/:slug" view-id="product-details"></view-area>

<template is="view-template" view-id="product-details">
    <h1>Product Details</h1>
    <p>Viewing product: <strong class="product-slug"></strong></p>

    <script>
        // Best Practice: Listen for the 'match-changed' event on the template itself.
        // The router dispatches this event with the full match details when the view is rendered.
        const template = document.currentScript.parentElement;
        template.addEventListener('match-changed', (event) => {
            const { match } = event.detail; // The full RouteMatch object
            const slug = match.params.slug;
            template.querySelector('.product-slug').textContent = slug.toUpperCase();
        });
    </script>
</template>
```

### **5. Automatic SEO: The `<view-head>` Component**

The `<view-head>` component makes managing the document `<head>` for titles and meta tags declarative and automatic.

**The Best Practice: Automatic Discovery**

Place the `<view-head>` component **directly inside** its corresponding `<view-template>`. It will automatically find its parent and apply the SEO tags when the route is active. **No `head-id` is needed.**

```html
<template is="view-template" view-id="about-page">
    <!-- This head is AUTOMATICALLY linked to the "about-page" view -->
    <view-head
        title="About Us"
        title-template="My Site | %s"
        description="Learn about our company and our mission."
        og-title="About Our Company"
        canonical="https://example.com/about">
    </view-head>

    <h1>About Us</h1>
</template>
```

For advanced use cases like dynamic content from an external module, see the [main README documentation](https://github.com/doeixd/combi-router#document-head-management).

### **6. Building Layouts: Nested Routing & Outlets**

Combi-Router's components naturally support nested layouts.

1.  **Define Parent and Child Routes:** Create `<view-area>`s for each level of nesting.
2.  **Create an "Outlet":** The parent's `<view-template>` must contain the child's `<view-area>`.

```html
<!-- ROUTE DEFINITIONS (can be anywhere in the body) -->
<view-area match="/dashboard" view-id="dashboard-layout"></view-area>

<!-- TEMPLATES -->
<template is="view-template" view-id="dashboard-layout">
    <div class="dashboard">
        <nav class="sidebar">
            <a href="/dashboard/users">Users</a>
            <a href="/dashboard/settings">Settings</a>
        </nav>
        <main class="outlet">
            <!--
              THIS IS THE OUTLET:
              The child view-areas are placed inside the parent template.
              The router will activate the correct one here.
            -->
            <view-area match="/dashboard/users" view-id="dashboard-users"></view-area>
            <view-area match="/dashboard/settings" view-id="dashboard-settings"></view-area>
        </main>
    </div>
</template>

<template is="view-template" view-id="dashboard-users">
    <h2>User Management</h2>
</template>
<template is="view-template" view-id="dashboard-settings">
    <h2>Application Settings</h2>
</template>
```

When you navigate to `/dashboard/users`, the "User Management" content will be rendered inside the `<main class="outlet">`.

### **7. Real-World UX: Loading, Error & Fallback States**

The library includes components to declaratively handle asynchronous states. The key is the smart `<view-fallback>` component.

| Context | Parent Component | `<view-fallback>` Behavior |
| :--- | :--- | :--- |
| **Loading** | `<view-suspense>` | Shows its content while data is being fetched for a `<view-area>`. |
| **Error** | `<view-error-boundary>` | Shows its content if an error occurs during rendering or data fetching. |
| **Route** | (Top-level) | Acts as a 404 "Not Found" page when `match-pattern="*"` is used. |

```html
<main>
    <view-error-boundary>
        <!-- This boundary catches errors from the dashboard view -->
        <view-suspense view-id="dashboard" delay="200">
            <!-- This shows a loading UI for the dashboard after a 200ms delay -->
            <view-area match="/dashboard" view-id="dashboard"></view-area>

            <!-- Fallback for the SUSPENSE context -->
            <view-fallback>
                <div class="spinner">Loading Dashboard...</div>
            </view-fallback>
        </view-suspense>

        <!-- Fallback for the ERROR context -->
        <view-fallback>
            <div class="error-panel">Could not load the dashboard.</div>
        </view-fallback>
    </view-error-boundary>

    <!-- Fallback for the ROUTE context (404 page) -->
    <view-fallback match-pattern="*">
        <h1>404 - Page Not Found</h1>
    </view-fallback>
</main>
```

### **8. Advanced Features: Data Loading & Route Guards**

You can associate external JavaScript modules with your components to handle data fetching and route protection.

*   **`<view-loader>`:** Fetches data *before* a route is rendered. It must be linked to a `<view-template>` via a `loader-id`. The module must export a `load` function.
*   **`<view-guard>`:** Protects a route. It must be linked to a `<view-area>` via a `guard-id`. The module must export a `canActivate` function.

**`loaders.js`**
```javascript
export async function load(match) {
  const response = await fetch(`/api/users/${match.params.id}`);
  const user = await response.json();
  return { user }; // Data is passed to the template via the `match-changed` event
}
```

**`guards.js`**
```javascript
export async function canActivate(match) {
  const isLoggedIn = await checkAuthStatus();
  return isLoggedIn ? true : '/login'; // true = allow, string = redirect
}
```

**`index.html`**
```html
<!-- Define the modules -->
<view-loader loader-id="user-data-loader" src="./loaders.js"></view-loader>
<view-guard guard-id="auth-required" src="./guards.js"></view-guard>

<!-- Apply them to the components -->
<view-area match="/profile/:id" view-id="profile" guard-id="auth-required"></view-area>
<template is="view-template" view-id="profile" loader-id="user-data-loader">
    <script>
        // The data from the loader is available in the match object
        document.currentScript.parentElement.addEventListener('match-changed', ({ detail }) => {
            const userName = detail.match.data.user.name;
            // ...
        });
    </script>
</template>
```

### **9. Escaping the HTML: Programmatic Control**

While the declarative approach is powerful, you can always access the underlying router instance for programmatic navigation or to inspect its state. The standalone components expose the router instance on `window.myAppRouter`.

```javascript
const router = window.myAppRouter;

// Programmatically navigate
const dashboardRoute = router.routes.find(r => r.name === 'dashboard-layout');
if (dashboardRoute) {
    router.navigate(dashboardRoute, {});
}

// Add a new route at runtime
import { route, path } from '@doeixd/combi-router';
const dynamicRoute = route(path('dynamic'));
router.addRoute(dynamicRoute);
```

This blend of declarative simplicity and programmatic power makes Combi-Router's Web Components a versatile choice for any project.

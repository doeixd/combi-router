# A Developer's Guide to Combi-Router Web Components

Combi-Router provides a powerful and declarative way to handle client-side routing directly in your HTML using a suite of custom Web Components. This approach allows you to build sophisticated Single-Page Applications (SPAs) with minimal JavaScript, often requiring zero manual setup.

This guide will walk you through everything from basic setup to advanced features like nested routing, data loading, and automatic SEO management.

### **Table of Contents**

1.  **Why Web Components?**
2.  **Getting Started: Zero-Config Routing**
3.  **Core Components: The Building Blocks**
    *   `<view-area>`: Where content appears.
    *   `<view-template>`: What content to show.
4.  **Navigation: How Links Just Work**
5.  **Dynamic Routes with Parameters**
6.  **Automatic SEO with `<view-head>`**
    *   Basic Head Management
    *   Automatic Discovery vs. Manual Linking
    *   Dynamic Head Content from a Module
7.  **Hierarchical (Nested) Routing**
    *   Structure
    *   Nested Head Merging
8.  **Handling Loading and Error States**
    *   `<view-suspense>`: For loading states.
    *   `<view-error-boundary>`: For catching errors.
    *   `<view-fallback>`: The smart component for both.
9.  **Advanced: Data Loading & Route Guards**
    *   `<view-loader>`: Fetching data for a route.
    *   `<view-guard>`: Protecting a route.
10. **Full Example: Putting It All Together**

---

### **1. Why Web Components?**

Using Web Components for routing provides several key advantages:

*   **Declarative:** Define your application's entire routing structure directly in your HTML.
*   **Framework-Agnostic:** They work in any HTML page, whether you're using a framework like Vue or React, or just vanilla JavaScript.
*   **Encapsulated:** The logic is contained within the components, keeping your application code clean.
*   **Zero-Config:** For most use cases, you can simply import the library and start writing HTML. The components discover each other and configure the router automatically.

### **2. Getting Started: Zero-Config Routing**

The easiest way to use the components is with the standalone bundle. It includes everything you need.

1.  **Install the library:**
    ```bash
    npm install @doeixd/combi-router
    ```

2.  **Create an `index.html` file and import the standalone components in a module script:**

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
        <!-- Your app components will go here -->
    </body>
    </html>
    ```

That's it! The router is now active and listening for your component definitions.

### **3. Core Components: The Building Blocks**

Routing is handled by two primary components that work together.

#### **`<view-area>`: Where Content Appears**

The `<view-area>` is a container in your DOM that becomes active when its `match` pattern corresponds to the browser's URL.

*   `match`: The URL pattern this area responds to.
*   `view-id`: A unique ID that links this area to a specific `<view-template>`.

```html
<body>
    <!-- This area will be active for the URL "/" -->
    <view-area match="/" view-id="home-page"></view-area>

    <!-- This area will be active for the URL "/about" -->
    <view-area match="/about" view-id="about-page"></view-area>
</body>
```

#### **`<view-template>`: What Content to Show**

The `<view-template>` defines the HTML content that should be rendered inside a `<view-area>` when it becomes active. It uses the standard HTML `<template>` tag with a special `is="view-template"` attribute.

*   `is="view-template"`: Identifies this as a routing template.
*   `view-id`: The ID that connects it to a `<view-area>`.

```html
<!-- The content for the "home-page" view area -->
<template is="view-template" view-id="home-page">
    <h1>Welcome Home</h1>
    <p>This is the main page of our application.</p>
</template>

<!-- The content for the "about-page" view area -->
<template is="view-template" view-id="about-page">
    <h1>About Us</h1>
    <p>Learn more about our mission.</p>
</template>
```

When you navigate to `/about`, the router will find the `<view-area>` with `match="/about"`, look up its `view-id` ("about-page"), and render the content from the corresponding `<view-template>`.

### **4. Navigation: How Links Just Work**

You don't need any special components for navigation. The router automatically intercepts clicks on standard `<a>` tags.

As long as the `href` points to a URL within your application, the router will handle the navigation without a full page reload.

```html
<nav>
    <a href="/">Home</a>
    <a href="/about">About Us</a>
    <a href="/contact">Contact</a> <!-- This will lead to a 404 if not defined -->
</nav>
```

### **5. Dynamic Routes with Parameters**

To create dynamic routes (e.g., for user profiles or product pages), use the `:paramName` syntax in the `match` attribute.

The components automatically parse these parameters and make them available to your templates.

```html
<!-- Define a dynamic route for products -->
<view-area match="/products/:slug" view-id="product-details"></view-area>

<template is="view-template" view-id="product-details">
    <h1>Product Details</h1>
    <p>Viewing product: <strong id="product-slug"></strong></p>

    <!-- A simple script inside the template can access the URL -->
    <script>
        // The router uses the standard URL API.
        const pathParts = window.location.pathname.split('/');
        const slug = pathParts[pathParts.length - 1];
        document.getElementById('product-slug').textContent = slug;
    </script>
</template>

<nav>
    <a href="/products/laptop">Laptop</a>
    <a href="/products/keyboard">Keyboard</a>
</nav>
```

### **6. Automatic SEO with `<view-head>`**

Managing the document `<head>` (for titles, meta descriptions, etc.) is crucial for SEO. The `<view-head>` component makes this declarative and automatic.

#### **Basic Head Management**

You can define all common head tags as attributes on the `<view-head>` component.

*   `title`: The page title.
*   `title-template`: A template for the title, where `%s` is replaced by the `title` attribute (e.g., `My App | %s`).
*   `description`: The content for `<meta name="description">`.
*   `og-title`, `og-description`, `twitter-card`, etc.: For social media meta tags.

#### **Automatic Discovery (Recommended)**

The easiest way to use `<view-head>` is to place it **directly inside** its corresponding `<view-template>`. The component will automatically discover its parent and link itself.

```html
<template is="view-template" view-id="about-page">
    <!-- This head is automatically linked to the "about-page" view -->
    <view-head
        title="About Us"
        title-template="My Site | %s"
        description="Learn about our company and our mission to build great software."
        og-title="About Our Company"
        canonical="https://example.com/about">
    </view-head>

    <h1>About Us</h1>
    <p>This page's title and meta tags were set automatically!</p>
</template>
```
**No `head-id` is needed!** This is the cleanest and most maintainable approach.

#### **Manual Linking**

If you need to define your head configuration separately, you can use a `head-id` to manually link a `<view-area>` to a `<view-head>`.

```html
<!-- The view area specifies which head config to use -->
<view-area match="/contact" view-id="contact-page" head-id="contact-seo"></view-area>

<!-- The head config is defined elsewhere with the matching ID -->
<view-head head-id="contact-seo" title="Contact Us"></view-head>
```

#### **Dynamic Head Content from a Module**

For complex, dynamic head tags (e.g., a user's profile picture for an OG image), you can point `<view-head>` to an external JavaScript module using the `src` attribute.

The module should export a default function that receives the `match` object and returns a head configuration object.

**`user-head.js`:**
```javascript
export default function(match) {
  const userId = match.params.id;
  return {
    title: `Profile for User ${userId}`,
    description: `View the activity and details for user ${userId}.`,
    ogImage: `https://example.com/api/users/${userId}/avatar.jpg`
  };
}
```

**`index.html`:**
```html
<view-area match="/users/:id" view-id="user-profile" head-id="user-head-config"></view-area>

<!-- This component will load and execute the JS module when its route is active -->
<view-head head-id="user-head-config" src="./user-head.js"></view-head>
```

### **7. Hierarchical (Nested) Routing**

Combi-Router's components naturally support nested layouts. You simply define `<view-area>` components for both the parent and the child.

#### **Structure**

```html
<!-- Parent Route -->
<view-area match="/dashboard" view-id="dashboard-layout"></view-area>

<!-- Child Route -->
<view-area match="/dashboard/users" view-id="dashboard-users"></view-area>

<!-- Parent Template (contains the outlet for the child) -->
<template is="view-template" view-id="dashboard-layout">
    <div class="dashboard">
        <nav class="sidebar">
            <a href="/dashboard/users">Users</a>
            <a href="/dashboard/settings">Settings</a>
        </nav>
        <main>
            <!--
              When a child route like "/dashboard/users" is active,
              its view will be rendered here, inside the parent's layout.
            -->
        </main>
    </div>
</template>

<!-- Child Template -->
<template is="view-template" view-id="dashboard-users">
    <h2>User Management</h2>
    <!-- User list content... -->
</template>
```When you navigate to `/dashboard/users`, the router will render the `dashboard-users` template *inside* the `main` tag of the `dashboard-layout` template.

#### **Nested Head Merging**

When using nested routes with automatic head discovery, the head tags from parent and child templates are automatically merged.

*   The **most specific** (deepest) `title` wins.
*   The **parent's** `title-template` is applied.
*   All `meta` and `link` tags are combined.

**Example:**
*   **`/dashboard`** `view-head` has `title="Dashboard"` and `title-template="Admin | %s"`.
*   **`/dashboard/users`** `view-head` has `title="Users"`.

When you navigate to `/dashboard/users`, the final document title will be: **`Admin | Users`**.

### **8. Handling Loading and Error States**

The library includes components to declaratively handle asynchronous operations like data loading.

*   **`<view-suspense>`**: A wrapper that shows a fallback UI while its associated `<view-area>` is loading data.
*   **`<view-error-boundary>`**: A wrapper that catches errors from its child `<view-area>` and displays a fallback error UI.
*   **`<view-fallback>`**: A smart component that automatically provides the UI for its parent (`<view-suspense>`, `<view-error-boundary>`, or a 404 page).

```html
<view-error-boundary>
    <!-- This boundary will catch errors from the user-profile view -->
    <view-suspense view-id="user-profile" delay="200">
        <!-- This shows a loading UI for the user-profile view after a 200ms delay -->
        <view-area match="/users/:id" view-id="user-profile"></view-area>

        <!-- This content is automatically shown by the suspense component during loading -->
        <view-fallback>
            <div class="spinner">Loading user details...</div>
        </view-fallback>
    </view-suspense>

    <!-- This content is automatically shown by the error boundary if something goes wrong -->
    <view-fallback>
        <div class="error-panel">
            <h3>Could not load user profile.</h3>
            <button onclick="location.reload()">Try Again</button>
        </div>
    </view-fallback>
</view-error-boundary>

<!-- A top-level fallback with match-pattern="*" acts as a 404 page -->
<view-fallback match-pattern="*">
    <h1>404 - Page Not Found</h1>
</view-fallback>
```

### **9. Advanced: Data Loading & Route Guards**

You can associate external data loading and route protection logic with your components.

#### **`<view-loader>`: Fetching data for a route**

A loader fetches data before a route is rendered. The data is then made available to the template.

**`user-loader.js`:**
```javascript
// The module must export a `load` function.
export async function load(match) {
  const response = await fetch(`/api/users/${match.params.id}`);
  const user = await response.json();
  return { user }; // This object will be available as `match.data`
}
```

**`index.html`:**
```html
<!-- Define the loader -->
<view-loader loader-id="user-data-loader" src="./user-loader.js"></view-loader>

<!-- Associate the loader with the template -->
<template is="view-template" view-id="user-profile" loader-id="user-data-loader">
    <h1>Welcome, <span id="user-name"></span></h1>
    <script>
        // The component dispatches a 'match-changed' event with the full match object
        document.addEventListener('match-changed', (event) => {
            const { match } = event.detail;
            if (match.data && match.data.user) {
                document.getElementById('user-name').textContent = match.data.user.name;
            }
        }, { once: true });
    </script>
</template>
```

#### **`<view-guard>`: Protecting a route**

A guard is a function that runs before a route is activated. It can allow, deny, or redirect the navigation.

**`auth-guard.js`:**
```javascript
import { isAuthenticated } from './auth.js';

// The module must export a `canActivate` function.
export async function canActivate(match) {
  if (await isAuthenticated()) {
    return true; // Allow navigation
  } else {
    // Redirect to the login page
    return '/login?redirect=' + encodeURIComponent(window.location.pathname);
  }
}
```

**`index.html`:**
```html
<!-- Define the guard -->
<view-guard guard-id="auth-required" src="./auth-guard.js"></view-guard>

<!-- Apply the guard to the view area -->
<view-area match="/dashboard" view-id="dashboard" guard-id="auth-required"></view-area>```

### **10. Full Example: Putting It All Together**

Here is a more complete example showing many of these features working together.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>My App</title>
    <script type="module" src="@doeixd/combi-router/components-standalone"></script>
</head>
<body>
    <nav>
        <a href="/">Home</a>
        <a href="/dashboard">Dashboard (Protected)</a>
    </nav>

    <!-- Define the guard and loader modules -->
    <view-guard guard-id="auth" src="./guards.js"></view-guard>
    <view-loader loader-id="user-loader" src="./loaders.js"></view-loader>

    <!-- Main Content -->
    <main>
        <view-area match="/" view-id="home"></view-area>

        <view-error-boundary>
            <view-suspense view-id="dashboard" delay="300">
                <view-area match="/dashboard" view-id="dashboard" guard-id="auth"></view-area>

                <view-fallback>Loading Dashboard...</view-fallback>
            </view-suspense>
            <view-fallback>Error loading dashboard.</view-fallback>
        </view-error-boundary>

        <view-fallback match-pattern="*">404 Not Found</view-fallback>
    </main>

    <!-- Templates -->
    <template is="view-template" view-id="home">
        <view-head title="Home Page"></view-head>
        <h1>Welcome!</h1>
    </template>

    <template is="view-template" view-id="dashboard" loader-id="user-loader">
        <view-head title="Dashboard"></view-head>
        <h1>Dashboard</h1>
        <p>Welcome, <span id="username"></span>!</p>
        <script>
            document.addEventListener('match-changed', ({ detail }) => {
                document.getElementById('username').textContent = detail.match.data.user.name;
            }, { once: true });
        </script>
    </template>
</body>
</html>
```

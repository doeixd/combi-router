# Standalone Components

The @doeixd/combi-router library now provides standalone Web Components that can be imported and used independently from the main router library.

## Usage

### Option 1: Import with main router (bundled)
```javascript
import '@doeixd/combi-router/components';
```
This imports the components module that depends on the main router being available.

### Option 2: Import standalone (includes router)
```javascript
import '@doeixd/combi-router/components-standalone';
```
This imports a fully self-contained version that includes all router functionality.

## Benefits of Standalone Components

- **Zero configuration**: Just import and use
- **No external dependencies**: All router functionality is bundled
- **Perfect for simple apps**: Great for when you just want Web Components without setting up a router manually
- **Backward compatible**: Works the same as the regular components

## Example HTML

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import '@doeixd/combi-router/components-standalone';
    </script>
</head>
<body>
    <!-- Define your routes -->
    <view-area match="/users/:id" view-id="user-detail"></view-area>
    <view-area match="/about" view-id="about-page"></view-area>

    <!-- Define your templates -->
    <template is="view-template" view-id="user-detail">
        <h1>User Details</h1>
        <p>User ID: <span id="user-id"></span></p>
    </template>

    <template is="view-template" view-id="about-page">
        <h1>About</h1>
        <p>This is the about page.</p>
    </template>

    <!-- Navigation -->
    <nav>
        <a href="/users/123">User 123</a>
        <a href="/about">About</a>
    </nav>
</body>
</html>
```

## Dynamic Route Management

The standalone components automatically support dynamic route management:

```javascript
// Access the router instance
const router = window.myAppRouter;

// Add routes programmatically
router.addRoute(route(path('dynamic'), path('route')));

// Remove routes programmatically  
router.removeRoute(someRoute);
```

## Browser Back/Forward Cache Support

The standalone components automatically handle browser bfcache (back-forward cache) restoration, ensuring your app works correctly when users navigate using browser back/forward buttons.

## Quick Usage Summary

```javascript
// Import the standalone components (includes everything)
import '@doeixd/combi-router/components-standalone';

// Or import regular components (requires router setup)
import '@doeixd/combi-router/components';
```

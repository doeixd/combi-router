/**
 * Example external head configuration for user detail page
 * This module exports a dynamic head configuration function
 * that will be called with the current route match.
 */

// Export as default for dynamic loading
export default function(match) {
  const { params } = match;
  const userId = params.id;
  
  return {
    title: `User ${userId} Profile`,
    titleTemplate: 'MyApp | %s',
    
    meta: [
      {
        name: 'description',
        content: `Profile page for user ${userId} with detailed information and activity`
      },
      {
        name: 'keywords',
        content: `user, profile, ${userId}, account, dashboard`
      },
      {
        property: 'og:title',
        content: `User ${userId} - Profile`
      },
      {
        property: 'og:description',
        content: `View the complete profile and activity for user ${userId}`
      },
      {
        property: 'og:type',
        content: 'profile'
      },
      {
        property: 'og:url',
        content: `https://myapp.com/dashboard/users/${userId}`
      },
      {
        property: 'og:image',
        content: `https://myapp.com/api/users/${userId}/avatar?size=1200x630`
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image'
      },
      {
        name: 'twitter:title',
        content: `User ${userId} Profile`
      },
      {
        name: 'twitter:description',
        content: `Check out user ${userId}'s profile and latest activity`
      },
      {
        name: 'twitter:image',
        content: `https://myapp.com/api/users/${userId}/avatar?size=1200x630`
      }
    ],
    
    link: [
      {
        rel: 'canonical',
        href: `https://myapp.com/dashboard/users/${userId}`
      }
    ],
    
    // Add structured data for rich results
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          "url": `https://myapp.com/dashboard/users/${userId}`,
          "name": `User ${userId}`,
          "description": `Profile page for user ${userId}`
        })
      }
    ]
  };
}

// Alternative export formats that are also supported:
// export const head = function(match) { ... };
// module.exports = function(match) { ... };
// module.exports.default = function(match) { ... };

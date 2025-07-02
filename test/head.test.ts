import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { 
  head, 
  seoMeta, 
  HeadManager, 
  resolveHeadData, 
  mergeHeadData 
} from '../src/features/head.js';
import { route, path, param } from '../src/core/index.js';
import { z } from 'zod';

describe('Head Management', () => {
  let dom: JSDOM;
  let document: Document;
  let headManager: HeadManager;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
    document = dom.window.document;
    headManager = new HeadManager(document);
  });

  describe('head enhancer', () => {
    it('should add head data to route', () => {
      const testRoute = route(path('test'));
      const enhancedRoute = head({
        title: 'Test Page',
        meta: [{ name: 'description', content: 'Test description' }]
      })(testRoute);

      expect(enhancedRoute._head).toBeDefined();
      expect(enhancedRoute._head).toEqual({
        title: 'Test Page',
        meta: [{ name: 'description', content: 'Test description' }]
      });
    });

    it('should work with function-based head data', () => {
      const testRoute = route(path('users'), param('id', z.number()));
      const enhancedRoute = head(({ params }) => ({
        title: `User ${params.id}`,
        meta: [{ name: 'description', content: `Profile for user ${params.id}` }]
      }))(testRoute);

      expect(enhancedRoute._head).toBeDefined();
      expect(typeof enhancedRoute._head).toBe('function');
    });
  });

  describe('seoMeta utilities', () => {
    it('should generate Open Graph meta tags', () => {
      const ogData = seoMeta.og({
        title: 'Test Title',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com/test'
      });

      expect(ogData.meta).toHaveLength(5);
      expect(ogData.meta).toEqual([
        { property: 'og:title', content: 'Test Title', key: 'og:title' },
        { property: 'og:description', content: 'Test description', key: 'og:description' },
        { property: 'og:image', content: 'https://example.com/image.jpg', key: 'og:image' },
        { property: 'og:url', content: 'https://example.com/test', key: 'og:url' },
        { property: 'og:type', content: 'website', key: 'og:type' }
      ]);
    });

    it('should generate Twitter Card meta tags', () => {
      const twitterData = seoMeta.twitter({
        title: 'Test Title',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        creator: '@testuser'
      });

      expect(twitterData.meta).toHaveLength(5);
      expect(twitterData.meta).toContainEqual(
        { name: 'twitter:card', content: 'summary_large_image', key: 'twitter:card' }
      );
      expect(twitterData.meta).toContainEqual(
        { name: 'twitter:creator', content: '@testuser', key: 'twitter:creator' }
      );
    });

    it('should generate basic SEO meta tags', () => {
      const basicData = seoMeta.basic({
        title: 'Test Title',
        description: 'Test description',
        keywords: ['test', 'keywords'],
        robots: 'index,follow',
        canonical: 'https://example.com/test'
      });

      expect(basicData.title).toBe('Test Title');
      expect(basicData.meta).toContainEqual(
        { name: 'description', content: 'Test description', key: 'description' }
      );
      expect(basicData.meta).toContainEqual(
        { name: 'keywords', content: 'test, keywords', key: 'keywords' }
      );
      expect(basicData.link).toContainEqual(
        { rel: 'canonical', href: 'https://example.com/test', key: 'canonical' }
      );
    });
  });

  describe('resolveHeadData', () => {
    it('should resolve static head data', () => {
      const headData = {
        title: 'Test Page',
        meta: [{ name: 'description', content: 'Test description' }],
        link: [{ rel: 'canonical', href: 'https://example.com' }]
      };

      const mockContext = {
        params: {},
        searchParams: new URLSearchParams(),
        url: 'https://example.com',
        pathname: '/test'
      } as any;

      const resolved = resolveHeadData(headData, mockContext);

      expect(resolved.title).toBe('Test Page');
      expect(resolved.meta).toEqual([{ name: 'description', content: 'Test description' }]);
      expect(resolved.link).toEqual([{ rel: 'canonical', href: 'https://example.com' }]);
    });

    it('should resolve function-based head data', () => {
      const headFunction = ({ params }: { params: { id: number } }) => ({
        title: `User ${params.id}`,
        meta: [{ name: 'description', content: `Profile for user ${params.id}` }]
      });

      const mockContext = {
        params: { id: 123 },
        searchParams: new URLSearchParams(),
        url: 'https://example.com/users/123',
        pathname: '/users/123'
      } as any;

      const resolved = resolveHeadData(headFunction, mockContext);

      expect(resolved.title).toBe('User 123');
      expect(resolved.meta).toEqual([
        { name: 'description', content: 'Profile for user 123' }
      ]);
    });

    it('should apply title templates', () => {
      const headData = {
        title: 'Test Page',
        titleTemplate: 'My Site | %s'
      };

      const mockContext = {
        params: {},
        searchParams: new URLSearchParams(),
        url: 'https://example.com',
        pathname: '/test'
      } as any;

      const resolved = resolveHeadData(headData, mockContext);

      expect(resolved.title).toBe('My Site | Test Page');
    });

    it('should handle function-based title templates', () => {
      const headData = {
        title: 'Test Page',
        titleTemplate: (title: string) => `${title} - Custom Site`
      };

      const mockContext = {
        params: {},
        searchParams: new URLSearchParams(),
        url: 'https://example.com',
        pathname: '/test'
      } as any;

      const resolved = resolveHeadData(headData, mockContext);

      expect(resolved.title).toBe('Test Page - Custom Site');
    });
  });

  describe('HeadManager', () => {
    it('should apply head data to DOM', () => {
      const headData = {
        title: 'Test Page',
        meta: [
          { name: 'description', content: 'Test description' },
          { name: 'keywords', content: 'test, page' }
        ],
        link: [{ rel: 'canonical', href: 'https://example.com' }],
        htmlAttrs: { lang: 'en' },
        bodyAttrs: { class: 'test-page' }
      } as any;

      headManager.apply(headData);

      // Check title
      const titleElement = document.querySelector('title');
      expect(titleElement?.textContent).toBe('Test Page');

      // Check meta tags
      const metaTags = document.querySelectorAll('meta');
      expect(metaTags).toHaveLength(2);
      
      const descriptionMeta = document.querySelector('meta[name="description"]');
      expect(descriptionMeta?.getAttribute('content')).toBe('Test description');

      // Check link tags
      const linkTags = document.querySelectorAll('link');
      expect(linkTags).toHaveLength(1);
      
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      expect(canonicalLink?.getAttribute('href')).toBe('https://example.com');

      // Check HTML attributes
      expect(document.documentElement.getAttribute('lang')).toBe('en');

      // Check body attributes
      expect(document.body.getAttribute('class')).toBe('test-page');
    });

    it('should clean up previous elements on subsequent applies', () => {
      const headData1 = {
        title: 'Page 1',
        meta: [{ name: 'description', content: 'First page' }]
      } as any;

      const headData2 = {
        title: 'Page 2',
        meta: [{ name: 'description', content: 'Second page' }]
      } as any;

      headManager.apply(headData1);
      expect(document.querySelectorAll('meta')).toHaveLength(1);

      headManager.apply(headData2);
      expect(document.querySelectorAll('meta')).toHaveLength(1);
      
      const descriptionMeta = document.querySelector('meta[name="description"]');
      expect(descriptionMeta?.getAttribute('content')).toBe('Second page');
    });
  });

  describe('HeadManager.generateSSR', () => {
    it('should generate SSR strings', () => {
      const headData = {
        title: 'Test Page',
        meta: [{ name: 'description', content: 'Test description' }],
        link: [{ rel: 'canonical', href: 'https://example.com' }],
        script: [{ src: 'https://example.com/script.js', async: true }],
        htmlAttrs: { lang: 'en' },
        bodyAttrs: { class: 'test-page' }
      } as any;

      const ssr = HeadManager.generateSSR(headData);

      expect(ssr.headTags).toContain('<title>Test Page</title>');
      expect(ssr.headTags).toContain('<meta name="description" content="Test description">');
      expect(ssr.headTags).toContain('<link rel="canonical" href="https://example.com">');
      expect(ssr.headTags).toContain('<script src="https://example.com/script.js" async="true"></script>');
      expect(ssr.htmlAttrs).toBe('lang="en"');
      expect(ssr.bodyAttrs).toBe('class="test-page"');
    });
  });

  describe('mergeHeadData', () => {
    it('should merge multiple head data objects', () => {
      const headData1 = {
        title: 'Base Title',
        meta: [{ name: 'author', content: 'John Doe' }],
        htmlAttrs: { lang: 'en' }
      } as any;

      const headData2 = {
        title: 'Specific Title',
        meta: [{ name: 'description', content: 'Page description' }],
        htmlAttrs: { class: 'special' }
      } as any;

      const merged = mergeHeadData(headData1, headData2);

      expect(merged.title).toBe('Specific Title'); // Last one wins
      expect(merged.meta).toHaveLength(2); // Arrays are merged
      expect(merged.htmlAttrs).toEqual({ lang: 'en', class: 'special' }); // Objects are merged
    });

    it('should handle undefined inputs', () => {
      const headData = {
        title: 'Test Title',
        meta: [{ name: 'description', content: 'Test' }]
      } as any;

      const merged = mergeHeadData(undefined, headData, undefined);

      expect(merged.title).toBe('Test Title');
      expect(merged.meta).toHaveLength(1);
    });
  });
});

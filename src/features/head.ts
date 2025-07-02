import type { Route, InferParams, RouteMatch } from '../core/index.js';

// Head tag types inspired by Unhead
export interface HeadTag {
  tag?: string;
  props?: Record<string, any>;
  children?: string | HeadTag[];
  innerHTML?: string;
  textContent?: string;
  key?: string;
}

export interface TitleTemplate {
  title?: string | ((params: any) => string);
  titleTemplate?: string | ((title: string) => string);
}

export interface MetaTag {
  name?: string;
  property?: string;
  content?: string | ((params: any) => string);
  key?: string;
}

export interface LinkTag {
  rel?: string;
  href?: string | ((params: any) => string);
  type?: string;
  key?: string;
  [key: string]: any;
}

export interface ScriptTag {
  src?: string | ((params: any) => string);
  type?: string;
  async?: boolean;
  defer?: boolean;
  innerHTML?: string;
  key?: string;
  [key: string]: any;
}

export interface StyleTag {
  innerHTML?: string;
  key?: string;
}

export interface HeadInput {
  title?: string | TitleTemplate | ((params: any) => string | TitleTemplate);
  titleTemplate?: string | ((title: string) => string);
  meta?: MetaTag[] | ((params: any) => MetaTag[]);
  link?: LinkTag[] | ((params: any) => LinkTag[]);
  script?: ScriptTag[] | ((params: any) => ScriptTag[]);
  style?: StyleTag[] | ((params: any) => StyleTag[]);
  htmlAttrs?: Record<string, any> | ((params: any) => Record<string, any>);
  bodyAttrs?: Record<string, any> | ((params: any) => Record<string, any>);
  noscript?: HeadTag[] | ((params: any) => HeadTag[]);
}

export interface ResolvedHeadData {
  title?: string;
  titleTemplate?: string | ((title: string) => string);
  meta: MetaTag[];
  link: LinkTag[];
  script: ScriptTag[];
  style: StyleTag[];
  htmlAttrs: Record<string, any>;
  bodyAttrs: Record<string, any>;
  noscript: HeadTag[];
}

export type HeadFunction<TParams = any> = (context: RouteMatch<TParams>) => HeadInput;

// Route enhancer for head management
export function head<TRoute extends Route>(
  headInput: HeadInput | HeadFunction<InferParams<TRoute>>
): (route: TRoute) => TRoute & { _head: HeadInput | HeadFunction<InferParams<TRoute>> } {
  return (route: TRoute) => {
    return {
      ...route,
      _head: headInput,
    };
  };
}

// Utility functions for common head tag patterns
export const seoMeta = {
  // Open Graph tags
  og: (data: {
    title?: string | ((params: any) => string);
    description?: string | ((params: any) => string);
    image?: string | ((params: any) => string);
    url?: string | ((params: any) => string);
    type?: string;
    siteName?: string;
  }) => ({
    meta: [
      { property: 'og:title', content: data.title, key: 'og:title' },
      { property: 'og:description', content: data.description, key: 'og:description' },
      { property: 'og:image', content: data.image, key: 'og:image' },
      { property: 'og:url', content: data.url, key: 'og:url' },
      { property: 'og:type', content: data.type || 'website', key: 'og:type' },
      data.siteName && { property: 'og:site_name', content: data.siteName, key: 'og:site_name' },
    ].filter(Boolean) as MetaTag[],
  }),

  // Twitter Card tags
  twitter: (data: {
    card?: string;
    title?: string | ((params: any) => string);
    description?: string | ((params: any) => string);
    image?: string | ((params: any) => string);
    creator?: string;
    site?: string;
  }) => ({
    meta: [
      { name: 'twitter:card', content: data.card || 'summary_large_image', key: 'twitter:card' },
      { name: 'twitter:title', content: data.title, key: 'twitter:title' },
      { name: 'twitter:description', content: data.description, key: 'twitter:description' },
      { name: 'twitter:image', content: data.image, key: 'twitter:image' },
      data.creator && { name: 'twitter:creator', content: data.creator, key: 'twitter:creator' },
      data.site && { name: 'twitter:site', content: data.site, key: 'twitter:site' },
    ].filter(Boolean) as MetaTag[],
  }),

  // Basic SEO tags
  basic: (data: {
    title?: string | ((params: any) => string);
    description?: string | ((params: any) => string);
    keywords?: string | string[] | ((params: any) => string | string[]);
    robots?: string;
    canonical?: string | ((params: any) => string);
  }) => ({
    title: data.title,
    meta: [
      { name: 'description', content: data.description, key: 'description' },
      data.keywords && {
        name: 'keywords',
        content: Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords,
        key: 'keywords',
      },
      data.robots && { name: 'robots', content: data.robots, key: 'robots' },
    ].filter(Boolean) as MetaTag[],
    link: data.canonical
      ? [{ rel: 'canonical', href: data.canonical, key: 'canonical' }]
      : [],
  }),
};

// Head resolver that processes head data with route context
export function resolveHeadData<TParams>(
  headInput: HeadInput | HeadFunction<TParams>,
  context: RouteMatch<TParams>
): ResolvedHeadData {
  const resolvedInput = typeof headInput === 'function' ? headInput(context) : headInput;

  const resolveValue = <T>(value: T | ((params: TParams) => T)): T => {
    return typeof value === 'function' ? (value as any)(context.params) : value;
  };

  const resolveTags = <T>(tags: T[] | ((params: TParams) => T[]) | undefined): T[] => {
    if (!tags) return [];
    return typeof tags === 'function' ? tags(context.params) : tags;
  };

  // Handle title and titleTemplate
  let resolvedTitle: string | undefined;
  let resolvedTitleTemplate: string | ((title: string) => string) | undefined;

  if (resolvedInput.title) {
    const titleValue = resolveValue(resolvedInput.title);
    if (typeof titleValue === 'string') {
      resolvedTitle = titleValue;
    } else if (titleValue && typeof titleValue === 'object') {
      if ('title' in titleValue) {
        resolvedTitle = resolveValue(titleValue.title!);
      }
      if ('titleTemplate' in titleValue) {
        const template = titleValue.titleTemplate!;
        if (typeof template === 'function') {
          resolvedTitleTemplate = template;
        } else {
          resolvedTitleTemplate = resolveValue(template);
        }
      }
    }
  }

  if (resolvedInput.titleTemplate && !resolvedTitleTemplate) {
    const templateValue = resolvedInput.titleTemplate;
    if (typeof templateValue === 'function') {
      // Function title templates don't need param resolution
      resolvedTitleTemplate = templateValue as (title: string) => string;
    } else {
      resolvedTitleTemplate = resolveValue(templateValue);
    }
  }

  // Apply title template
  if (resolvedTitle && resolvedTitleTemplate) {
    if (typeof resolvedTitleTemplate === 'function') {
      resolvedTitle = resolvedTitleTemplate(resolvedTitle);
    } else if (typeof resolvedTitleTemplate === 'string') {
      resolvedTitle = resolvedTitleTemplate.replace('%s', resolvedTitle);
    }
  }

  return {
    title: resolvedTitle,
    titleTemplate: resolvedTitleTemplate,
    meta: resolveTags(resolvedInput.meta),
    link: resolveTags(resolvedInput.link),
    script: resolveTags(resolvedInput.script),
    style: resolveTags(resolvedInput.style),
    htmlAttrs: resolveValue(resolvedInput.htmlAttrs) || {},
    bodyAttrs: resolveValue(resolvedInput.bodyAttrs) || {},
    noscript: resolveTags(resolvedInput.noscript),
  };
}

// Head manager that can work with any DOM environment
export class HeadManager {
  private document: Document;
  private titleElement: HTMLTitleElement | null = null;
  private managedElements = new Set<Element>();

  constructor(document: Document = globalThis.document) {
    this.document = document;
    this.titleElement = this.document.querySelector('title');
  }

  // Apply resolved head data to the DOM
  apply(headData: ResolvedHeadData): void {
    // Clear previously managed elements
    this.managedElements.forEach((element) => {
      element.remove();
    });
    this.managedElements.clear();

    // Update title
    if (headData.title) {
      if (!this.titleElement) {
        this.titleElement = this.document.createElement('title');
        this.document.head.appendChild(this.titleElement);
        this.managedElements.add(this.titleElement);
      }
      this.titleElement.textContent = headData.title;
    }

    // Update meta tags
    (headData.meta || []).forEach((meta) => {
      const element = this.document.createElement('meta');
      Object.entries(meta).forEach(([key, value]) => {
        if (key !== 'key' && value != null) {
          element.setAttribute(key, String(value));
        }
      });
      this.document.head.appendChild(element);
      this.managedElements.add(element);
    });

    // Update link tags
    (headData.link || []).forEach((link) => {
      const element = this.document.createElement('link');
      Object.entries(link).forEach(([key, value]) => {
        if (key !== 'key' && value != null) {
          element.setAttribute(key, String(value));
        }
      });
      this.document.head.appendChild(element);
      this.managedElements.add(element);
    });

    // Update script tags
    (headData.script || []).forEach((script) => {
      const element = this.document.createElement('script');
      Object.entries(script).forEach(([key, value]) => {
        if (key === 'innerHTML') {
          element.innerHTML = String(value);
        } else if (key !== 'key' && value != null) {
          element.setAttribute(key, String(value));
        }
      });
      this.document.head.appendChild(element);
      this.managedElements.add(element);
    });

    // Update style tags
    (headData.style || []).forEach((style) => {
      const element = this.document.createElement('style');
      if (style.innerHTML) {
        element.innerHTML = style.innerHTML;
      }
      this.document.head.appendChild(element);
      this.managedElements.add(element);
    });

    // Update HTML attributes
    const htmlElement = this.document.documentElement;
    Object.entries(headData.htmlAttrs || {}).forEach(([key, value]) => {
      if (value != null) {
        htmlElement.setAttribute(key, String(value));
      }
    });

    // Update body attributes
    const bodyElement = this.document.body;
    if (bodyElement) {
      Object.entries(headData.bodyAttrs || {}).forEach(([key, value]) => {
        if (value != null) {
          bodyElement.setAttribute(key, String(value));
        }
      });
    }

    // Update noscript tags
    (headData.noscript || []).forEach((noscript) => {
      const element = this.document.createElement('noscript');
      if (noscript.innerHTML) {
        element.innerHTML = noscript.innerHTML;
      } else if (noscript.textContent) {
        element.textContent = noscript.textContent;
      }
      this.document.head.appendChild(element);
      this.managedElements.add(element);
    });
  }

  // Generate SSR string for server-side rendering
  static generateSSR(headData: ResolvedHeadData): {
    headTags: string;
    htmlAttrs: string;
    bodyAttrs: string;
  } {
    const headTags: string[] = [];

    // Title
    if (headData.title) {
      headTags.push(`<title>${headData.title}</title>`);
    }

    // Meta tags
    (headData.meta || []).forEach((meta) => {
      const attrs = Object.entries(meta)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      headTags.push(`<meta ${attrs}>`);
    });

    // Link tags
    (headData.link || []).forEach((link) => {
      const attrs = Object.entries(link)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      headTags.push(`<link ${attrs}>`);
    });

    // Script tags
    (headData.script || []).forEach((script) => {
      const attrs = Object.entries(script)
        .filter(([key]) => key !== 'key' && key !== 'innerHTML')
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      const content = script.innerHTML || '';
      headTags.push(`<script ${attrs}>${content}</script>`);
    });

    // Style tags
    (headData.style || []).forEach((style) => {
      const content = style.innerHTML || '';
      headTags.push(`<style>${content}</style>`);
    });

    // Noscript tags
    (headData.noscript || []).forEach((noscript) => {
      const content = noscript.innerHTML || noscript.textContent || '';
      headTags.push(`<noscript>${content}</noscript>`);
    });

    // HTML attributes
    const htmlAttrs = Object.entries(headData.htmlAttrs || {})
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    // Body attributes
    const bodyAttrs = Object.entries(headData.bodyAttrs || {})
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    return {
      headTags: headTags.join('\n'),
      htmlAttrs,
      bodyAttrs,
    };
  }
}

// Merge multiple head inputs (useful for nested routes)
export function mergeHeadData(...headInputs: (ResolvedHeadData | undefined)[]): ResolvedHeadData {
  const result: ResolvedHeadData = {
    title: undefined,
    titleTemplate: undefined,
    meta: [],
    link: [],
    script: [],
    style: [],
    htmlAttrs: {},
    bodyAttrs: {},
    noscript: [],
  };

  headInputs.filter(Boolean).forEach((input) => {
    if (!input) return;

    // Title - last one wins
    if (input.title) result.title = input.title;
    if (input.titleTemplate) result.titleTemplate = input.titleTemplate;

    // Arrays - merge all
    result.meta.push(...(input.meta || []));
    result.link.push(...(input.link || []));
    result.script.push(...(input.script || []));
    result.style.push(...(input.style || []));
    result.noscript.push(...(input.noscript || []));

    // Objects - merge
    Object.assign(result.htmlAttrs, input.htmlAttrs || {});
    Object.assign(result.bodyAttrs, input.bodyAttrs || {});
  });

  return result;
}

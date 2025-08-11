// =================================================================
//
//      Combi-Router: Morphdom Integration
//
//      Utilities for efficient DOM patching with morphdom
//
// =================================================================

import type { MorphdomOptions } from './enhanced-view';

/**
 * Morphdom integration for efficient DOM updates.
 * This module provides utilities to integrate morphdom with the view layer
 * for minimal DOM mutations during navigation.
 */

// Type for morphdom function signature
export type MorphdomFn = (
  fromNode: Element,
  toNode: Element | string,
  options?: MorphdomOptions
) => Element;

// Global morphdom instance holder
let morphdomInstance: MorphdomFn | null = null;

/**
 * Sets the morphdom implementation to use.
 * This allows users to provide their own morphdom version.
 *
 * @example
 * ```typescript
 * import morphdom from 'morphdom';
 * import { setMorphdom } from '@combi-router/enhanced-view';
 *
 * setMorphdom(morphdom);
 * ```
 */
export function setMorphdom(morphdom: MorphdomFn): void {
  morphdomInstance = morphdom;
}

/**
 * Gets the current morphdom instance
 */
export function getMorphdom(): MorphdomFn | null {
  return morphdomInstance;
}

/**
 * Default morphdom implementation (simplified fallback)
 * This is used when no external morphdom is provided
 */
export function defaultMorphdom(
  fromNode: Element,
  toNode: Element | string,
  options?: MorphdomOptions
): Element {
  const toElement = typeof toNode === 'string'
    ? parseHTML(toNode)
    : toNode;

  if (!fromNode || !toElement) {
    console.error('[Morphdom] Invalid arguments');
    return fromNode;
  }

  // Call lifecycle hooks
  if (options?.onBeforeElUpdated) {
    if (!options.onBeforeElUpdated(fromNode, toElement)) {
      return fromNode;
    }
  }

  // Synchronize attributes
  syncAttributes(fromNode, toElement);

  // Handle children
  if (!options?.childrenOnly) {
    // Update the element itself
    if (fromNode.tagName !== toElement.tagName) {
      // Tags don't match, replace the entire element
      const newElement = toElement.cloneNode(true) as Element;
      fromNode.parentNode?.replaceChild(newElement, fromNode);

      if (options?.onElUpdated) {
        options.onElUpdated(newElement);
      }

      return newElement;
    }
  }

  // Update children
  if (options?.onBeforeElChildrenUpdated) {
    if (!options.onBeforeElChildrenUpdated(fromNode, toElement)) {
      return fromNode;
    }
  }

  updateChildren(fromNode, toElement, options);

  if (options?.onElUpdated) {
    options.onElUpdated(fromNode);
  }

  return fromNode;
}

/**
 * Parse HTML string into an Element
 */
function parseHTML(html: string): Element | null {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/**
 * Synchronize attributes between two elements
 */
function syncAttributes(fromEl: Element, toEl: Element): void {
  const fromAttrs = fromEl.attributes;
  const toAttrs = toEl.attributes;

  // Remove attributes that are not in toEl
  for (let i = fromAttrs.length - 1; i >= 0; i--) {
    const attr = fromAttrs[i];
    if (!toEl.hasAttribute(attr.name)) {
      fromEl.removeAttribute(attr.name);
    }
  }

  // Add/update attributes from toEl
  for (let i = 0; i < toAttrs.length; i++) {
    const attr = toAttrs[i];
    if (fromEl.getAttribute(attr.name) !== attr.value) {
      fromEl.setAttribute(attr.name, attr.value);
    }
  }
}

/**
 * Update children of an element
 */
function updateChildren(
  fromEl: Element,
  toEl: Element,
  options?: MorphdomOptions
): void {
  const fromChildren = Array.from(fromEl.childNodes);
  const toChildren = Array.from(toEl.childNodes);

  // Simple replacement for now
  // A more sophisticated algorithm would diff and patch children
  if (areChildrenDifferent(fromChildren, toChildren)) {
    // Clear and rebuild (simplified approach)
    while (fromEl.firstChild) {
      if (options?.onBeforeNodeDiscarded) {
        if (options.onBeforeNodeDiscarded(fromEl.firstChild) === false) {
          continue;
        }
      }

      const child = fromEl.firstChild;
      fromEl.removeChild(child);

      if (options?.onNodeDiscarded) {
        options.onNodeDiscarded(child);
      }
    }

    toChildren.forEach(child => {
      let nodeToAdd = child.cloneNode(true);

      if (options?.onBeforeNodeAdded) {
        const result = options.onBeforeNodeAdded(nodeToAdd);
        if (result === false) {
          return;
        }
        if (result instanceof Node) {
          nodeToAdd = result;
        }
      }

      fromEl.appendChild(nodeToAdd);

      if (options?.onNodeAdded) {
        options.onNodeAdded(nodeToAdd);
      }
    });
  }
}

/**
 * Check if children are different (simplified check)
 */
function areChildrenDifferent(fromChildren: Node[], toChildren: Node[]): boolean {
  if (fromChildren.length !== toChildren.length) {
    return true;
  }

  for (let i = 0; i < fromChildren.length; i++) {
    const fromChild = fromChildren[i];
    const toChild = toChildren[i];

    if (fromChild.nodeType !== toChild.nodeType) {
      return true;
    }

    if (fromChild.nodeType === Node.TEXT_NODE) {
      if (fromChild.textContent !== toChild.textContent) {
        return true;
      }
    } else if (fromChild.nodeType === Node.ELEMENT_NODE) {
      const fromEl = fromChild as Element;
      const toEl = toChild as Element;
      if (fromEl.tagName !== toEl.tagName) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Creates a morphdom integration configuration
 * with sensible defaults for SPA navigation
 */
export function createMorphdomIntegration(customOptions?: Partial<MorphdomOptions>): {
  morphdom: MorphdomFn;
  options: MorphdomOptions;
} {
  const morphdom = morphdomInstance || defaultMorphdom;

  const defaultOptions: MorphdomOptions = {
    childrenOnly: false,

    onBeforeElUpdated: (fromEl, toEl) => {
      // Preserve focus
      if (fromEl === document.activeElement) {
        // Check if the element can keep focus
        if (fromEl.tagName === toEl.tagName) {
          return true;
        }
        return false;
      }

      // Preserve form values
      if (fromEl.tagName === 'INPUT') {
        const fromInput = fromEl as HTMLInputElement;
        const toInput = toEl as HTMLInputElement;

        // Preserve user input
        if (fromInput.type === 'text' || fromInput.type === 'email' || fromInput.type === 'password') {
          toInput.value = fromInput.value;
        }

        // Preserve checkbox/radio state
        if (fromInput.type === 'checkbox' || fromInput.type === 'radio') {
          toInput.checked = fromInput.checked;
        }
      }

      if (fromEl.tagName === 'TEXTAREA') {
        (toEl as HTMLTextAreaElement).value = (fromEl as HTMLTextAreaElement).value;
      }

      if (fromEl.tagName === 'SELECT') {
        (toEl as HTMLSelectElement).value = (fromEl as HTMLSelectElement).value;
      }

      return true;
    },

    onElUpdated: (el) => {
      // Trigger any animations or transitions
      if (el.classList.contains('route-transition')) {
        el.classList.add('route-updated');
        setTimeout(() => {
          el.classList.remove('route-updated');
        }, 300);
      }
    },

    onBeforeNodeAdded: (node) => {
      // Add entrance animations to new nodes
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.classList.contains('route-enter')) {
          el.classList.add('route-entering');
          setTimeout(() => {
            el.classList.remove('route-entering');
          }, 300);
        }
      }
      return node;
    },

    onBeforeNodeDiscarded: (node) => {
      // Don't discard nodes with preserve attribute
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.hasAttribute('data-preserve')) {
          return false;
        }
      }
      return true;
    }
  };

  const options = { ...defaultOptions, ...customOptions };

  return { morphdom, options };
}

/**
 * Helper to create a morphdom-compatible HTML string from a template result
 */
export function templateToHTML(template: any): string {
  if (typeof template === 'string') {
    return template;
  }

  if (template instanceof Node) {
    const container = document.createElement('div');
    container.appendChild(template.cloneNode(true));
    return container.innerHTML;
  }

  // Handle template results from various libraries
  if (template._$litType$) {
    // lit-html style - would need actual lit-html to render
    console.warn('[Morphdom] lit-html template detected, using fallback rendering');
    return '<div>lit-html template</div>';
  }

  if (template.html) {
    return template.html;
  }

  if (template.template instanceof HTMLTemplateElement) {
    const container = document.createElement('div');
    container.appendChild(template.template.content.cloneNode(true));
    return container.innerHTML;
  }

  return String(template);
}

/**
 * Utility to compare two DOM trees and return a diff
 * Useful for debugging morphdom updates
 */
export function diffDOM(fromEl: Element, toEl: Element | string): {
  attributeChanges: Array<{ element: string; attribute: string; from: string | null; to: string | null }>;
  structuralChanges: Array<{ type: 'added' | 'removed' | 'moved'; path: string }>;
} {
  const toElement = typeof toEl === 'string' ? parseHTML(toEl) : toEl;

  if (!toElement) {
    return { attributeChanges: [], structuralChanges: [] };
  }

  const attributeChanges: Array<{ element: string; attribute: string; from: string | null; to: string | null }> = [];
  const structuralChanges: Array<{ type: 'added' | 'removed' | 'moved'; path: string }> = [];

  // Compare attributes
  const fromAttrs = Array.from(fromEl.attributes);
  const toAttrs = Array.from(toElement.attributes);

  fromAttrs.forEach(attr => {
    const toValue = toElement.getAttribute(attr.name);
    if (toValue !== attr.value) {
      attributeChanges.push({
        element: fromEl.tagName.toLowerCase(),
        attribute: attr.name,
        from: attr.value,
        to: toValue
      });
    }
  });

  toAttrs.forEach(attr => {
    if (!fromEl.hasAttribute(attr.name)) {
      attributeChanges.push({
        element: fromEl.tagName.toLowerCase(),
        attribute: attr.name,
        from: null,
        to: attr.value
      });
    }
  });

  // Compare children (simplified)
  const fromChildren = Array.from(fromEl.children);
  const toChildren = Array.from(toElement.children);

  if (fromChildren.length !== toChildren.length) {
    structuralChanges.push({
      type: fromChildren.length > toChildren.length ? 'removed' : 'added',
      path: getElementPath(fromEl)
    });
  }

  return { attributeChanges, structuralChanges };
}

/**
 * Get a CSS selector path for an element
 */
function getElementPath(el: Element): string {
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className) {
      selector += `.${Array.from(current.classList).join('.')}`;
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

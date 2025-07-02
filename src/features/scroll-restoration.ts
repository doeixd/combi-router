// =================================================================
//
//      Combi-Router: Scroll Restoration Feature
//
//      Automatic scroll position management with intelligent strategies
//
// =================================================================

import type { RouteMatch } from '../core/types';

export type ScrollRestorationStrategy = 'auto' | 'manual' | 'smooth';

export interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
  path: string;
  key?: string;
}

export interface ScrollRestorationConfig {
  enabled: boolean;
  strategy: ScrollRestorationStrategy;
  restoreOnBack: boolean;
  saveDelay?: number;
  maxPositions?: number;
  smoothScrollBehavior?: ScrollBehavior;
  excludePaths?: string[];
}

export class ScrollRestorationManager {
  private positions = new Map<string, ScrollPosition>();
  private config: Required<ScrollRestorationConfig>;
  private saveTimeout: number | null = null;
  private currentKey: string | null = null;
  private isRestoring = false;

  constructor(config: ScrollRestorationConfig) {
    this.config = {
      ...defaultScrollRestorationConfig,
      ...config
    };

    if (this.config.enabled && typeof window !== 'undefined') {
      this.initializeScrollRestoration();
    }
  }

  private initializeScrollRestoration(): void {
    // Disable browser's native scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Listen for scroll events to save positions
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    
    // Listen for beforeunload to save current position
    window.addEventListener('beforeunload', this.saveCurrentPosition.bind(this));
    
    // Listen for popstate to restore positions
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }

  private handleScroll(): void {
    if (this.isRestoring || !this.currentKey) return;

    // Debounce scroll position saving
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.saveCurrentPosition();
    }, this.config.saveDelay);
  }

  private handlePopState(event: PopStateEvent): void {
    if (!this.config.restoreOnBack) return;

    const key = event.state?.scrollKey || this.generateKey(window.location.pathname);
    this.restorePosition(key);
  }

  private generateKey(path: string): string {
    return `scroll:${path}`;
  }

  private isPathExcluded(path: string): boolean {
    return this.config.excludePaths.some(excludePath => 
      path.startsWith(excludePath)
    );
  }

  public saveCurrentPosition(): void {
    if (!this.currentKey || this.isPathExcluded(window.location.pathname)) {
      return;
    }

    const position: ScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
      path: window.location.pathname,
      key: this.currentKey
    };

    this.positions.set(this.currentKey, position);

    // Cleanup old positions if we exceed the limit
    if (this.positions.size > this.config.maxPositions) {
      const sortedEntries = Array.from(this.positions.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toDelete = sortedEntries.slice(0, this.positions.size - this.config.maxPositions);
      toDelete.forEach(([key]) => this.positions.delete(key));
    }
  }

  public restorePosition(key: string): void {
    const position = this.positions.get(key);
    if (!position) {
      // No saved position, scroll to top
      this.scrollTo(0, 0);
      return;
    }

    this.scrollTo(position.x, position.y);
  }

  private scrollTo(x: number, y: number): void {
    this.isRestoring = true;

    const scrollOptions: ScrollToOptions = {
      left: x,
      top: y,
      behavior: this.config.strategy === 'smooth' ? this.config.smoothScrollBehavior : 'auto'
    };

    window.scrollTo(scrollOptions);

    // Reset the restoring flag after scroll completes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.isRestoring = false;
      });
    });
  }

  public onNavigationStart(_from: RouteMatch | null, to: RouteMatch): void {
    // Save current position before navigating away
    this.saveCurrentPosition();

    // Set new key for the destination
    this.currentKey = this.generateKey(to.pathname);
  }

  public onNavigationComplete(_match: RouteMatch, isBackNavigation: boolean): void {
    if (this.config.strategy === 'manual') return;

    if (isBackNavigation && this.config.restoreOnBack) {
      // Restore saved position for back navigation
      this.restorePosition(this.currentKey!);
    } else {
      // Scroll to top for forward navigation
      this.scrollTo(0, 0);
    }
  }

  public manualSave(key: string, position?: ScrollPosition): void {
    const pos = position || {
      x: window.scrollX,
      y: window.scrollY,
      timestamp: Date.now(),
      path: window.location.pathname,
      key
    };

    this.positions.set(key, pos);
  }

  public manualRestore(key: string): boolean {
    const position = this.positions.get(key);
    if (!position) return false;

    this.scrollTo(position.x, position.y);
    return true;
  }

  public clearPositions(): void {
    this.positions.clear();
  }

  public getPosition(key: string): ScrollPosition | undefined {
    return this.positions.get(key);
  }

  public getAllPositions(): Map<string, ScrollPosition> {
    return new Map(this.positions);
  }

  public updateConfig(newConfig: Partial<ScrollRestorationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.handleScroll.bind(this));
      window.removeEventListener('beforeunload', this.saveCurrentPosition.bind(this));
      window.removeEventListener('popstate', this.handlePopState.bind(this));
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.positions.clear();
  }
}

// Default configuration
export const defaultScrollRestorationConfig: Required<ScrollRestorationConfig> = {
  enabled: true,
  strategy: 'auto',
  restoreOnBack: true,
  saveDelay: 100,
  maxPositions: 50,
  smoothScrollBehavior: 'smooth',
  excludePaths: []
};

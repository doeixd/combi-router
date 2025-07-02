// =================================================================
//
//      Combi-Router: Enhanced Code Splitting Feature
//
//      Intelligent lazy loading with preloading strategies
//
// =================================================================

import type { Route } from '../core/types';

export type SplittingStrategy = 'route-based' | 'feature-based' | 'hybrid';
export type PreloadStrategy = 'hover' | 'visible' | 'immediate' | 'none';
export type LoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ChunkNamingFunction {
  (route: Route): string;
}

export interface LoadingState {
  status: LoadingStatus;
  error?: Error;
  component?: any;
  timestamp?: number;
}

export interface CodeSplittingConfig {
  strategy: SplittingStrategy;
  preloadStrategy: PreloadStrategy;
  chunkNaming?: ChunkNamingFunction;
  fallback?: any; // ComponentType or element
  errorBoundary?: any; // ComponentType or element
  preloadTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  priority?: 'high' | 'low' | 'auto';
  connectionAware?: boolean;
}

export interface ChunkInfo {
  route: Route;
  importFn: () => Promise<any>;
  preloaded: boolean;
  loadingState: LoadingState;
  lastAccessed?: Date;
  accessCount: number;
  size?: number;
}

export class CodeSplittingManager {
  private chunks = new Map<string, ChunkInfo>();
  private config: Required<CodeSplittingConfig>;
  private intersectionObserver?: IntersectionObserver;
  private hoverTimeouts = new Map<string, number>();
  private connectionInfo: { effectiveType?: string; downlink?: number } = {};

  constructor(config: CodeSplittingConfig) {
    this.config = {
      ...defaultCodeSplittingConfig,
      ...config,
      chunkNaming: config.chunkNaming || ((route) => route.id || 'chunk')
    };

    if (typeof window !== 'undefined') {
      this.initializeConnectionMonitoring();
      this.initializeIntersectionObserver();
    }
  }

  private initializeConnectionMonitoring(): void {
    if (!this.config.connectionAware) return;

    // Monitor network conditions
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink
      };

      connection.addEventListener('change', () => {
        this.connectionInfo = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink
        };
      });
    }
  }

  private initializeIntersectionObserver(): void {
    if (this.config.preloadStrategy !== 'visible') return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const routeId = entry.target.getAttribute('data-route-id');
            if (routeId) {
              this.preloadChunk(routeId);
            }
          }
        });
      },
      {
        rootMargin: '50px' // Start loading when element is 50px away from viewport
      }
    );
  }

  private shouldPreload(): boolean {
    if (!this.config.connectionAware) return true;

    const { effectiveType, downlink } = this.connectionInfo;
    
    // Don't preload on slow connections
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return false;
    }
    
    // Be conservative on 3G
    if (effectiveType === '3g' && downlink && downlink < 1.5) {
      return false;
    }

    return true;
  }

  public registerRoute(route: Route): void {
    if (!route.metadata.lazy?.import) return;

    const chunkId = this.config.chunkNaming(route);
    
    if (!this.chunks.has(chunkId)) {
      this.chunks.set(chunkId, {
        route,
        importFn: route.metadata.lazy.import,
        preloaded: false,
        loadingState: { status: 'idle' as LoadingStatus },
        accessCount: 0
      });

      // Immediate preloading
      if (this.config.preloadStrategy === 'immediate' && this.shouldPreload()) {
        this.preloadChunk(chunkId);
      }
    }
  }

  public async loadChunk(routeId: string): Promise<any> {
    const chunkInfo = this.chunks.get(routeId);
    if (!chunkInfo) {
      throw new Error(`Chunk not found for route: ${routeId}`);
    }

    // Update access statistics
    chunkInfo.accessCount++;
    chunkInfo.lastAccessed = new Date();

    // Return cached component if already loaded
    if (chunkInfo.loadingState.status === 'loaded' && chunkInfo.loadingState.component) {
      return chunkInfo.loadingState.component;
    }

    // If currently loading, wait for it to complete
    if (chunkInfo.loadingState.status === 'loading') {
      return this.waitForChunkLoad(routeId);
    }

    return this.performLoad(chunkInfo);
  }

  private async performLoad(chunkInfo: ChunkInfo): Promise<any> {
    chunkInfo.loadingState = {
      status: 'loading' as LoadingStatus,
      timestamp: Date.now()
    };

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const module = await Promise.race([
          chunkInfo.importFn(),
          this.createTimeoutPromise(this.config.preloadTimeout)
        ]);

        const component = module.default || module;
        
        chunkInfo.loadingState = {
          status: 'loaded' as LoadingStatus,
          component,
          timestamp: Date.now()
        };

        chunkInfo.preloaded = true;
        return component;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    chunkInfo.loadingState = {
      status: 'error' as LoadingStatus,
      error: lastError,
      timestamp: Date.now()
    };

    throw lastError;
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Chunk load timeout')), timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForChunkLoad(routeId: string): Promise<any> {
    const chunkInfo = this.chunks.get(routeId);
    if (!chunkInfo) throw new Error(`Chunk not found: ${routeId}`);

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (chunkInfo.loadingState.status === 'loaded') {
          resolve(chunkInfo.loadingState.component);
        } else if (chunkInfo.loadingState.status === 'error') {
          reject(chunkInfo.loadingState.error);
        } else {
          setTimeout(checkStatus, 50);
        }
      };
      checkStatus();
    });
  }

  public preloadChunk(routeId: string): Promise<void> {
    if (!this.shouldPreload()) return Promise.resolve();

    const chunkInfo = this.chunks.get(routeId);
    if (!chunkInfo || chunkInfo.preloaded || chunkInfo.loadingState.status === 'loading') {
      return Promise.resolve();
    }

    return this.performLoad(chunkInfo).catch(error => {
      console.warn(`[CodeSplitting] Preload failed for ${routeId}:`, error);
    });
  }

  public setupHoverPreloading(element: Element, routeId: string): () => void {
    if (this.config.preloadStrategy !== 'hover') {
      return () => {};
    }

    const handleMouseEnter = () => {
      const timeoutId = window.setTimeout(() => {
        this.preloadChunk(routeId);
      }, 100); // Small delay to avoid excessive preloading

      this.hoverTimeouts.set(routeId, timeoutId);
    };

    const handleMouseLeave = () => {
      const timeoutId = this.hoverTimeouts.get(routeId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.hoverTimeouts.delete(routeId);
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      const timeoutId = this.hoverTimeouts.get(routeId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.hoverTimeouts.delete(routeId);
      }
    };
  }

  public setupVisibilityPreloading(element: Element, routeId: string): () => void {
    if (this.config.preloadStrategy !== 'visible' || !this.intersectionObserver) {
      return () => {};
    }

    element.setAttribute('data-route-id', routeId);
    this.intersectionObserver.observe(element);

    return () => {
      this.intersectionObserver?.unobserve(element);
      element.removeAttribute('data-route-id');
    };
  }

  public getChunkInfo(routeId: string): ChunkInfo | undefined {
    return this.chunks.get(routeId);
  }

  public getLoadingState(routeId: string): LoadingState {
    const chunkInfo = this.chunks.get(routeId);
    return chunkInfo?.loadingState || { status: 'idle' as LoadingStatus };
  }

  public getStats() {
    const stats = {
      totalChunks: this.chunks.size,
      loadedChunks: 0,
      preloadedChunks: 0,
      errorChunks: 0,
      averageAccessCount: 0,
      memoryUsage: 0
    };

    let totalAccess = 0;

    this.chunks.forEach(chunk => {
      totalAccess += chunk.accessCount;
      
      switch (chunk.loadingState.status) {
        case 'loaded':
          stats.loadedChunks++;
          if (chunk.preloaded) stats.preloadedChunks++;
          break;
        case 'error':
          stats.errorChunks++;
          break;
      }

      if (chunk.size) {
        stats.memoryUsage += chunk.size;
      }
    });

    stats.averageAccessCount = stats.totalChunks > 0 ? totalAccess / stats.totalChunks : 0;

    return stats;
  }

  public clearUnusedChunks(thresholdHours = 24): number {
    const threshold = Date.now() - (thresholdHours * 60 * 60 * 1000);
    let cleared = 0;

    this.chunks.forEach((chunk, routeId) => {
      if (
        chunk.lastAccessed && 
        chunk.lastAccessed.getTime() < threshold &&
        chunk.accessCount === 0
      ) {
        this.chunks.delete(routeId);
        cleared++;
      }
    });

    return cleared;
  }

  public updateConfig(newConfig: Partial<CodeSplittingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    this.intersectionObserver?.disconnect();
    
    this.hoverTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.hoverTimeouts.clear();
    
    this.chunks.clear();
  }
}

// Default configuration
export const defaultCodeSplittingConfig: Required<CodeSplittingConfig> = {
  strategy: 'route-based',
  preloadStrategy: 'hover',
  chunkNaming: (route) => route.id || 'chunk',
  fallback: null,
  errorBoundary: null,
  preloadTimeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
  priority: 'auto',
  connectionAware: true
};

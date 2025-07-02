/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';
import { createResource, type Resource } from '../src'; // Assuming path to src

// Helper to flush promises
const flushPromises = () => new Promise(setImmediate);

describe('createResource', () => {
  it('should start in "pending" state', () => {
    const promiseFn = vi.fn(() => new Promise(() => {})); // Never resolves
    const resource = createResource(promiseFn);
    expect(resource.status).toBe('pending');
  });

  it('should transition to "success" state on successful promise resolution', async () => {
    const data = { message: 'Success!' };
    const promiseFn = vi.fn(() => Promise.resolve(data));
    const resource = createResource(promiseFn);

    expect(resource.status).toBe('pending');
    
    // Wait for the promise to resolve
    await flushPromises(); 
    
    expect(resource.status).toBe('success');
    expect(resource.read()).toBe(data);
  });

  it('should transition to "error" state on promise rejection', async () => {
    const error = new Error('Failed!');
    const promiseFn = vi.fn(() => Promise.reject(error));
    const resource = createResource(promiseFn);

    expect(resource.status).toBe('pending');

    // Wait for the promise to resolve/reject
    await flushPromises();

    expect(resource.status).toBe('error');
    expect(() => resource.read()).toThrow(error);
  });

  it('read() should throw a special promise when "pending"', () => {
    const promiseFn = vi.fn(() => new Promise(() => {})); // Stays pending
    const resource = createResource(promiseFn);
    
    let thrown: any;
    try {
      resource.read();
    } catch (e) {
      thrown = e;
    }
    // Check if it's an instance of Promise (or a subclass)
    // The actual SuspensePromise class is not exported, so we check its nature.
    expect(thrown).toBeInstanceOf(Promise); 
    expect(resource.status).toBe('pending');
  });

  it('read() should return data when "success"', async () => {
    const data = 'Test Data';
    const resource = createResource(() => Promise.resolve(data));
    await flushPromises();
    expect(resource.read()).toBe(data);
  });

  it('read() should throw error when "error"', async () => {
    const error = new Error('Test Error');
    const resource = createResource(() => Promise.reject(error));
    await flushPromises();
    expect(() => resource.read()).toThrow(error);
  });

  it('should call the promiseFn only once for multiple reads or status checks', async () => {
    const promiseFn = vi.fn(() => Promise.resolve('data'));
    const resource = createResource(promiseFn);

    // Access multiple times while pending
    expect(resource.status).toBe('pending');
    try { resource.read(); } catch (e) {}
    expect(resource.status).toBe('pending');
    try { resource.read(); } catch (e) {}
    
    await flushPromises(); // Resolve the promise

    // Access multiple times after resolved
    expect(resource.status).toBe('success');
    resource.read();
    expect(resource.status).toBe('success');
    resource.read();

    expect(promiseFn).toHaveBeenCalledTimes(1);
  });

  it('SuspensePromise thrown by read() should resolve when original promise resolves', async () => {
    let resolveOriginalPromise: (value: string) => void = () => {};
    const originalPromise = new Promise<string>(resolve => {
      resolveOriginalPromise = resolve;
    });
    
    const resource = createResource(() => originalPromise);
    
    let suspensePromise: Promise<void> | undefined;
    try {
      resource.read();
    } catch (e: any) {
      suspensePromise = e;
    }

    expect(suspensePromise).toBeInstanceOf(Promise);

    const onSuspenseResolved = vi.fn();
    suspensePromise?.then(onSuspenseResolved);

    // Resolve the original promise
    resolveOriginalPromise('done');
    await flushPromises(); // Allow microtasks to run

    expect(onSuspenseResolved).toHaveBeenCalled();
    expect(resource.status).toBe('success');
    expect(resource.read()).toBe('done');
  });

   it('SuspensePromise thrown by read() should resolve even if original promise rejects', async () => {
    let rejectOriginalPromise: (reason?: any) => void = () => {};
    const originalPromise = new Promise<string>((_, reject) => {
      rejectOriginalPromise = reject;
    });
    
    const resource = createResource(() => originalPromise);
    
    let suspensePromise: Promise<void> | undefined;
    try {
      resource.read();
    } catch (e: any) {
      suspensePromise = e;
    }

    expect(suspensePromise).toBeInstanceOf(Promise);

    const onSuspenseResolved = vi.fn();
    suspensePromise?.then(onSuspenseResolved);

    // Reject the original promise
    const rejectionError = new Error('failed');
    rejectOriginalPromise(rejectionError);
    await flushPromises(); // Allow microtasks to run

    expect(onSuspenseResolved).toHaveBeenCalled();
    expect(resource.status).toBe('error');
    expect(() => resource.read()).toThrow(rejectionError);
  });
});

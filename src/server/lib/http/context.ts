import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from 'hono';

const contextStore = new AsyncLocalStorage<Context>();

export function runWithContext<T>(context: Context, fn: () => Promise<T> | T) {
  return contextStore.run(context, fn);
}

export function getCurrentContext(): Context {
  const context = contextStore.getStore();

  if (!context) {
    throw new Error('No active Hono request context');
  }

  return context;
}

import type { ActiveCultivatorRef, AuthUser } from '@server/lib/auth/types.js';
import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  user?: AuthUser;
  activeCultivatorRef?: ActiveCultivatorRef;
};

const contextStore = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return contextStore.run(context, fn);
}

export function getCurrentContext(): RequestContext | undefined {
  return contextStore.getStore();
}

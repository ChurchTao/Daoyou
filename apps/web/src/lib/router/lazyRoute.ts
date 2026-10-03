import type { ComponentType } from 'react';

type LazyRouteModule = Record<string, unknown> & {
  default: ComponentType;
};

export function lazyRoute(
  importer: () => Promise<LazyRouteModule>,
) {
  return async () => {
    const module = await importer();
    const { default: Component, ...rest } = module;

    return {
      ...rest,
      Component,
    } as never;
  };
}

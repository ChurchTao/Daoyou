import type { ComponentType } from 'react';
import type { LazyRouteFunction } from 'react-router';

type LazyRouteModule = Record<string, unknown> & {
  default: ComponentType;
};

export function lazyRoute(
  importer: () => Promise<LazyRouteModule>,
): LazyRouteFunction<any> {
  return async () => {
    const module = await importer();
    const { default: Component, ...rest } = module;

    return {
      ...rest,
      Component,
    } as never;
  };
}

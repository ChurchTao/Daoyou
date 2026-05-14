import type { Params, UIMatch } from 'react-router';

export const APP_TITLE = '万界道友';

export interface RouteTitleContext {
  params: Params<string>;
  pathname: string;
  searchParams: URLSearchParams;
}

export type RouteTitleResolver =
  | string
  | null
  | undefined
  | ((context: RouteTitleContext) => string | null | undefined);

export interface AppRouteHandle {
  title?: RouteTitleResolver;
}

export interface RouteTitleLocationLike {
  pathname: string;
  search: string;
}

type MatchLike = Pick<UIMatch, 'handle' | 'params'>;

export function formatDocumentTitle(title?: string | null) {
  const trimmedTitle = title?.trim();

  if (!trimmedTitle || trimmedTitle === APP_TITLE) {
    return APP_TITLE;
  }

  return `${trimmedTitle} | ${APP_TITLE}`;
}

function resolveHandleTitle(
  resolver: RouteTitleResolver,
  context: RouteTitleContext,
) {
  return typeof resolver === 'function' ? resolver(context) : resolver;
}

export function resolveRouteTitle(
  matches: MatchLike[],
  location: RouteTitleLocationLike,
) {
  const searchParams = new URLSearchParams(location.search);

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const handle = match.handle as AppRouteHandle | undefined;

    if (!handle?.title) {
      continue;
    }

    const title = resolveHandleTitle(handle.title, {
      params: match.params,
      pathname: location.pathname,
      searchParams,
    });

    if (typeof title === 'string' && title.trim()) {
      return title;
    }
  }

  return APP_TITLE;
}

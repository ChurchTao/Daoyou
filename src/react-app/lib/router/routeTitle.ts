import type { Params, UIMatch } from 'react-router';

export const APP_TITLE = '万界道友';

const SECT_VISIT_TITLES: Readonly<Record<string, string>> = {
  lingxiao: '红尘剑宗舆图',
  wuxiang: '无相禅宗舆图',
  tianyan: '天衍圣地舆图',
  youdu: '幽都舆图',
};

export type GameSceneGroup =
  'cultivation' | 'craft' | 'trade' | 'message' | 'combat' | 'service';

export type GameSceneChrome = 'standard' | 'immersive';

export type GameSceneDockMode = 'core' | 'expanded' | 'hidden';

export type GameScenePresentation =
  'hub' | 'workflow' | 'archive' | 'service' | 'immersive';

export interface GameSceneHandle {
  id: string;
  label: string;
  group: GameSceneGroup;
  chrome: GameSceneChrome;
  dock: GameSceneDockMode;
  presentation: GameScenePresentation;
  summary?: string | null;
}

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
  gameScene?: GameSceneHandle;
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

export function resolveSectVisitTitle(sectId?: string): string {
  const title = sectId ? SECT_VISIT_TITLES[sectId] : undefined;
  return title ? `${title} · 访宗` : '访宗舆图';
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

export function resolveGameScene(matches: MatchLike[]) {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const handle = match.handle as AppRouteHandle | undefined;

    if (handle?.gameScene) {
      return handle.gameScene;
    }
  }

  return null;
}

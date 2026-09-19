export type SpecialBackNavigation =
  | {
      type: 'path';
      href: string;
      replace?: boolean;
    }
  | {
      type: 'history-or-path';
      fallbackHref: string;
    };

export function resolveMapCloseNavigation(
  search: string,
): SpecialBackNavigation {
  const intent = new URLSearchParams(search).get('intent');

  if (intent !== 'market' && intent !== 'dungeon') {
    return {
      type: 'path',
      href: '/game',
      replace: true,
    };
  }

  return {
    type: 'history-or-path',
    fallbackHref: '/game',
  };
}

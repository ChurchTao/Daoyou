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

  if (intent === 'sect') {
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

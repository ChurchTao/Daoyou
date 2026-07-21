export type GameShellKind =
  | 'genesis'
  | 'viewport'
  | 'combat'
  | 'map'
  | 'dungeon';

export function resolveGameShellKind(pathname: string): GameShellKind | null {
  if (pathname === '/game/create' || pathname === '/game/reincarnate') {
    return 'genesis';
  }

  if (
    pathname === '/game/battle' ||
    pathname === '/game/battle/challenge' ||
    /^\/game\/battle\/[^/]+$/.test(pathname) ||
    pathname === '/game/bet-battle/challenge' ||
    /^\/game\/sect\/trial\/[^/]+$/.test(pathname) ||
    /^\/game\/sect\/tasks\/[^/]+\/battle$/.test(pathname) ||
    pathname === '/game/training-room'
  ) {
    return 'combat';
  }

  if (pathname === '/game/map') {
    return 'map';
  }

  if (pathname === '/game/dungeon') {
    return 'dungeon';
  }

  if (pathname.startsWith('/game')) {
    return 'viewport';
  }

  return null;
}

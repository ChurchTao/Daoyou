export type GameShellKind =
  | 'genesis'
  | 'narrative'
  | 'viewport'
  | 'activity'
  | 'combat'
  | 'map'
  | 'dungeon';

export function resolveGameShellKind(pathname: string): GameShellKind | null {
  if (pathname === '/game/create' || pathname === '/game/reincarnate') {
    return 'genesis';
  }

  if (
    pathname === '/game/sect/onboarding' ||
    pathname === '/game/identity-reshape'
  ) {
    return 'narrative';
  }

  if (
    pathname === '/game/sect/gate/sweep' ||
    pathname === '/game/sect/spirit-vein/mining'
  ) {
    return 'activity';
  }

  if (
    pathname === '/game/battle/challenge' ||
    /^\/game\/battle\/live\/[^/]+$/.test(pathname) ||
    /^\/game\/battle\/[^/]+$/.test(pathname) ||
    pathname === '/game/bet-battle/challenge' ||
    /^\/game\/sect\/tasks\/[^/]+\/battle$/.test(pathname) ||
    pathname === '/game/training-room'
  ) {
    return 'combat';
  }

  if (
    pathname === '/game/map' ||
    /^\/game\/sect\/[^/]+\/visit$/.test(pathname)
  ) {
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

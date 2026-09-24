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
    pathname === '/game/identity-reshape' ||
    pathname === '/game/story' ||
    pathname === '/game/story/preview' ||
    pathname.startsWith('/game/story/preview/')
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
    /^\/game\/sect\/tasks\/[^/]+\/battle$/.test(pathname) ||
    pathname === '/game/training-room' || pathname === '/game/wild'
  ) {
    return 'combat';
  }

  if (
    pathname === '/game/map' ||
    pathname === '/game/map-v2' ||
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

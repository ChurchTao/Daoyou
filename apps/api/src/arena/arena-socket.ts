export const ARENA_SOCKET_PATH = '/api/combat-v6/arena';

export function arenaSocketRoute(pathname: string) {
  const match = /^\/api\/combat-v6\/arena\/([^/]+)\/(watch\/)?socket\/?$/.exec(
    pathname,
  );
  return match ? { battleId: match[1], spectator: !!match[2] } : null;
}

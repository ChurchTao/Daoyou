import { GAME_ROUTE_ID, type UserLoaderData } from '@app/lib/router/routeData';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router';

export function PlayerProvider({ children }: { children: ReactNode }) {
  const gameLoaderData = useRouteLoaderData(GAME_ROUTE_ID) as
    | UserLoaderData
    | undefined;
  const userId = gameLoaderData?.userId ?? null;
  const actions = usePlayerStateActions();

  useEffect(() => {
    void actions.initialize(userId);
  }, [actions, userId]);

  return children;
}

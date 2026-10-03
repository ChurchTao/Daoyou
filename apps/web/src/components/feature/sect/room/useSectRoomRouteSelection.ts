import { SECT_ROOM_NPC_QUERY_KEY } from '@app/components/feature/sect/sectRoomNavigation';
import type { SectRoomDefinition } from '@daoyou/shared/engine/sect';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export function useSectRoomRouteSelection(
  room: SectRoomDefinition | undefined,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRoleKey = searchParams.get(SECT_ROOM_NPC_QUERY_KEY);
  const roleKey = room?.actors.some(
    (actor) => actor.roleKey === requestedRoleKey,
  )
    ? (requestedRoleKey ?? undefined)
    : undefined;
  const onChange = useCallback(
    (nextRoleKey: string | undefined) => {
      const next = new URLSearchParams(searchParams);
      if (
        nextRoleKey &&
        room?.actors.some((actor) => actor.roleKey === nextRoleKey)
      )
        next.set(SECT_ROOM_NPC_QUERY_KEY, nextRoleKey);
      else next.delete(SECT_ROOM_NPC_QUERY_KEY);
      setSearchParams(next, { replace: true });
    },
    [room, searchParams, setSearchParams],
  );

  return useMemo(() => ({ roleKey, onChange }), [onChange, roleKey]);
}

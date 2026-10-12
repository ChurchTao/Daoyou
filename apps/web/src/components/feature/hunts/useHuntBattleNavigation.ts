import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { HUNT_TEAM_CHANGED } from './huntTeamView';

export function useHuntBattleNavigation(
  team: HuntTeam | null | undefined,
  actorId: string,
  refresh: () => void,
) {
  const navigate = useNavigate();
  const previous = useRef<{
    teamId: string | undefined;
    actorId: string;
    status: HuntTeam['status'] | undefined;
  } | null>(null);
  const teamId = team?.id;
  const status = team?.status;
  const battleId = team?.battleId;
  const isMember = team?.members.some(
    (member) => member.cultivatorId === actorId,
  );

  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe('hunt-team.started', () =>
      refresh(),
    );
    const reconnect = realtimeClient.subscribe('ready', () => refresh());
    const onChange = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(HUNT_TEAM_CHANGED, onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      reconnect();
      window.removeEventListener(HUNT_TEAM_CHANGED, onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { teamId, actorId, status };
    // Initial battle snapshots remain manual entry, including a return from combat.
    if (
      !isMember ||
      !battleId ||
      status !== 'in_battle' ||
      before?.teamId !== teamId ||
      before?.actorId !== actorId ||
      (before.status !== 'assembling' && before.status !== 'starting')
    )
      return;
    void navigate(`/game/combat-v6/hunt/${battleId}`);
  }, [actorId, battleId, isMember, navigate, status, teamId]);
}

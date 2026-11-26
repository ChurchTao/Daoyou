import type {
  HuntCreateTeamSchema,
  HuntTeamCommand,
} from '@daoyou/contracts/hunts';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { z } from 'zod';
import { notifyHuntTeamChanged } from './huntTeamView';
import { huntRequest } from './useHunts';

export function useHuntActions(actorId: string, refresh: () => void) {
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');

  async function act(
    url: string,
    body: HuntTeamCommand | z.infer<typeof HuntCreateTeamSchema>,
  ) {
    if (inFlight.current || !actorId) return;
    inFlight.current = true;
    setPending(true);
    setActionError('');
    try {
      const next = await huntRequest<HuntTeam | null>(url, actorId, body);
      if ('type' in body && body.type === 'start' && next?.battleId)
        void navigate(`/game/combat-v6/hunt/${next.battleId}`);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : '暂时未能办妥，请稍后再试',
      );
    } finally {
      refresh();
      notifyHuntTeamChanged();
      inFlight.current = false;
      setPending(false);
    }
  }

  return { act, pending, actionError };
}

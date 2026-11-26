import type { HuntMine } from '@daoyou/contracts/hunts';
import { useLocation } from 'react-router';
import { useHuntBattleNavigation } from './useHuntBattleNavigation';
import { useHunts } from './useHunts';

export function HuntBattleBridge() {
  return useLocation().pathname === '/game/hunt-team' ? null : (
    <ActiveHuntBattleBridge />
  );
}

function ActiveHuntBattleBridge() {
  const { data, actorId, refresh } = useHunts<HuntMine>('/api/hunts/me');
  useHuntBattleNavigation(data?.team, actorId, refresh);
  return null;
}

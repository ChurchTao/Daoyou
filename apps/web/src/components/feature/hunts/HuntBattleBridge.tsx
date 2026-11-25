import type { HuntMine } from '@daoyou/contracts/hunts';
import { useHuntBattleNavigation } from './useHuntBattleNavigation';
import { useHunts } from './useHunts';

export function HuntBattleBridge() {
  const { data, actorId, refresh } = useHunts<HuntMine>('/api/hunts/me');
  useHuntBattleNavigation(data?.team, actorId, refresh);
  return null;
}

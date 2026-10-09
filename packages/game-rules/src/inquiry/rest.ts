import type { Consumable } from '@daoyou/game-domain/character';
import { isDungeonRecoveryPill } from '../dungeon/rest.js';

export function canUseInquiryRecoveryPill(
  run: { status: string; activeBattleId?: string | null },
  item: Pick<Consumable, 'spec'>,
) {
  return (
    !run.activeBattleId &&
    run.status === 'INVESTIGATING' &&
    isDungeonRecoveryPill(item)
  );
}

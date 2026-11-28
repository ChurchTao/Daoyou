/** Public character facts; callers may supply their existing transaction. */
import type { CultivatorPortraitRef } from '@daoyou/contracts/player/avatar';

export function publicCultivatorPortrait(
  cultivator: (CultivatorPortraitRef & { status: string }) | null | undefined,
): CultivatorPortraitRef | undefined {
  if (!cultivator) return undefined;
  return {
    gender: cultivator.gender,
    avatarId: cultivator.status === 'active' ? cultivator.avatarId : null,
  };
}

export {
  readCraftReadinessFacts,
  readCultivatorName,
  readCultivatorPublicIdentity,
  readCultivatorQi,
  readCultivatorRealm,
  readCultivatorTitles,
  readCultivatorReputation,
} from './application/readers/CultivatorFactsReader.js';

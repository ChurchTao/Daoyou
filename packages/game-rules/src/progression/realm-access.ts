import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { getRealmStageRank } from '@daoyou/game-domain/progression';

const LATE_QI_REFINING = { realm: '炼气', stage: '后期' } as const;

/** 炼气后期及以上。兑换码与拍卖行共用这一门槛。 */
export function hasReachedLateQiRefining(
  realm: RealmType,
  stage: RealmStage,
): boolean {
  return (
    getRealmStageRank(realm, stage) >=
    getRealmStageRank(LATE_QI_REFINING.realm, LATE_QI_REFINING.stage)
  );
}

export const LATE_QI_REDEEM_DENIED = '达到炼气后期后方可兑换';
export const LATE_QI_AUCTION_DENIED = '达到炼气后期后方可使用拍卖行';

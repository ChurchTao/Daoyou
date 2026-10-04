import { REALM_STAGE_VALUES, REALM_VALUES, type RealmStage, type RealmType } from '@daoyou/constants/realms';

export const LEVELS_PER_REALM_STAGE = 5;


export function getRealmStageLevel(realm: RealmType, stage: RealmStage): number {
  return (getRealmStageRank(realm, stage) + 1) * LEVELS_PER_REALM_STAGE;
}


/** 展示数值门槛所需的最低人物境界，与正向映射保持一致。 */
export function getLevelRealmStage(level: number) {
  const rank = Math.min(
    REALM_VALUES.length * REALM_STAGE_VALUES.length - 1,
    Math.max(0, Math.ceil(level / LEVELS_PER_REALM_STAGE) - 1),
  );
  const realm = REALM_VALUES[Math.floor(rank / REALM_STAGE_VALUES.length)];
  const stage = REALM_STAGE_VALUES[rank % REALM_STAGE_VALUES.length];
  return { realm, stage, label: `${realm}${stage}` };
}


export function getRealmStageRank(
  realm: RealmType,
  stage: RealmStage,
): number {
  const realmIndex = REALM_VALUES.indexOf(realm);
  const stageIndex = REALM_STAGE_VALUES.indexOf(stage);
  return Math.max(0, realmIndex) * REALM_STAGE_VALUES.length + Math.max(0, stageIndex);
}

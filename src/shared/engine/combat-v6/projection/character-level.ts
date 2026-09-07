import { getRealmStageRank } from '@shared/config/realmProgression';
export function combatCharacterLevel(
  ...realm: Parameters<typeof getRealmStageRank>
) {
  return (getRealmStageRank(...realm) + 1) * 5;
}

import { BEAST_PROGRESSION } from '@daoyou/game-content/beasts';

export type BeastOriginKind = 'baby' | 'pseudo_baby' | 'wild';
export type BeastIdentity = {
  originKind: BeastOriginKind;
  initialLevel: number;
  level: number;
  isMutant?: boolean;
};
/** 玩家可见类型。`pseudo_baby` 与 `wild` 都写「野生」，点数仍按内部身份计算。 */
export const BEAST_ORIGIN_NAMES = {
  baby: '宝宝',
  pseudo_baby: '野生',
  wild: '野生',
} as const;
export function beastOriginName(
  beast: Pick<BeastIdentity, 'originKind' | 'isMutant'>,
) {
  return beast.isMutant ? '变异' : BEAST_ORIGIN_NAMES[beast.originKind];
}
export function beastBaseAttribute(beast: Pick<BeastIdentity, 'isMutant'>) {
  return BEAST_PROGRESSION.panel.naturalBase * (beast.isMutant ? 2 : 1);
}
export function beastPointBudget(beast: BeastIdentity) {
  return (
    beast.level * BEAST_PROGRESSION.pointsPerLevel +
    (beast.originKind === 'baby' ? 50 : 0) -
    (beast.originKind === 'wild'
      ? 2 * Math.min(beast.level, beast.initialLevel)
      : 0)
  );
}

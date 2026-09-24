import { BEAST_PROGRESSION } from './content';

export type BeastOriginKind = 'baby' | 'pseudo_baby' | 'wild';
export type BeastIdentity = {
  originKind: BeastOriginKind;
  initialLevel: number;
  level: number;
  isMutant?: boolean;
};
export const BEAST_ORIGIN_NAMES = {
  baby: '宝宝',
  pseudo_baby: '假宝宝',
  wild: '纯野生',
} as const;
export function beastOriginName(
  beast: Pick<BeastIdentity, 'originKind' | 'isMutant'>,
) {
  return beast.isMutant ? '变异宝宝' : BEAST_ORIGIN_NAMES[beast.originKind];
}
export function beastBaseAttribute(beast: Pick<BeastIdentity, 'isMutant'>) {
  return BEAST_PROGRESSION.panel.naturalBase * (beast.isMutant ? 2 : 1);
}
export function beastPointBudget(beast: BeastIdentity) {
  return (
    beast.level * BEAST_PROGRESSION.pointsPerLevel +
    (beast.originKind === 'baby' ? 50 : 0) -
    (beast.originKind === 'wild' ? 2 * beast.initialLevel : 0)
  );
}

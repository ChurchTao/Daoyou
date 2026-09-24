import generation from '../../engine/combat-v6/tower/data/generation.json';
/** Encounter budgets belong to the whole group; companions never inherit leader traits. */
export const TOWER_FORMATIONS = {
  solo: {
    label: '独行',
    roles: ['leader'],
    hpShares: [1],
    outputShares: [1],
    hpScale: 1,
  },
  pair: {
    label: '双卫夹击',
    roles: ['leader', 'striker'],
    hpShares: [0.5, 0.5],
    outputShares: [0.5, 0.5],
    hpScale: 1,
  },
  healer: {
    label: '幻侍疗伤',
    roles: ['leader', 'healer'],
    hpShares: [0.7, 0.3],
    outputShares: [0.85, 0.15],
    hpScale: 0.9,
  },
  escort: {
    label: '镜侍护主',
    roles: ['leader', 'guard'],
    hpShares: [0.75, 0.25],
    outputShares: [0.85, 0.15],
    hpScale: 0.9,
  },
  guarded: {
    label: '双侍护主',
    roles: ['leader', 'guard', 'guard'],
    hpShares: [0.7, 0.15, 0.15],
    outputShares: [0.8, 0.1, 0.1],
    hpScale: 0.8,
  },
} as const;
export type TowerFormationId = keyof typeof TOWER_FORMATIONS;
export type TowerEnemyRole =
  (typeof TOWER_FORMATIONS)[TowerFormationId]['roles'][number];
export type TowerKeyFormation = 'solo' | 'healer' | 'guarded';
export function allowedTowerFormations(
  kind: 'elite' | 'boss',
  combo: { style: string; survival: string },
): TowerKeyFormation[] {
  const rule = generation.formationRules.find((r) =>
    Object.entries(r.match).every(
      ([key, value]) => combo[key as keyof typeof combo] === value,
    ),
  );
  if (!rule) throw new Error('幻境缺少阵容生成规则');
  return rule[kind] as TowerKeyFormation[];
}

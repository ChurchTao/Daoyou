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
  if (combo.style === 'seal') return ['solo'];
  return kind === 'boss' && combo.survival !== 'armor'
    ? ['solo', 'healer', 'guarded']
    : ['solo', 'healer'];
}
export const TOWER_HEALER_DETAIL =
  '执灯幻侍每第三回合治疗气血比例最低的友方（可治疗自己），每次回复自身气血上限的 20%，最多三次；其余回合弱攻击，法力耗尽后不再治疗。';
export const TOWER_GUARD_DETAIL =
  '每名存活镜侍在回合开始提供 15% 物理与法术减伤，最多 30%；击杀后下一回合降低。保护不覆盖固定伤害，镜侍只作弱攻击，不会复活。';

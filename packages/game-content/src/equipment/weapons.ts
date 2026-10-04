import type { DaoWeaponType } from '@daoyou/game-domain/equipment';


/** 相对标准剑的器胚区间系数；不作用于人物总面板或治疗属性。 */
export const DAO_WEAPONS = {
  axe: { name: '斧', physicalAtk: 1.15, magicAtk: 0.85 },
  blade: { name: '刀', physicalAtk: 1.12, magicAtk: 0.88 },
  spear: { name: '枪', physicalAtk: 1.09, magicAtk: 0.91 },
  staff: { name: '棍', physicalAtk: 1.03, magicAtk: 0.97 },
  sword: { name: '剑', physicalAtk: 1.0, magicAtk: 1.0 },
  fan: { name: '扇', physicalAtk: 0.94, magicAtk: 1.06 },
  bell: { name: '铃', physicalAtk: 0.91, magicAtk: 1.09 },
  brush: { name: '笔', physicalAtk: 0.88, magicAtk: 1.12 },
  banner: { name: '幡', physicalAtk: 0.85, magicAtk: 1.15 },
} as const satisfies Record<
  DaoWeaponType,
  {
    name: string;
    physicalAtk: number;
    magicAtk: number;
  }
>;

import { REALM_STAGE_CAPS, RealmStage, RealmType } from '../types/constants';
import type { Attributes, Cultivator } from '../types/cultivator';

/**
 * 获取境界属性上限
 */
export function getRealmAttributeCap(realm: RealmType): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) return 100;
  return (
    stageCaps.圆满 ?? stageCaps.后期 ?? stageCaps.中期 ?? stageCaps.初期 ?? 100
  );
}

export function getRealmStageAttributeCap(
  realm: RealmType,
  realmStage: RealmStage,
): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) {
    return getRealmAttributeCap(realm);
  }
  return stageCaps[realmStage] ?? getRealmAttributeCap(realm);
}

/**
 * 计算最终属性（包含先天命格、功法、装备的加成）
 * 返回最终属性以及各来源的加成明细
 */
export interface FinalAttributesResult {
  final: Required<Attributes>;
  maxHp: number;
  maxMp: number;
  breakdown: {
    base: Required<Attributes>;
    fromFates: Required<Attributes>;
    fromCultivations: Required<Attributes>;
    fromEquipment: Required<Attributes>;
    cap: number;
  };
}

// todo 重构
export function calculateFinalAttributes(c: Cultivator): FinalAttributesResult {
  // 基础属性
  const base: Required<Attributes> = {
    vitality: c.attributes.vitality,
    spirit: c.attributes.spirit,
    wisdom: c.attributes.wisdom,
    speed: c.attributes.speed,
    willpower: c.attributes.willpower,
    critRate: 0,
    critDamage: 0,
    damageReduction: 0,
    flatDamageReduction: 0,
    hitRate: 0,
    dodgeRate: 0,
  };

  const cap = getRealmStageAttributeCap(c.realm, c.realm_stage);

  return {
    final: base,
    breakdown: {
      base,
      fromFates: {
        vitality: 0,
        spirit: 0,
        wisdom: 0,
        speed: 0,
        willpower: 0,
        critRate: 0,
        critDamage: 0,
        damageReduction: 0,
        flatDamageReduction: 0,
        hitRate: 0,
        dodgeRate: 0,
      },
      fromCultivations: {
        vitality: 0,
        spirit: 0,
        wisdom: 0,
        speed: 0,
        willpower: 0,
        critRate: 0,
        critDamage: 0,
        damageReduction: 0,
        flatDamageReduction: 0,
        hitRate: 0,
        dodgeRate: 0,
      },
      fromEquipment: {
        vitality: 0,
        spirit: 0,
        wisdom: 0,
        speed: 0,
        willpower: 0,
        critRate: 0,
        critDamage: 0,
        damageReduction: 0,
        flatDamageReduction: 0,
        hitRate: 0,
        dodgeRate: 0,
      },
      cap,
    },
    maxHp: 100 + base.vitality * 10,
    maxMp: 100 + base.spirit * 5,
  };
}

// ===== 内部工具函数 =====
// (大部分解析辅助函数已移除，因改用 Zod Schema 生成)

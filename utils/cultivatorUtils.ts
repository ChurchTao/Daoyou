import { REALM_STAGE_CAPS, RealmStage, RealmType } from '../types/constants';
import type { Attributes, Cultivator } from '../types/cultivator';
// 移除 createCultivatorFromAI，不再需要
export function validateCultivator(c: Partial<Cultivator>): boolean {
  if (!c) return false;
  if (!c.name || !c.gender || !c.realm || !c.realm_stage) return false;
  if (!c.attributes || !c.skills || !c.inventory || !c.equipped) return false;
  if (!c.spiritual_roots || c.spiritual_roots.length === 0) return false;
  return true;
}

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

export function calculateFinalAttributes(c: Cultivator): FinalAttributesResult {
  // 基础属性
  const base: Required<Attributes> = {
    vitality: c.attributes.vitality,
    spirit: c.attributes.spirit,
    wisdom: c.attributes.wisdom,
    speed: c.attributes.speed,
    willpower: c.attributes.willpower,
  };

  // 先天命格加成
  const fromFates: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  for (const fate of c.pre_heaven_fates || []) {
    if (fate.attribute_mod.vitality) {
      fromFates.vitality += fate.attribute_mod.vitality;
    }
    if (fate.attribute_mod.spirit) {
      fromFates.spirit += fate.attribute_mod.spirit;
    }
    if (fate.attribute_mod.wisdom) {
      fromFates.wisdom += fate.attribute_mod.wisdom;
    }
    if (fate.attribute_mod.speed) {
      fromFates.speed += fate.attribute_mod.speed;
    }
    if (fate.attribute_mod.willpower) {
      fromFates.willpower += fate.attribute_mod.willpower;
    }
  }

  // 功法加成（从 effects 中提取 StatModifier）
  const fromCultivations: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  for (const cult of c.cultivations || []) {
    for (const effect of cult.effects ?? []) {
      if (effect.type === 'StatModifier') {
        const params = effect.params as
          | { attribute?: string; value?: number }
          | undefined;
        const attr = params?.attribute as keyof Attributes | undefined;
        const value = params?.value ?? 0;
        if (attr && attr in fromCultivations) {
          fromCultivations[attr] += value;
        }
      }
    }
  }

  // 装备加成
  const fromEquipment: Required<Attributes> = {
    vitality: 0,
    spirit: 0,
    wisdom: 0,
    speed: 0,
    willpower: 0,
  };
  const artifactsById = new Map(
    (c.inventory?.artifacts || []).map((a) => [a.id!, a]),
  );
  const equippedArtifacts = [
    c.equipped.weapon,
    c.equipped.armor,
    c.equipped.accessory,
  ]
    .filter(Boolean)
    .map((id) => artifactsById.get(id!))
    .filter(Boolean) as typeof c.inventory.artifacts;

  for (const art of equippedArtifacts) {
    for (const effect of art.effects ?? []) {
      if (effect.type === 'StatModifier') {
        const params = effect.params as
          | { attribute?: string; value?: number }
          | undefined;
        const attr = params?.attribute as keyof Attributes | undefined;
        const value = params?.value ?? 0;
        if (attr && attr in fromEquipment) {
          fromEquipment[attr] += value;
        }
      }
    }
  }

  // 计算最终属性
  const final: Required<Attributes> = {
    vitality:
      base.vitality +
      fromFates.vitality +
      fromCultivations.vitality +
      fromEquipment.vitality,
    spirit:
      base.spirit +
      fromFates.spirit +
      fromCultivations.spirit +
      fromEquipment.spirit,
    wisdom:
      base.wisdom +
      fromFates.wisdom +
      fromCultivations.wisdom +
      fromEquipment.wisdom,
    speed:
      base.speed +
      fromFates.speed +
      fromCultivations.speed +
      fromEquipment.speed,
    willpower:
      base.willpower +
      fromFates.willpower +
      fromCultivations.willpower +
      fromEquipment.willpower,
  };

  const cap = getRealmStageAttributeCap(c.realm, c.realm_stage);

  return {
    final,
    breakdown: {
      base,
      fromFates,
      fromCultivations,
      fromEquipment,
      cap,
    },
    maxHp: 100 + final.vitality * 10,
    maxMp: 100 + final.spirit * 5,
  };
}

// ===== 内部工具函数 =====
// (大部分解析辅助函数已移除，因改用 Zod Schema 生成)

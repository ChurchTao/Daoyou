import type { Cultivator } from '@/types/cultivator';
import { REALM_ORDER, type RealmType } from '@/types/constants';
import type { AttributeModifierConfig } from '../core/configs';
import { AttributeType, ModifierType, type AttributeModifier, type UnitId } from '../core/types';
import type { AttrsStateView } from '../systems/state/types';
import { Unit } from '../units/Unit';

const ATTRIBUTE_MAP = {
  spirit: AttributeType.SPIRIT,
  vitality: AttributeType.VITALITY,
  speed: AttributeType.SPEED,
  wisdom: AttributeType.WISDOM,
  willpower: AttributeType.WILLPOWER,
} as const;

type ModifierCarrier = {
  id?: string;
  name: string;
  attributeModifiers?: AttributeModifierConfig[];
};

const ARTIFACT_MAIN_PANEL_ATTRS = new Set<AttributeType>([
  AttributeType.ATK,
  AttributeType.MAGIC_ATK,
  AttributeType.DEF,
  AttributeType.MAGIC_DEF,
  AttributeType.MAX_HP,
  AttributeType.MAX_MP,
  AttributeType.SPIRIT,
  AttributeType.VITALITY,
  AttributeType.SPEED,
  AttributeType.WISDOM,
  AttributeType.WILLPOWER,
]);

function getCrossRealmModifierFactor(
  anchorRealm: RealmType | undefined,
  wearerRealm: RealmType,
): number {
  if (!anchorRealm) return 1;
  const diff = REALM_ORDER[anchorRealm] - REALM_ORDER[wearerRealm];
  if (diff <= 0) return 1;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.55;
  if (diff === 3) return 0.45;
  return 0.35;
}

function scaleArtifactModifiers(
  modifiers: AttributeModifierConfig[] | undefined,
  factor: number,
): AttributeModifierConfig[] {
  if (!modifiers?.length || factor >= 0.999) {
    return modifiers ?? [];
  }

  return modifiers.map((modifier) => {
    const shouldScale =
      modifier.type === ModifierType.FIXED &&
      ARTIFACT_MAIN_PANEL_ATTRS.has(modifier.attrType);
    if (!shouldScale) return modifier;
    return {
      ...modifier,
      value: modifier.value * factor,
    };
  });
}

function mountModifiers(
  unit: Unit,
  sourcePrefix: string,
  carrier: ModifierCarrier,
  overrides?: { modifiers?: AttributeModifierConfig[] },
): void {
  const modifiers = overrides?.modifiers ?? carrier.attributeModifiers ?? [];

  for (const [index, modifier] of modifiers.entries()) {
    const mountedModifier: AttributeModifier = {
      id: `${sourcePrefix}:${carrier.id ?? carrier.name}:${modifier.attrType}:${index}`,
      attrType: modifier.attrType,
      type: modifier.type,
      value: modifier.value,
      source: {
        sourceType: sourcePrefix,
        carrierId: carrier.id ?? carrier.name,
      },
    };
    unit.attributes.addModifier(mountedModifier);
  }
}

export function createDisplayUnitFromCultivator(
  cultivator: Cultivator,
  isMirror: boolean = false,
): Unit {
  const baseAttrs: Partial<Record<AttributeType, number>> = {};

  for (const [cultivatorKey, attrType] of Object.entries(ATTRIBUTE_MAP)) {
    baseAttrs[attrType] =
      cultivator.attributes[cultivatorKey as keyof typeof cultivator.attributes] ?? 0;
  }

  const unitId = ((cultivator.id ?? cultivator.name) + (isMirror ? '_mirror' : '')) as UnitId;
  const unitName = isMirror ? `${cultivator.name}的镜像` : cultivator.name;
  const unit = new Unit(unitId, unitName, baseAttrs);

  for (const cultivation of cultivator.cultivations ?? []) {
    mountModifiers(unit, 'gongfa', cultivation);
  }

  const equippedIds = new Set(
    [cultivator.equipped.weapon, cultivator.equipped.armor, cultivator.equipped.accessory].filter(
      Boolean,
    ),
  );
  for (const artifact of cultivator.inventory.artifacts ?? []) {
    if (!artifact.id || !equippedIds.has(artifact.id)) continue;
    const productModel = (artifact.productModel ?? {}) as {
      metadata?: { anchorRealm?: RealmType };
    };
    const factor = getCrossRealmModifierFactor(
      productModel.metadata?.anchorRealm,
      cultivator.realm,
    );
    mountModifiers(unit, 'artifact', artifact, {
      modifiers: scaleArtifactModifiers(artifact.attributeModifiers, factor),
    });
  }

  unit.updateDerivedStats();
  return unit;
}

/**
 * 面向展示层的完整属性视图：直接返回 battle-v5 原生的 AttrsStateView
 * + 基础 5 维 finalBaseAttributes + 资源上限，供角色面板/排行榜/挑战信息展示使用。
 */
export interface CultivatorDisplayAttributes {
  unit: Unit;
  /** battle-v5 原生属性视图（5 维主属性 + 全部派生二级属性） */
  attrs: AttrsStateView;
  /** 最大气血 */
  maxHp: number;
  /** 最大真元/法力 */
  maxMp: number;
  /**
   * 展示层过渡期兼容字段（等价于旧 Attributes 扩展结构），
   * 后续 UI 完成迁移后可删除，改为直接消费 `attrs`。
   */
  finalAttributes: {
    vitality: number;
    spirit: number;
    wisdom: number;
    speed: number;
    willpower: number;
    critRate: number;
    critDamage: number;
    damageReduction: number;
    flatDamageReduction: number;
    hitRate: number;
    dodgeRate: number;
  };
}

function buildAttrsView(unit: Unit): AttrsStateView {
  return {
    spirit: unit.attributes.getValue(AttributeType.SPIRIT),
    vitality: unit.attributes.getValue(AttributeType.VITALITY),
    speed: unit.attributes.getValue(AttributeType.SPEED),
    willpower: unit.attributes.getValue(AttributeType.WILLPOWER),
    wisdom: unit.attributes.getValue(AttributeType.WISDOM),
    atk: unit.attributes.getValue(AttributeType.ATK),
    def: unit.attributes.getValue(AttributeType.DEF),
    magicAtk: unit.attributes.getValue(AttributeType.MAGIC_ATK),
    magicDef: unit.attributes.getValue(AttributeType.MAGIC_DEF),
    critRate: unit.attributes.getValue(AttributeType.CRIT_RATE),
    critDamageMult: unit.attributes.getValue(AttributeType.CRIT_DAMAGE_MULT),
    evasionRate: unit.attributes.getValue(AttributeType.EVASION_RATE),
    controlHit: unit.attributes.getValue(AttributeType.CONTROL_HIT),
    controlResistance: unit.attributes.getValue(
      AttributeType.CONTROL_RESISTANCE,
    ),
    armorPenetration: unit.attributes.getValue(
      AttributeType.ARMOR_PENETRATION,
    ),
    magicPenetration: unit.attributes.getValue(
      AttributeType.MAGIC_PENETRATION,
    ),
    critResist: unit.attributes.getValue(AttributeType.CRIT_RESIST),
    critDamageReduction: unit.attributes.getValue(
      AttributeType.CRIT_DAMAGE_REDUCTION,
    ),
    accuracy: unit.attributes.getValue(AttributeType.ACCURACY),
    healAmplify: unit.attributes.getValue(AttributeType.HEAL_AMPLIFY),
    maxHp: unit.getMaxHp(),
    maxMp: unit.getMaxMp(),
  };
}

export function getCultivatorDisplayAttributes(
  cultivator: Cultivator,
): CultivatorDisplayAttributes {
  const unit = createDisplayUnitFromCultivator(cultivator);
  const attrs = buildAttrsView(unit);

  return {
    unit,
    attrs,
    maxHp: attrs.maxHp,
    maxMp: attrs.maxMp,
    finalAttributes: {
      vitality: attrs.vitality,
      spirit: attrs.spirit,
      wisdom: attrs.wisdom,
      speed: attrs.speed,
      willpower: attrs.willpower,
      critRate: attrs.critRate,
      critDamage: attrs.critDamageMult,
      damageReduction: 0,
      flatDamageReduction: 0,
      hitRate: attrs.accuracy,
      dodgeRate: attrs.evasionRate,
    },
  };
}

export function isBattleV5ModifierType(value: string): value is ModifierType {
  return Object.values(ModifierType).includes(value as ModifierType);
}

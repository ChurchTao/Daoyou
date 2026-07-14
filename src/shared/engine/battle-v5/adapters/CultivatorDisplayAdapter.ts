import type { Cultivator } from '@shared/types/cultivator';
import type { RealmStage, RealmType } from '@shared/types/constants';
import {
  getArtifactWearerRealmFactor,
  scaleArtifactMainPanelFixedModifiers,
} from '@shared/engine/shared/artifactRealmScaling';
import { buildBodyCultivationAttributeModifiers } from '@shared/lib/bodyCultivation/effects';
import { projectSectMethodModifiers } from '@shared/engine/sect';
import { sectRegistry } from '@shared/engine/sect/content';
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

  for (const method of cultivator.sect
    ? projectSectMethodModifiers(cultivator.sect, sectRegistry.require(cultivator.sect.sectId).definition)
    : []) {
    mountModifiers(unit, 'sect-method', {
      id: method.methodId,
      name: method.methodName,
      attributeModifiers: method.modifiers,
    });
  }

  const equippedIds = new Set(
    [cultivator.equipped.weapon, cultivator.equipped.armor, cultivator.equipped.accessory].filter(
      Boolean,
    ),
  );
  for (const artifact of cultivator.inventory.artifacts ?? []) {
    if (!artifact.id || !equippedIds.has(artifact.id)) continue;
    const productModel = (artifact.productModel ?? {}) as {
      metadata?: { anchorRealm?: RealmType; anchorRealmStage?: RealmStage };
    };
    const factor = getArtifactWearerRealmFactor(
      artifact.battleRuntimeMeta?.anchorRealm ??
        productModel.metadata?.anchorRealm,
      artifact.battleRuntimeMeta?.anchorRealmStage ??
        productModel.metadata?.anchorRealmStage,
      cultivator.realm,
      cultivator.realm_stage,
    );
    mountModifiers(unit, 'artifact', artifact, {
      modifiers: scaleArtifactMainPanelFixedModifiers(
        artifact.attributeModifiers,
        factor,
      ),
    });
  }

  mountModifiers(unit, 'bodyCultivation', {
    id: 'body-cultivation',
    name: '肉身炼体',
    attributeModifiers: buildBodyCultivationAttributeModifiers(
      cultivator.condition,
    ),
  });

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
  /** 最大法力 */
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

export interface ResourceView {
  current: number;
  max: number;
  percent: number;
}

export interface CultivatorDisplaySnapshot {
  attrs: AttrsStateView;
  resources: {
    hp: ResourceView;
    mp: ResourceView;
  };
}

function clampResourceCurrent(value: number | undefined, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return max;
  }

  return Math.max(0, Math.min(value, max));
}

function buildResourceView(
  current: number | undefined,
  max: number,
): ResourceView {
  const normalizedCurrent = clampResourceCurrent(current, max);
  const percent =
    max > 0 ? Math.round((normalizedCurrent / max) * 10000) / 100 : 0;

  return {
    current: normalizedCurrent,
    max,
    percent,
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

export function getCultivatorDisplaySnapshot(
  cultivator: Cultivator,
): CultivatorDisplaySnapshot {
  const { attrs } = getCultivatorDisplayAttributes(cultivator);

  return {
    attrs,
    resources: {
      hp: buildResourceView(
        cultivator.condition?.resources.hp.current,
        attrs.maxHp,
      ),
      mp: buildResourceView(
        cultivator.condition?.resources.mp.current,
        attrs.maxMp,
      ),
    },
  };
}

export function isBattleV5ModifierType(value: string): value is ModifierType {
  return Object.values(ModifierType).includes(value as ModifierType);
}

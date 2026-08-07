import { AttributeType, ModifierType, DamageType } from '@shared/engine/battle-v5/core/types';
import { AuraAbility } from '../abilities/AuraAbility';
import { ChanceTriggerAbility } from '../abilities/ChanceTriggerAbility';
import { ConditionalResponseAbility } from '../abilities/ConditionalResponseAbility';

/**
 * 创建"攻击光环"：ally 全员物理攻击 +20%
 */
export function createAttackAura() {
  return new AuraAbility({
    id: 'aura_atk_up',
    name: '攻击光环',
    targetAttr: AttributeType.ATK,
    modifierType: ModifierType.ADD,
    value: 0.2,
  });
}

/**
 * 创建"法力光环"：ally 全员法术攻击 +15%
 */
export function createMagicAura() {
  return new AuraAbility({
    id: 'aura_magic_up',
    name: '灵法光环',
    targetAttr: AttributeType.MAGIC_ATK,
    modifierType: ModifierType.ADD,
    value: 0.15,
  });
}

/**
 * 创建"连击"：攻击时 30% 几率追加一次 0.6 倍物理伤害
 */
export function createCombo() {
  return new ChanceTriggerAbility({
    id: 'combo_strike',
    name: '连击',
    triggerChance: 0.3,
    followUpCoefficient: 0.6,
    followUpAttribute: AttributeType.ATK,
    followUpDamageType: DamageType.PHYSICAL,
  });
}

/**
 * 创建"法术连击"：攻击时 25% 几率追加一次 0.5 倍法术伤害
 */
export function createMagicCombo() {
  return new ChanceTriggerAbility({
    id: 'combo_magic',
    name: '法术连击',
    triggerChance: 0.25,
    followUpCoefficient: 0.5,
    followUpAttribute: AttributeType.MAGIC_ATK,
    followUpDamageType: DamageType.MAGICAL,
  });
}

/**
 * 创建"反击"：受击时 50% 几率反击 0.5 倍物理伤害
 */
export function createCounter() {
  return new ConditionalResponseAbility({
    id: 'counter_strike',
    name: '反击',
    trigger: 'on_damaged',
    chance: 0.5,
    responseCoefficient: 0.5,
    responseAttribute: AttributeType.ATK,
    responseDamageType: DamageType.PHYSICAL,
  });
}

/**
 * 创建"绝境爆发"：血量低于 40% 时触发一次 1.5 倍法术反击
 */
export function createLastStand() {
  return new ConditionalResponseAbility({
    id: 'last_stand',
    name: '绝境爆发',
    trigger: 'hp_below',
    hpThreshold: 0.4,
    responseCoefficient: 1.5,
    responseAttribute: AttributeType.MAGIC_ATK,
    responseDamageType: DamageType.MAGICAL,
  });
}

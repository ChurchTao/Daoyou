/**
 * 角色创建用基础功法 / 神通配置（v2 迁移版）
 *
 * 旧的 EffectConfig 体系已下线，这里使用 v5 的 AttributeModifierConfig（功法被动属性）
 * 与 AbilityConfig（神通主动效果）进行最小可运行的初始化。
 *
 * 待 Phase 6 接入完整的 v2 造物流后，会用 CreationOrchestrator 动态产出，
 * 不再依赖此静态配置。
 */

import type {
  AbilityConfig,
  AttributeModifierConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  AbilityType,
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import type { ElementType } from '@shared/types/constants';
import type { CultivationTechnique, Skill } from '@shared/types/cultivator';
import {
  ensureStarterSkill,
  ensureStarterTechnique,
} from './starterProducts';

function modifier(
  attrType: AttributeType,
  value: number,
): AttributeModifierConfig {
  return { attrType, type: ModifierType.FIXED, value };
}

function buildTechnique(
  name: string,
  element: ElementType,
  modifiers: AttributeModifierConfig[],
): CultivationTechnique {
  return ensureStarterTechnique({
    name,
    element,
    quality: '凡品',
    description: `${element}行气入门之法，可温养经脉、稳固道基。`,
    attributeModifiers: modifiers,
  });
}

function buildAttackSkill(
  name: string,
  element: ElementType,
  baseDamage: number,
  cooldown = 1,
  cost = 5,
): Skill {
  const ability: AbilityConfig = {
    slug: `basic-${element}-${name}`,
    name,
    type: AbilityType.ACTIVE_SKILL,
    tags: ['attack', element],
    mpCost: cost,
    cooldown,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      {
        type: 'damage',
        params: {
          value: {
            base: baseDamage,
            attribute: AttributeType.SPIRIT,
            coefficient: 1.2,
          },
        },
      },
    ],
  };
  return ensureStarterSkill({
    name,
    element,
    quality: '凡品',
    cost,
    cooldown,
    target_self: false,
    description: `${element}灵力凝成一击，乃初入仙途的攻伐手段。`,
    abilityConfig: ability,
  });
}

function buildHealSkill(
  name: string,
  element: ElementType,
  baseHeal: number,
  cooldown = 4,
  cost = 8,
): Skill {
  const ability: AbilityConfig = {
    slug: `basic-${element}-${name}`,
    name,
    type: AbilityType.ACTIVE_SKILL,
    tags: ['heal', element],
    mpCost: cost,
    cooldown,
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      {
        type: 'heal',
        params: {
          value: {
            base: baseHeal,
            attribute: AttributeType.SPIRIT,
            coefficient: 1.0,
          },
          target: 'hp',
        },
      },
    ],
  };
  return ensureStarterSkill({
    name,
    element,
    quality: '凡品',
    cost,
    cooldown,
    target_self: true,
    description: `${element}灵息回护周身，可作自保疗伤之用。`,
    abilityConfig: ability,
  });
}

export const BASIC_TECHNIQUES: Record<ElementType, () => CultivationTechnique> =
  {
    金: () =>
      buildTechnique('金锐功', '金', [
        modifier(AttributeType.VITALITY, 5),
        modifier(AttributeType.SPIRIT, 5),
      ]),
    木: () =>
      buildTechnique('长春功', '木', [
        modifier(AttributeType.VITALITY, 5),
        modifier(AttributeType.WISDOM, 5),
      ]),
    水: () =>
      buildTechnique('玄水诀', '水', [
        modifier(AttributeType.SPIRIT, 5),
        modifier(AttributeType.SPEED, 5),
      ]),
    火: () =>
      buildTechnique('烈阳功', '火', [
        modifier(AttributeType.SPIRIT, 8),
        modifier(AttributeType.WILLPOWER, 2),
      ]),
    土: () =>
      buildTechnique('厚土经', '土', [
        modifier(AttributeType.VITALITY, 8),
        modifier(AttributeType.WILLPOWER, 2),
      ]),
    风: () =>
      buildTechnique('御风诀', '风', [
        modifier(AttributeType.SPEED, 8),
        modifier(AttributeType.WISDOM, 2),
      ]),
    雷: () =>
      buildTechnique('紫雷诀', '雷', [
        modifier(AttributeType.SPIRIT, 5),
        modifier(AttributeType.SPEED, 5),
      ]),
    冰: () =>
      buildTechnique('凝霜诀', '冰', [
        modifier(AttributeType.SPIRIT, 6),
        modifier(AttributeType.WILLPOWER, 4),
      ]),
  };

export const BASIC_SKILLS: Record<ElementType, Skill[]> = {
  金: [buildAttackSkill('金锋术', '金', 12), buildHealSkill('铁皮术', '金', 8)],
  木: [buildAttackSkill('缠绕术', '木', 8), buildHealSkill('回春术', '木', 14)],
  水: [
    buildAttackSkill('冰锥术', '水', 10),
    buildHealSkill('水罩术', '水', 12),
  ],
  火: [buildAttackSkill('烈焰指', '火', 14), buildHealSkill('焰息诀', '火', 8)],
  土: [
    buildAttackSkill('落石术', '土', 11),
    buildHealSkill('厚土护体', '土', 10),
  ],
  风: [buildAttackSkill('风刃', '风', 10), buildHealSkill('清风诀', '风', 9)],
  雷: [buildAttackSkill('紫雷击', '雷', 13), buildHealSkill('雷护身', '雷', 9)],
  冰: [
    buildAttackSkill('寒冰刺', '冰', 11),
    buildHealSkill('冰幕诀', '冰', 10),
  ],
};

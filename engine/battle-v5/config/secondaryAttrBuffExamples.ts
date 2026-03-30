/**
/**
 * V5 二级衍生属性 Buff 配置示例
 *
 * 展示两类用法：
 * A. modifiers 静态加成型 — 激活时直接修改属性值
 * B. listeners 事件驱动型 — 监听战斗事件后触发效果
 *
 * 属性分类：
 * ── 派生型（FIXED modifier 在公式结算值基础上叠加）──
 *   CRIT_RATE           暴击率（0-0.60）：+值提升暴击概率
 *   CRIT_DAMAGE_MULT    暴击伤害（1.25-2.00）：+值提升暴击倍率
 *   EVASION_RATE        闪避率（0-0.50）：+值直接提升闪避概率
 *   DAMAGE_REDUCTION    减伤率（0-0.70）：+值提升减伤（受 ARMOR_PENETRATION 压制）
 *   CONTROL_HIT         控制命中（0-0.80）：+值提升控制成功率
 *   CONTROL_RESISTANCE  控制抗性（0-0.80）：+值降低被控概率和持续时间
 * ── 外部注入型（base=0，完全由 Buff/装备/命格提供）──
 *   ARMOR_PENETRATION      穿透（0-1）：降低目标有效减伤
 *   CRIT_RESIST            抗暴（0-1）：降低攻击方暴击率
 *   CRIT_DAMAGE_REDUCTION  暴击减伤（0-0.5）：降低受到的暴击倍数
 *   ACCURACY               精准（0-0.5）：提高命中、抑制闪避
 *   HEAL_AMPLIFY           治愈强化（≥0）：放大自身施放的治疗量
 *
 * @example
 *   import { BuffFactory } from '../factories/BuffFactory';
 *   import { exampleBuffConfigs } from './secondaryAttrBuffExamples';
 *   const buff = BuffFactory.create(exampleBuffConfigs.penetratingInsight);
 *   unit.buffs.addBuff(buff);
 */

import { EventPriorityLevel } from '../core/events';
import { AttributeType, BuffType, ModifierType } from '../core/types';
import { GameplayTags } from '../core/GameplayTags';
import { StackRule } from '../buffs/Buff';
import { BuffConfig } from '../core/configs';

// ===== A. modifiers 静态加成型 =====

/**
 * 洞察破防（攻击型）
 * 效果：+0.2 穿透率，施法者攻击无视目标 20% 减伤
 */
const penetratingInsight: BuffConfig = {
  id: 'penetrating_insight',
  name: '洞察破防',
  type: BuffType.BUFF,
  duration: 3,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.ARMOR_PENETRATION,
      type: ModifierType.FIXED, // 二级属性 base=0，用 FIXED 直接加值
      value: 0.2,
    },
  ],
};

/**
 * 护命真意（防御型）
 * 效果：+0.15 抗暴率 + +0.1 暴击减伤
 */
const vitalGuardIntent: BuffConfig = {
  id: 'vital_guard_intent',
  name: '护命真意',
  type: BuffType.BUFF,
  duration: 4,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.CRIT_RESIST,
      type: ModifierType.FIXED,
      value: 0.15,
    },
    {
      attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
      type: ModifierType.FIXED,
      value: 0.1,
    },
  ],
};

/**
 * 神行步（身法型）
 * 效果：EVASION_RATE +0.15（在公式基础上额外 +15% 闪避）+ 精准 +0.1
 */
const divineStepAura: BuffConfig = {
  id: 'divine_step_aura',
  name: '神行步',
  type: BuffType.BUFF,
  duration: 2,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.FIXED,
      value: 0.15,
    },
    {
      attrType: AttributeType.ACCURACY,
      type: ModifierType.FIXED,
      value: 0.1,
    },
  ],
};

/**
 * 金刚不坏（减伤型）
 * 效果：DAMAGE_REDUCTION +0.10（在公式基础上额外 +10% 减伤）
 */
const diamondBody: BuffConfig = {
  id: 'diamond_body',
  name: '金刚不坏',
  type: BuffType.BUFF,
  duration: 3,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.DAMAGE_REDUCTION,
      type: ModifierType.FIXED,
      value: 0.1,
    },
  ],
};

/**
 * 矫健身法（抗控型）
 * 效果：CONTROL_RESISTANCE +0.20（在公式基础上额外 +20% 控制抗性）
 */
const ironWillBody: BuffConfig = {
  id: 'iron_will_body',
  name: '矫健身法',
  type: BuffType.BUFF,
  duration: 5,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.CONTROL_RESISTANCE,
      type: ModifierType.FIXED,
      value: 0.2,
    },
  ],
};

/**
 * 慈悲愿力（治愈型）
 * 效果：HEAL_AMPLIFY +0.5，治疗量提升 50%
 */
const mercyVow: BuffConfig = {
  id: 'mercy_vow',
  name: '慈悲愿力',
  type: BuffType.BUFF,
  duration: 4,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  modifiers: [
    {
      attrType: AttributeType.HEAL_AMPLIFY,
      type: ModifierType.FIXED,
      value: 0.5,
    },
  ],
};

// ===== B. listeners 事件驱动型 =====

/**
 * 战意怒潮（受伤响应型）
 * 机制：每次受到伤害后，为自身叠加一层「破防意志」临时 Debuff（最多叠 3 次）。
 *       每层使 ARMOR_PENETRATION 提升 +0.05（最多 +0.15）。
 * 使用场景：持续受伤的近战型修士，越战越勇。
 */
const battleFrenzy: BuffConfig = {
  id: 'battle_frenzy',
  name: '战意怒潮',
  type: BuffType.BUFF,
  duration: 5,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  listeners: [
    {
      id: 'on_damage_taken_gain_penetration',
      eventType: 'DamageTakenEvent',
      scope: 'owner_as_target',
      priority: EventPriorityLevel.COMBAT_LOG,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { requireOwnerAlive: true, skipReflectSource: true },
      effects: [
        {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: 'penetration_stack',
              name: '破防意志',
              type: BuffType.BUFF,
              duration: 3,
              stackRule: StackRule.STACK_LAYER,
              modifiers: [
                {
                  attrType: AttributeType.ARMOR_PENETRATION,
                  type: ModifierType.FIXED,
                  value: 0.05,
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

/**
 * 魂破（命中响应型）
 * 机制：每次命中目标，对目标施加「破魂」Debuff（持续 3 回合，可叠加）。
 *       每层降低目标 CONTROL_RESISTANCE -0.08，使目标更容易被控制。
 * 使用场景：与控制技配合的法系修士。
 */
const soulCrush: BuffConfig = {
  id: 'soul_crush',
  name: '魂破',
  type: BuffType.BUFF,
  duration: 5,
  stackRule: StackRule.REFRESH_DURATION,
  tags: [GameplayTags.BUFF.TYPE_BUFF],
  listeners: [
    {
      id: 'on_hit_reduce_target_resilience',
      eventType: 'DamageTakenEvent',
      scope: 'owner_as_caster',
      priority: EventPriorityLevel.COMBAT_LOG,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { requireOwnerAlive: true },
      effects: [
        {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: 'soul_fragility',
              name: '破魂',
              type: BuffType.DEBUFF,
              duration: 3,
              stackRule: StackRule.STACK_LAYER,
              modifiers: [
                {
                  // 注意：减少属性需传负值
                  attrType: AttributeType.CONTROL_RESISTANCE,
                  type: ModifierType.FIXED,
                  value: -0.08,
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

/**
 * 所有示例配置的命名导出
 */
export const exampleBuffConfigs = {
  // modifiers 静态型
  penetratingInsight,
  vitalGuardIntent,
  divineStepAura,
  diamondBody,
  ironWillBody,
  mercyVow,
  // listeners 事件驱动型
  battleFrenzy,
  soulCrush,
} as const;

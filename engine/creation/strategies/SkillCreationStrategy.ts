/**
 * 技能创建策略 - 蓝图模式
 *
 * AI 只生成创意内容（名称、类型、元素、描述、品阶提示）
 * 数值（威力、消耗、冷却等）由 SkillFactory 根据配置计算
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import {
  ELEMENT_VALUES,
  SKILL_TYPE_VALUES,
  STATUS_EFFECT_VALUES,
} from '@/types/constants';
import type { Skill } from '@/types/cultivator';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { calculateSingleSkillScore } from '@/utils/rankingUtils';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import { SkillFactory } from '../SkillFactory';
import {
  ELEMENT_MATCH_VALUES,
  GRADE_HINT_VALUES,
  SkillBlueprint,
  SkillBlueprintSchema,
  SkillContext,
} from '../types';

export class SkillCreationStrategy implements CreationStrategy<
  SkillBlueprint,
  Skill
> {
  readonly craftType = 'create_skill';

  readonly schemaName = '神通蓝图';

  readonly schemaDescription =
    '描述了神通的名称、类型、元素、描述、品阶提示等创意信息（数值由程序计算）';

  readonly schema = SkillBlueprintSchema;

  async validate(context: CreationContext): Promise<void> {
    const max_skills = context.cultivator.max_skills || 3;
    if (context.cultivator.skills.length >= max_skills) {
      throw new Error(`道友神通已经很多了，如需再创，需要遗忘一些神通。`);
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, userPrompt } = context;

    // 构建灵根信息
    const spiritualRootsDesc = cultivator.spiritual_roots
      .map((r) => `${r.element}(强度${r.strength})`)
      .join('、');

    // 获取武器信息
    const weaponId = cultivator.equipped.weapon;
    const weapon = cultivator.inventory.artifacts.find(
      (a) => a.id === weaponId,
    );
    const weaponDesc = weapon
      ? `${weapon.name}（${weapon.element}属性）`
      : '无（赤手空拳）';

    // 获取命格信息
    const fatesDesc =
      cultivator.pre_heaven_fates?.map((f) => `${f.name}`).join('、') || '无';

    const finalAttributes = calculateFinalAttributes(cultivator);
    const wisdom = finalAttributes.final.wisdom;

    const systemPrompt = `
# Role: 修仙界传功长老 - 神通蓝图设计

你是一位隐世传功长老，负责为修士推演神通蓝图。**你只负责创意设计，具体数值由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何数值**！不要输出 power、cost、cooldown 等数字。
> 程序会根据修士境界、悟性、五行契合度自动计算所有数值。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **type**: ${SKILL_TYPE_VALUES.join(', ')}
- **element**: ${ELEMENT_VALUES.join(', ')}
- **grade_hint**: ${GRADE_HINT_VALUES.join(', ')}（low=黄阶, medium=玄阶, high=地阶, extreme=天阶）
- **element_match_assessment**: ${ELEMENT_MATCH_VALUES.join(', ')}
- **effect_hint.status**: ${STATUS_EFFECT_VALUES.join(', ')}

## 核心规则

### 1. 五行契合度评估
根据修士灵根与技能元素的关系：
- **perfect_match**：灵根强度 >= 70 且武器元素匹配
- **partial_match**：有对应灵根且强度 >= 50
- **no_match**：无对应灵根
- **conflict**：灵根与技能元素相克（如：火元素技能 + 水灵根）

### 2. 品阶提示判定
基于修士境界和心念合理性：
- 炼气期 → 最高 low（黄阶）
- 筑基/金丹 → 最高 medium（玄阶）
- 元婴/化神 → 最高 high（地阶）
- 炼虚及以上 → 可达 extreme（天阶）

### 3. 技能类型规则
- **attack**: 攻击型，effect_hint 应为 { type: 'none' }
- **heal**: 治疗型，effect_hint 应为 { type: 'none' }, target_self: true
- **control**: 控制型，可有 status 效果，duration 由程序决定
- **debuff**: 异常型，可有 status 效果
- **buff**: 增益型，target_self: true

### 4. 命名与描述
- 名称：2-8字，贴合修仙风格，结合五行、武器和意境
- 描述：描述施法过程、视觉效果
- 若五行相克，描述应体现别扭、勉强的感觉

## 禁止行为
- ❌ 不得输出任何数值（power、cost、cooldown、duration 等）
- ❌ 不得自定义枚举值
- ❌ 若境界过低要求极品，应降低 grade_hint
`;

    const userPromptText = `
请为以下修士推演神通蓝图：

<cultivator>
  <realm>${cultivator.realm} ${cultivator.realm_stage}</realm>
  <wisdom>${wisdom}</wisdom>
  <spiritual_roots>${spiritualRootsDesc}</spiritual_roots>
  <weapon>${weaponDesc}</weapon>
  <fates>${fatesDesc}</fates>
</cultivator>

<user_intent>
${userPrompt || '无（自由发挥）'}
</user_intent>

注意：
1. user_intent 仅影响名称、描述、技能类型的选择
2. 请根据灵根判断五行契合度
3. 若心念极其离谱（不符合五行/武器逻辑），使用 conflict 评估并选择 low 品阶
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  /**
   * 将蓝图转化为实际技能
   */
  materialize(blueprint: SkillBlueprint, context: CreationContext): Skill {
    const finalAttributes = calculateFinalAttributes(context.cultivator);

    // 获取武器元素
    const weaponId = context.cultivator.equipped.weapon;
    const weapon = context.cultivator.inventory.artifacts.find(
      (a) => a.id === weaponId,
    );

    const skillContext: SkillContext = {
      realm: context.cultivator.realm,
      realmStage: context.cultivator.realm_stage,
      wisdom: finalAttributes.final.wisdom,
      spiritualRoots: context.cultivator.spiritual_roots,
      weaponElement: weapon?.element,
      fates: context.cultivator.pre_heaven_fates,
    };

    return SkillFactory.materialize(blueprint, skillContext);
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: Skill,
  ): Promise<void> {
    const score = calculateSingleSkillScore(resultItem);
    await tx.insert(skills).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      prompt: context.userPrompt,
      element: resultItem.element,
      grade: resultItem.grade,
      cost: resultItem.cost,
      cooldown: resultItem.cooldown,
      target_self: resultItem.target_self ? 1 : 0,
      description: resultItem.description,
      effects: resultItem.effects ?? [],
      score,
    });
  }
}

/**
 * 技能创建策略
 *
 * 重构后使用 AffixGenerator + EffectMaterializer 生成效果
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import type { ElementType, RealmType, SkillGrade } from '@/types/constants';
import {
  ELEMENT_VALUES,
  SKILL_TYPE_VALUES,
  STATUS_EFFECT_VALUES,
} from '@/types/constants';
import type { Skill, SpiritualRoot } from '@/types/cultivator';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { calculateSingleSkillScore } from '@/utils/rankingUtils';
import { AffixGenerator } from '../AffixGenerator';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  clampGrade,
  ELEMENT_MATCH_MODIFIER,
  GRADE_HINT_TO_GRADES,
  REALM_GRADE_LIMIT,
  SKILL_ELEMENT_CONFLICT,
  wisdomToPowerRatio,
} from '../skillConfig';
import {
  ELEMENT_MATCH_VALUES,
  ElementMatch,
  GRADE_HINT_VALUES,
  GradeHint,
  SkillBlueprint,
  SkillBlueprintSchema,
} from '../types';

export class SkillCreationStrategy implements CreationStrategy<
  SkillBlueprint,
  Skill
> {
  readonly craftType = 'create_skill';

  readonly schemaName = '神通蓝图';

  readonly schemaDescription =
    '描述神通的名称、类型、元素、描述（效果由程序生成）';

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

你是一位隐世传功长老，负责为修士推演神通蓝图。**你只负责创意设计，具体效果由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何数值**！
> 程序会根据修士境界、悟性、五行契合度自动生成所有效果。

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
- **conflict**：灵根与技能元素相克

### 2. 品阶提示判定
基于修士境界：
- 炼气期 → 最高 low（黄阶）
- 筑基/金丹 → 最高 medium（玄阶）
- 元婴/化神 → 最高 high（地阶）
- 炼虚及以上 → 可达 extreme（天阶）

### 3. 技能类型规则
- **attack**: 攻击型，effect_hint 应为 { type: 'none' }
- **heal**: 治疗型，effect_hint 应为 { type: 'none' }, target_self: true
- **control**: 控制型，可有 status 效果
- **debuff**: 减益型，可有 status 效果
- **buff**: 增益型，target_self: true

### 4. 命名与描述
- 名称：2-8字，贴合修仙风格
- 描述：描述施法过程、视觉效果
- 若五行相克，描述应体现别扭的感觉

## 禁止行为
- ❌ 不得输出任何数值
- ❌ 不得自定义枚举值
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
3. 若心念极其离谱，使用 conflict 评估并选择 low 品阶
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
    const wisdom = finalAttributes.final.wisdom;

    // 获取武器元素
    const weaponId = context.cultivator.equipped.weapon;
    const weapon = context.cultivator.inventory.artifacts.find(
      (a) => a.id === weaponId,
    );

    // 1. 计算五行契合度（后端验证）
    const elementMatch = this.calculateElementMatch(
      blueprint.element,
      context.cultivator.spiritual_roots,
      weapon?.element,
    );

    // 2. 确定品阶
    const grade = this.calculateGrade(
      blueprint.grade_hint,
      context.cultivator.realm,
      wisdom,
    );

    // 3. 计算消耗和冷却
    const matchModifier = ELEMENT_MATCH_MODIFIER[elementMatch];

    // 4. 使用 AffixGenerator 生成效果
    const { effects } = AffixGenerator.generateSkillAffixes(
      blueprint.type,
      blueprint.element,
      grade,
      wisdom,
    );

    // 5. 确定目标
    const target_self = ['heal', 'buff'].includes(blueprint.type);

    return {
      name: blueprint.name,
      element: blueprint.element,
      grade,
      // todo 修复
      cost: 0,
      cooldown: 0,
      target_self,
      description: blueprint.description,
      effects,
    };
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

  // ============ 辅助方法 ============

  /**
   * 计算五行契合度
   */
  private calculateElementMatch(
    skillElement: ElementType,
    spiritualRoots: SpiritualRoot[],
    weaponElement?: ElementType,
  ): ElementMatch {
    // 检查五行相克
    const hasConflict = this.checkElementConflict(skillElement, spiritualRoots);
    if (hasConflict) {
      return 'conflict';
    }

    // 检查灵根是否匹配
    const rootMatch = spiritualRoots.find((r) => r.element === skillElement);
    const rootStrength = rootMatch?.strength || 0;

    // 检查武器是否匹配
    const weaponMatch = weaponElement === skillElement;

    // 完美匹配
    if (rootMatch && rootStrength >= 70 && weaponMatch) {
      return 'perfect_match';
    }

    // 部分匹配
    if (rootMatch && rootStrength >= 50) {
      return 'partial_match';
    }

    // 弱匹配
    if (rootMatch) {
      return 'partial_match';
    }

    return 'no_match';
  }

  /**
   * 检查技能元素是否与灵根相克
   */
  private checkElementConflict(
    skillElement: ElementType,
    spiritualRoots: SpiritualRoot[],
  ): boolean {
    const rootElements = spiritualRoots.map((r) => r.element);
    const conflicts = SKILL_ELEMENT_CONFLICT[skillElement] || [];

    for (const rootEl of rootElements) {
      if (conflicts.includes(rootEl)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 计算最终品阶
   */
  private calculateGrade(
    gradeHint: GradeHint,
    realm: RealmType,
    wisdom: number,
  ): SkillGrade {
    // 获取品阶候选列表
    const candidates =
      GRADE_HINT_TO_GRADES[gradeHint] || GRADE_HINT_TO_GRADES['low'];

    // 根据悟性选择品阶
    const wisdomRatio = wisdomToPowerRatio(wisdom);
    const index = Math.min(
      candidates.length - 1,
      Math.floor(wisdomRatio * candidates.length),
    );
    let selectedGrade = candidates[index];

    // 应用境界限制
    const realmLimit = REALM_GRADE_LIMIT[realm];
    selectedGrade = clampGrade(selectedGrade, realmLimit);

    return selectedGrade;
  }
}

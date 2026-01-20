/**
 * 技能创建策略
 *
 * 重构后使用 AI 直接选择词条 ID + EffectMaterializer 数值化
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import type {
  ElementType,
  Quality,
  RealmType,
  SkillGrade,
  SkillType,
} from '@/types/constants';
import {
  ELEMENT_VALUES,
  QUALITY_VALUES,
  SKILL_TYPE_VALUES,
} from '@/types/constants';
import type { Material, Skill, SpiritualRoot } from '@/types/cultivator';
import { calculateSingleSkillScore } from '@/utils/rankingUtils';
import { getSkillAffixPool } from '../affixes/skillAffixes';
import {
  buildAffixTable,
  filterAffixPool,
  materializeAffixesById,
  validateSkillAffixSelection,
} from '../AffixUtils';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  clampGrade,
  GRADE_HINT_TO_GRADES,
  REALM_GRADE_LIMIT,
  SKILL_ELEMENT_CONFLICT,
  calculatePowerRatio,
  ELEMENT_MATCH_MODIFIER,
  SKILL_TYPE_MODIFIERS,
  calculateCooldown,
  calculateBaseCost,
} from '../skillConfig';
import {
  ELEMENT_MATCH_VALUES,
  ElementMatch,
  GRADE_HINT_VALUES,
  GradeHint,
  MaterializationContext,
  SkillBlueprint,
  SkillBlueprintSchema,
} from '../types';

// 技能品阶到品质的映射（用于词条过滤）
const GRADE_TO_QUALITY: Record<string, Quality> = {
  黄阶下品: '灵品',
  黄阶中品: '灵品',
  黄阶上品: '玄品',
  玄阶下品: '玄品',
  玄阶中品: '真品',
  玄阶上品: '真品',
  地阶下品: '地品',
  地阶中品: '地品',
  地阶上品: '天品',
  天阶下品: '天品',
  天阶中品: '仙品',
  天阶上品: '神品',
};

export class SkillCreationStrategy implements CreationStrategy<
  SkillBlueprint,
  Skill
> {
  readonly craftType = 'create_skill';

  readonly schemaName = '神通蓝图';

  readonly schemaDescription =
    '描述神通的名称、类型、元素，并从词条池中选择效果';

  readonly schema = SkillBlueprintSchema;

  async validate(context: CreationContext): Promise<void> {
    const max_skills = context.cultivator.max_skills || 3;
    if (context.cultivator.skills.length >= max_skills) {
      throw new Error(`道友神通已经很多了，如需再创，需要遗忘一些神通。`);
    }

    // New validation: Require at least one 'manual'
    const hasManual = context.materials.some((m) => m.type === 'manual');
    if (!hasManual) {
      throw new Error('参悟神通需消耗功法典籍或残页(type=manual)');
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, userPrompt, materials } = context;

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

    const realm = cultivator.realm as RealmType;

    // 计算基于材料的品质
    const materialQuality = this.calculateMaterialQuality(materials);
    // 估计可能的品质范围（用于词条过滤）
    const estimatedQuality = this.estimateQuality(
      realm,
      materialQuality,
    );

    // 为每种技能类型构建词条提示
    const skillTypePrompts = this.buildSkillTypeAffixPrompts(estimatedQuality);

    const systemPrompt = `
# Role: 修仙界传功长老 - 神通蓝图设计

你是一位隐世传功长老，负责为修士推演神通蓝图。

## 核心指令
**必须完全基于用户提供的【核心材料】（功法残页/典籍）来设计神通。**
神通的类型、元素、描述应参考材料。
例如：使用了“玄冰诀残页”，神通应当是冰系、控制或攻击类型。

## 重要约束

> ⚠️ **你需要从词条池中选择词条ID，程序会自动计算数值！**
> 数值由修士境界、灵根属性和强度、五行契合度及**材料品质**决定，你只需选择合适的词条。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **type**: ${SKILL_TYPE_VALUES.join(', ')}
- **element**: ${ELEMENT_VALUES.join(', ')}
- **grade_hint**: ${GRADE_HINT_VALUES.join(', ')}（low=黄阶, medium=玄阶, high=地阶, extreme=天阶）
- **element_match_assessment**: ${ELEMENT_MATCH_VALUES.join(', ')}

## 当前修士条件

- **境界**: ${realm}
- **灵根**: ${spiritualRootsDesc}
- **核心材料品质**: ${materialQuality}
- **预估品质**: ${estimatedQuality}

## 五行契合度评估规则
- **perfect_match**：灵根强度 >= 70 且武器元素匹配
- **partial_match**：有对应灵根且强度 >= 50
- **no_match**：无对应灵根
- **conflict**：灵根与技能元素相克

## 品阶提示判定
- 炼气期 → 最高 low（黄阶）
- 筑基/金丹 → 最高 medium（玄阶）
- 元婴/化神 → 最高 high（地阶）
- 炼虚及以上 → 可达 extreme（天阶）
*注：若使用高阶材料，可适当放宽判定，选择更高的 grade_hint。*

${skillTypePrompts}

## 选择规则

1. 先选择技能类型（type），然后从对应类型的词条池中选择
2. **主词条**: 必选1个
3. **副词条**: 可选0-1个（部分类型无副词条）
4. 根据修士灵根评估五行契合度

## 命名与描述
- 名称：2-8字，必须源自材料描述。
- 描述：描述施法过程、视觉效果。
- 若五行相克，描述应体现别扭的感觉

## 输出示例

{
  "name": "烈焰斩",
  "type": "attack",
  "element": "火",
  "description": "基于烈火残页领悟，凝聚火焰于剑上，一斩而出...",
  "grade_hint": "medium",
  "element_match_assessment": "partial_match",
  "selected_affixes": {
    "primary": "skill_attack_base_damage",
    "secondary": "skill_attack_execute"
  }
}
`;

    const userPromptText = `
请为以下修士推演神通蓝图：

<cultivator>
  <realm>${cultivator.realm} ${cultivator.realm_stage}</realm>
  <spiritual_roots>${spiritualRootsDesc}</spiritual_roots>
  <weapon>${weaponDesc}</weapon>
  <fates>${fatesDesc}</fates>
</cultivator>

<materials_used>
${context.materials
  .filter((m) => m.type === 'manual')
  .map((m) => `- ${m.name}(${m.rank}): ${m.description || '无描述'}`)
  .join('\n')}
</materials_used>

<user_intent>
${userPrompt || '无（自由发挥，但必须基于材料）'}
</user_intent>

请根据修士特性和用户意图，选择合适的技能类型和词条组合。
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
    const realm = context.cultivator.realm as RealmType;

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
    const materialQuality = this.calculateMaterialQuality(context.materials);
    const grade = this.calculateGrade(
      blueprint.grade_hint,
      realm,
      blueprint.element,
      context.cultivator.spiritual_roots,
      materialQuality,
    );

    // 3. 获取对应技能类型的词条池
    const affixPool = getSkillAffixPool(blueprint.type);
    const quality = GRADE_TO_QUALITY[grade] || '玄品';

    // 4. 校验词条选择
    const validation = validateSkillAffixSelection(
      blueprint.selected_affixes.primary,
      blueprint.selected_affixes.secondary,
      affixPool.primary,
      affixPool.secondary,
      quality,
    );

    if (!validation.valid) {
      console.warn('词条选择校验警告:', validation.errors);
    }

    // 5. 构建数值化上下文
    // 获取匹配灵根的强度
    const matchingRoot = context.cultivator.spiritual_roots.find(
      (r) => r.element === blueprint.element,
    );
    const matContext: MaterializationContext = {
      realm,
      quality,
      element: blueprint.element,
      spiritualRootStrength: matchingRoot?.strength || 0,
      hasMatchingElement: !!matchingRoot,
      skillGrade: grade,
      elementMatch,
    };

    // 6. 数值化选中的词条
    const primaryEffects = materializeAffixesById(
      [blueprint.selected_affixes.primary],
      affixPool.primary,
      matContext,
    );

    const secondaryEffects =
      blueprint.selected_affixes.secondary && affixPool.secondary.length > 0
        ? materializeAffixesById(
            [blueprint.selected_affixes.secondary],
            affixPool.secondary,
            matContext,
          )
        : [];

    const effects = [...primaryEffects, ...secondaryEffects];

    // 7. 确定目标
    const target_self = ['heal', 'buff'].includes(blueprint.type);

    // 8. 计算技能威力（用于计算 cost 和 cooldown）
    // 获取技能类型修正系数
    const typeModifier = SKILL_TYPE_MODIFIERS[blueprint.type] || SKILL_TYPE_MODIFIERS.attack;

    // 计算基础威力：从 Damage/Heal 效果中提取数值
    let basePower = 100; // 默认基础威力
    for (const effect of effects) {
      if (effect.type === 'Damage' && effect.params) {
        // Damage 类型有 multiplier 属性
        const params = effect.params as { multiplier?: number };
        if (params.multiplier) {
          basePower = Math.max(basePower, params.multiplier * 100);
        }
      } else if (effect.type === 'Heal' && effect.params) {
        // Heal 类型有 multiplier 属性
        const params = effect.params as { multiplier?: number };
        if (params.multiplier) {
          basePower = Math.max(basePower, params.multiplier * 80); // 治疗威力稍低
        }
      } else if (effect.type === 'TrueDamage' && effect.params) {
        // TrueDamage 类型有 baseDamage 属性
        const params = effect.params as { baseDamage?: number };
        if (params.baseDamage) {
          basePower = Math.max(basePower, params.baseDamage * 0.8);
        }
      }
    }

    // 应用技能类型修正
    const typeAdjustedPower = basePower * typeModifier.power_mult;

    // 应用五行契合度修正
    const elementModifier = ELEMENT_MATCH_MODIFIER[elementMatch];
    const finalPower = typeAdjustedPower * elementModifier.power;

    // 计算消耗（五行契合度影响消耗）
    const baseCost = calculateBaseCost(finalPower);
    const cost = Math.floor(baseCost * elementModifier.cost);

    // 计算冷却
    const cooldown = calculateCooldown(finalPower);

    return {
      name: blueprint.name,
      element: blueprint.element,
      grade,
      cost,
      cooldown,
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

  private calculateMaterialQuality(materials: Material[]): Quality {
    const manuals = materials.filter((m) => m.type === 'manual');
    if (manuals.length === 0) return '凡品';

    // 取最高品质
    let maxIndex = 0;
    for (const mat of manuals) {
      const index = QUALITY_VALUES.indexOf(mat.rank);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
    return QUALITY_VALUES[maxIndex];
  }

  /**
   * 根据境界和材料品质估计品质
   */
  private estimateQuality(
    realm: RealmType,
    materialQuality: Quality,
  ): Quality {
    const realmIndex = [
      '炼气',
      '筑基',
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ].indexOf(realm);

    let baseQualityIndex = Math.min(realmIndex + 1, QUALITY_VALUES.length - 1);

    // 材料品质修正
    const matIndex = QUALITY_VALUES.indexOf(materialQuality);
    if (matIndex > baseQualityIndex) {
      baseQualityIndex = Math.floor((baseQualityIndex + matIndex) / 2);
    }

    return QUALITY_VALUES[baseQualityIndex];
  }

  /**
   * 为每种技能类型构建词条提示
   */
  private buildSkillTypeAffixPrompts(quality: Quality): string {
    const parts: string[] = [];

    for (const skillType of SKILL_TYPE_VALUES) {
      const pool = getSkillAffixPool(skillType as SkillType);
      const filteredPrimary = filterAffixPool(pool.primary, quality);
      const filteredSecondary = filterAffixPool(pool.secondary, quality);

      parts.push(
        `### ${this.getSkillTypeName(skillType)} (type="${skillType}")\n`,
      );

      parts.push('**主词条 (必选1个):**\n');
      parts.push(buildAffixTable(filteredPrimary, { showSlots: false }));
      parts.push('');

      if (filteredSecondary.length > 0) {
        parts.push('**副词条 (可选0-1个):**\n');
        parts.push(buildAffixTable(filteredSecondary, { showSlots: false }));
      } else {
        parts.push('**副词条:** 无');
      }
      parts.push('\n---\n');
    }

    return parts.join('\n');
  }

  /**
   * 获取技能类型中文名
   */
  private getSkillTypeName(type: string): string {
    const names: Record<string, string> = {
      attack: '攻击型',
      heal: '治疗型',
      control: '控制型',
      debuff: '减益型',
      buff: '增益型',
    };
    return names[type] || type;
  }

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
    element: ElementType,
    spiritualRoots: SpiritualRoot[],
    materialQuality: Quality,
  ): SkillGrade {
    // 获取品阶候选列表
    const candidates =
      GRADE_HINT_TO_GRADES[gradeHint] || GRADE_HINT_TO_GRADES['low'];

    // 获取匹配灵根的强度
    const matchingRoot = spiritualRoots.find((r) => r.element === element);
    const rootStrength = matchingRoot?.strength || 0;
    const hasMatching = !!matchingRoot;

    // 根据境界、材料、灵根计算威力系数
    const powerRatio = calculatePowerRatio(
      realm,
      materialQuality,
      rootStrength,
      hasMatching,
    );

    const index = Math.min(
      candidates.length - 1,
      Math.floor(powerRatio * candidates.length),
    );
    let selectedGrade = candidates[index];

    // 应用境界限制
    const realmLimit = REALM_GRADE_LIMIT[realm];
    selectedGrade = clampGrade(selectedGrade, realmLimit);

    return selectedGrade;
  }
}

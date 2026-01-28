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
  calculateBaseCost,
  calculateCooldown,
  calculateRealmDiscount,
  applyGradeDiscount,
  clampGrade,
  ELEMENT_MATCH_MODIFIER,
  GRADE_TO_RANK,
  QUALITY_TO_BASE_GRADE,
  QUALITY_TO_NUMERIC_LEVEL,
  RANK_TO_GRADE,
  REALM_GRADE_LIMIT,
  SKILL_ELEMENT_CONFLICT,
  SKILL_TYPE_MODIFIERS,
} from '../skillConfig';
import {
  ElementMatch,
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
    const { userPrompt, materials } = context;

    // 计算基于材料的品质
    const materialQuality = this.calculateMaterialQuality(materials);
    const estimatedQuality = this.estimateQuality(
      (context.cultivator.realm as RealmType),
      materialQuality,
    );

    // 为每种技能类型构建词条提示
    const skillTypePrompts = this.buildSkillTypeAffixPrompts(estimatedQuality);

    const systemPrompt = `
# Role: 传功长老 - 神通蓝图设计

你是一位隐世传功长老，负责为修士推演神通蓝图。

## 核心指令
**神通的词条选择完全由【核心材料】的特性决定。**
- 分析材料描述，选择最能体现材料特性的词条
- 不要考虑使用者的灵根、境界、武器等因素

## 材料特性判断规则
根据材料的**名称意境**和**描述内容**推断其特性：

### 元素属性判断
| 名称/描述意境 | 元素 | 词条倾向 |
|--------------|------|---------|
| 烈/焚/灼/阳/日/赤/朱雀 | 火 | 火系攻击、燃烧伤害 |
| 寒/冰/霜/雪/冥/玄武 | 冰 | 冰系控制、冻结伤害 |
| 雷/电/霹雳/紫霄/青雷 | 雷 | 雷系爆发、高额伤害 |
| 风/岚/飓/巽/青鸾 | 风 | 闪避、速度、连续攻击 |
| 剑/锋/斩/破/金 | 金 | 物理爆发、破甲、斩杀 |
| 毒/蚀/煞/幽/冥 | 毒/暗 | 持续伤害、削弱 |
| 御/守/甲/罡/盾 | 土/防御 | 护盾、防御力提升 |
| 生/愈/泉/春/青木 | 木/生命 | 治疗、生命恢复 |

### 功能类型判断
| 名称/描述意境 | 类型 | 词条选择 |
|--------------|------|---------|
| 斩/决/杀/破/灭 | 攻击型 | 伤害类主词条 |
| 御/守/护/体/罡 | 增益型 | 防御/属性提升 |
| 封/困/锁/禁 | 控制型 | 控制效果 |
| 疗/愈/生/回 | 治疗型 | 治疗效果 |
| 蚀/衰/弱/煞 | 减益型 | 削弱效果 |

### 判断逻辑
1. 先从名称中提取**核心字**（通常是2-3个关键字）
2. 根据核心字判断**元素属性**和**功能倾向**
3. 从对应类型的词条池中选择最匹配的词条ID
4. 如果描述中有更具体的说明（如"凝聚火焰"），以描述为准

## 输出格式
只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **type**: ${SKILL_TYPE_VALUES.join(', ')}
- **element**: ${ELEMENT_VALUES.join(', ')}

${skillTypePrompts}

## 核心材料
<core_materials>
${materials
  .filter((m) => m.type === 'manual')
  .map((m) => this.buildMaterialPrompt(m))
  .join('\n\n')}
</core_materials>

## 用户意图
${userPrompt || '无（自由发挥，但必须基于材料特性）'}

## 选择规则
1. 先分析材料的核心特性（攻击/控制/治疗/辅助）
2. 从对应类型的词条池中选择最匹配的词条ID
3. 主词条必须体现材料的核心特性
4. 副词条可选0-1个，也应与材料相关

## 输出示例
{
  "name": "烈焰斩",
  "type": "attack",
  "element": "火",
  "description": "基于【烈火残页】领悟，凝聚火焰于剑上，一斩而出...",
  "selected_affixes": {
    "primary": "skill_attack_fire_damage",
    "secondary": "skill_attack_execute"
  }
}
`;

    const userPromptText = '请根据上述材料特性，推演神通蓝图。';

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

    // 2. 确定品阶（不再使用 grade_hint，由材料品质决定）
    const materialQuality = this.calculateMaterialQuality(context.materials);
    const grade = this.calculateGrade(
      null, // 不再使用 grade_hint
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
    const typeModifier =
      SKILL_TYPE_MODIFIERS[blueprint.type] || SKILL_TYPE_MODIFIERS.attack;

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
  private estimateQuality(realm: RealmType, materialQuality: Quality): Quality {
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
   * 构建材料提示信息
   * 将材料信息格式化为AI可理解的格式
   */
  private buildMaterialPrompt(material: Material): string {
    const qualityLevel = QUALITY_TO_NUMERIC_LEVEL[material.rank];
    return `
- 名称：${material.name}
- 品质等级：${material.rank}（${qualityLevel}级）
- 描述：${material.description || '无描述'}
  `.trim();
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
   * 计算最终品阶（重构版）
   * - 材料品质决定基准品阶（70%权重）
   * - 境界差距带来折扣
   * - 灵根契合度微调（±1个小阶位）
   */
  private calculateGrade(
    _gradeHint: GradeHint | null,
    realm: RealmType,
    element: ElementType,
    spiritualRoots: SpiritualRoot[],
    materialQuality: Quality,
  ): SkillGrade {
    // 步骤1: 获取材料基准品阶
    const materialGrade = QUALITY_TO_BASE_GRADE[materialQuality] || '黄阶下品';

    // 步骤2: 计算境界折扣系数
    const realmDiscount = calculateRealmDiscount(materialGrade, realm);

    // 步骤3: 应用折扣
    let finalGrade = applyGradeDiscount(materialGrade, realmDiscount);

    // 步骤4: 灵根契合度微调
    const matchingRoot = spiritualRoots.find((r) => r.element === element);
    if (matchingRoot && matchingRoot.strength >= 70) {
      // 高契合度：提升1个小阶位（如"玄阶下品"→"玄阶中品"）
      const currentRank = GRADE_TO_RANK[finalGrade];
      if (currentRank < 12) {
        finalGrade = RANK_TO_GRADE[currentRank + 1];
      }
    }

    // 步骤5: 应用境界绝对上限（不被突破）
    const realmLimit = REALM_GRADE_LIMIT[realm];
    finalGrade = clampGrade(finalGrade, realmLimit);

    return finalGrade;
  }
}

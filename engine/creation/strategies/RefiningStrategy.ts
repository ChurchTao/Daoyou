/**
 * 法宝炼制策略
 *
 * 重构后使用 AI 直接选择词条 ID + EffectMaterializer 数值化
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { artifacts } from '@/lib/drizzle/schema';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
} from '@/types/constants';
import {
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  QUALITY_VALUES,
} from '@/types/constants';
import type { Artifact } from '@/types/cultivator';
import { calculateSingleArtifactScore } from '@/utils/rankingUtils';
import { ARTIFACT_AFFIX_POOL } from '../affixes/artifactAffixes';
import {
  buildAffixSelectionPrompt,
  filterAffixPool,
  generateCurseAffix,
  getMaxSecondaryAffixCount,
  getPrimaryAffixCount,
  materializeAffixesById,
  validateArtifactAffixSelection,
} from '../AffixUtils';
import { hasElementConflict } from '../creationConfig';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  ArtifactBlueprint,
  ArtifactBlueprintSchema,
  MaterializationContext,
} from '../types';

export class RefiningStrategy implements CreationStrategy<
  ArtifactBlueprint,
  Artifact
> {
  readonly craftType = 'refine';

  readonly schemaName = '法宝蓝图';

  readonly schemaDescription =
    '描述法宝的名称、描述、槽位，并从词条池中选择效果';

  readonly schema = ArtifactBlueprintSchema;

  async validate(context: CreationContext): Promise<void> {
    if (context.materials.length === 0) {
      throw new Error('炼器需要至少一种材料');
    }
    if (context.materials.length > 5) {
      throw new Error('炼器需要至多五种材料');
    }
    if (context.materials.some((m) => m.type === 'herb')) {
      const herb = context.materials.find((m) => m.type === 'herb');
      throw new Error(`道友慎重，${herb?.name}不适合炼器`);
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, materials, userPrompt } = context;
    const realm = cultivator.realm as RealmType;
    const quality = this.calculateQuality(materials);

    // 检测材料是否有元素相克
    const elements = materials.map((m) => m.element).filter(Boolean);
    const hasConflict = hasElementConflict(elements as string[]);

    // 推断可能的槽位（让 AI 选择，但我们可以提供建议）
    const suggestedSlot = this.suggestSlot(materials);

    // 计算词条数量限制
    const primaryCount = getPrimaryAffixCount(quality);
    const maxSecondaryCount = getMaxSecondaryAffixCount(quality, realm);

    // 过滤词条池（根据品质，槽位由AI选择后在materialize中再次校验）
    const filteredPrimary = filterAffixPool(
      ARTIFACT_AFFIX_POOL.primary,
      quality,
    );
    const filteredSecondary = filterAffixPool(
      ARTIFACT_AFFIX_POOL.secondary || [],
      quality,
    );

    // 构建词条选择提示
    const affixPrompt = buildAffixSelectionPrompt(
      filteredPrimary,
      filteredSecondary,
      { min: 1, max: primaryCount },
      { min: 0, max: maxSecondaryCount },
      { showSlots: true, showQuality: true },
    );

    const systemPrompt = `
# Role: 修仙界炼器宗师 - 法宝蓝图设计

你是一位隐世炼器宗师，负责为修士设计法宝蓝图。**你负责创意设计和选择词条，具体数值由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你需要从词条池中选择词条ID，程序会自动计算数值！**
> 数值由材料品质和修士境界决定，你只需选择合适的词条组合。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **slot**: ${EQUIPMENT_SLOT_VALUES.join(', ')}
- **element_affinity**: ${ELEMENT_VALUES.join(', ')}

## 当前炼制条件

- **材料最高品质**: ${quality}
- **修士境界**: ${realm}
- **主词条数量**: 1-${primaryCount}个
- **副词条数量**: 0-${maxSecondaryCount}个
- **建议槽位**: ${suggestedSlot}

${affixPrompt}

## 选择规则

1. **主词条**: 从"可选主词条"中选择 1-${primaryCount} 个词条ID
2. **副词条**: 从"可选副词条"中选择 0-${maxSecondaryCount} 个词条ID
3. **槽位限制**: 注意每个词条的槽位要求，选择后会在程序中校验
4. **品质限制**: 只能选择符合当前品质要求的词条

## 命名与描述
- 名称：2-10字，古风霸气，结合材料特性
- 描述：50-150字，描述材料、炼制过程、外观、气息
${hasConflict ? '\n### ⚠️ 材料相克警告\n检测到投入的材料存在五行相克！描述中应体现法宝的不稳定或反噬风险。诅咒效果将由程序自动添加。' : ''}

## 输出示例

{
  "name": "赤焰流光剑",
  "description": "以赤焰石为魂，玄铁为骨...",
  "slot": "weapon",
  "element_affinity": "火",
  "selected_affixes": {
    "primary": ["artifact_p_spirit_fixed"],
    "secondary": ["artifact_s_burn_on_hit"]
  }
}
`;

    const userPromptText = `
请为以下修士设计法宝蓝图：

<cultivator>
  <realm>${cultivator.realm} ${cultivator.realm_stage}</realm>
</cultivator>

<materials>
${materials.map((m) => `  - ${m.name}(${m.rank}) 元素:${m.element || '无'} 类型:${m.type} 描述:${m.description || '无'}`).join('\n')}
</materials>

<user_intent>
${userPrompt || '无'}
</user_intent>

请根据材料特性和用户意图，选择合适的词条组合并设计法宝。
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  /**
   * 将蓝图转化为实际法宝
   */
  materialize(
    blueprint: ArtifactBlueprint,
    context: CreationContext,
  ): Artifact {
    const realm = context.cultivator.realm as RealmType;
    const quality = this.calculateQuality(context.materials);
    const element = this.determineElement(
      blueprint.element_affinity,
      context.materials,
    );
    const slot = blueprint.slot as EquipmentSlot;

    // 1. 校验词条选择
    const validation = validateArtifactAffixSelection(
      blueprint.selected_affixes.primary,
      blueprint.selected_affixes.secondary,
      ARTIFACT_AFFIX_POOL.primary,
      ARTIFACT_AFFIX_POOL.secondary || [],
      quality,
      slot,
      realm,
    );

    if (!validation.valid) {
      // 如果校验失败，记录警告但继续使用有效的词条
      console.warn('词条选择校验警告:', validation.errors);
    }

    // 2. 构建数值化上下文
    const matContext: MaterializationContext = {
      realm,
      quality,
      element,
    };

    // 3. 数值化选中的词条
    const primaryEffects = materializeAffixesById(
      blueprint.selected_affixes.primary,
      ARTIFACT_AFFIX_POOL.primary,
      matContext,
    );
    const secondaryEffects = materializeAffixesById(
      blueprint.selected_affixes.secondary,
      ARTIFACT_AFFIX_POOL.secondary || [],
      matContext,
    );

    const effects = [...primaryEffects, ...secondaryEffects];

    // 4. 检查五行相克，添加诅咒效果
    const elements = context.materials.map((m) => m.element);
    if (hasElementConflict(elements)) {
      const cursePool = ARTIFACT_AFFIX_POOL.curse ?? [];
      const curseEffects = generateCurseAffix(cursePool, matContext);
      effects.push(...curseEffects);
    }

    return {
      name: blueprint.name,
      slot: blueprint.slot,
      element,
      quality,
      required_realm: realm,
      description: blueprint.description,
      effects,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: Artifact,
  ): Promise<void> {
    const score = calculateSingleArtifactScore(resultItem);
    await tx.insert(artifacts).values({
      cultivatorId: context.cultivator.id!,
      prompt: context.userPrompt,
      name: resultItem.name,
      slot: resultItem.slot,
      quality: resultItem.quality,
      required_realm: resultItem.required_realm,
      element: resultItem.element,
      description: resultItem.description,
      effects: resultItem.effects ?? [],
      score,
    });
  }

  // ============ 辅助方法 ============

  /**
   * 根据材料计算品质（取材料中的最高品质）
   */
  private calculateQuality(materials: CreationContext['materials']): Quality {
    let maxIndex = 0;
    for (const mat of materials) {
      const rank = mat.rank as Quality;
      const index = QUALITY_VALUES.indexOf(rank);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
    return QUALITY_VALUES[maxIndex];
  }

  /**
   * 根据材料类型建议槽位
   */
  private suggestSlot(materials: CreationContext['materials']): string {
    // 简单的槽位推荐逻辑
    const types = materials.map((m) => m.type);
    if (types.includes('ore')) {
      return 'weapon 或 armor';
    }
    if (types.includes('tcdb')) {
      return 'accessory';
    }
    return 'weapon/armor/accessory (根据材料特性选择)';
  }

  /**
   * 确定物品元素
   */
  private determineElement(
    affinityHint: string | undefined,
    materials: CreationContext['materials'],
  ): ElementType {
    // 优先使用 AI 提示的元素
    if (affinityHint) {
      return affinityHint as ElementType;
    }

    // 从材料中推断
    for (const mat of materials) {
      if (mat.element) {
        return mat.element as ElementType;
      }
    }

    // 默认随机
    const elements: ElementType[] = ['金', '木', '水', '火', '土'];
    return elements[Math.floor(Math.random() * elements.length)];
  }
}

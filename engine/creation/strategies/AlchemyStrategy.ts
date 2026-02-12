/**
 * 丹药炼制策略
 *
 * 重构后使用 AI 直接选择词条 ID + EffectMaterializer 数值化
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { consumables } from '@/lib/drizzle/schema';
import { isAnyManual } from '@/engine/material/materialTypeUtils';
import type { Quality, RealmType } from '@/types/constants';
import { QUALITY_VALUES } from '@/types/constants';
import type { Consumable } from '@/types/cultivator';
import { calculateSingleElixirScore } from '@/utils/rankingUtils';
import { CONSUMABLE_AFFIX_POOL } from '../affixes/consumableAffixes';
import {
  buildAffixTable,
  filterAffixPool,
  materializeAffixesById,
  validateConsumableAffixSelection,
} from '../AffixUtils';
import { QUANTITY_HINT_MAP } from '../creationConfig';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  ConsumableBlueprint,
  ConsumableBlueprintSchema,
  MaterializationContext,
} from '../types';

export class AlchemyStrategy implements CreationStrategy<
  ConsumableBlueprint,
  Consumable
> {
  readonly craftType = 'alchemy';

  readonly schemaName = '丹药蓝图';

  readonly schemaDescription = '描述丹药的名称、描述，并从词条池中选择效果';

  readonly schema = ConsumableBlueprintSchema;

  async validate(context: CreationContext): Promise<void> {
    if (context.materials.length === 0) {
      throw new Error('炼丹需要至少一种药材');
    }
    if (context.materials.length > 5) {
      throw new Error('炼丹需要最多五种药材');
    }
    if (context.materials.some((m) => m.type === 'ore')) {
      const ore = context.materials.find((m) => m.type === 'ore');
      throw new Error(`道友慎重，${ore?.name}不适合炼丹`);
    }
    if (context.materials.some((m) => isAnyManual(m.type))) {
      const manual = context.materials.find((m) => isAnyManual(m.type));
      throw new Error(`道友慎重，${manual?.name}是典籍秘卷，不宜投入丹炉`);
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, materials, userPrompt } = context;
    const realm = cultivator.realm as RealmType;
    const quality = this.calculateQuality(materials);

    const materialsDesc = materials
      .map(
        (m) =>
          `- ${m.name}(${m.rank}) 元素:${m.element || '无'} 类型:${m.type} 描述:${m.description || '无'}`,
      )
      .join('\n');

    // 过滤词条池
    const filteredPrimary = filterAffixPool(
      CONSUMABLE_AFFIX_POOL.primary,
      quality,
    );
    const filteredSecondary = filterAffixPool(
      CONSUMABLE_AFFIX_POOL.secondary || [] || [],
      quality,
    );

    // 构建词条表格
    const primaryTable = buildAffixTable(filteredPrimary, { showSlots: false });
    const secondaryTable =
      filteredSecondary.length > 0
        ? buildAffixTable(filteredSecondary, { showSlots: false })
        : '（当前品质无可用副词条）';

    const systemPrompt = `
# Role: 修仙界丹道宗师 - 丹药蓝图设计

你是一位隐世丹道宗师，负责为修士设计丹药蓝图。**你负责创意设计和选择词条，具体数值由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你需要从词条池中选择词条ID，程序会自动计算数值！**
> 数值由材料品质和修士境界决定，你只需选择合适的词条。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

## 当前炼制条件

- **材料最高品质**: ${quality}
- **修士境界**: ${realm}

## 可选主词条 (必选1个)

${primaryTable}

## 可选副词条 (可选0-1个)

${secondaryTable}

## 选择规则

1. **主词条**: 从"可选主词条"中选择 1 个词条ID（必选）
2. **副词条**: 从"可选副词条"中选择 0-1 个词条ID（可选，真品以上更容易出现）
3. **成丹数量提示**:
   - 低品材料 → batch（2-3颗）
   - 中品材料 → medium（1-2颗）
   - 高品材料（地品以上） → single（1颗）

## 命名与描述
- 名称：2-10字，古朴典雅（如"九转凝魄丹"）
- 描述：30-100字，描述丹色、丹香或服用感
- **不得编造未提供的材料**

## 输出示例

\`\`\`json
{
  "name": "凝魄丹",
  "description": "丹呈青白色，散发淡淡药香...",
  "quantity_hint": "medium",
  "selected_affixes": {
    "primary": "consumable_p_vitality",
    "secondary": "consumable_s_heal"
  }
}
\`\`\`
`;

    const userPromptText = `
请为以下修士设计丹药蓝图：

<cultivator>
  <realm>${cultivator.realm}</realm>
  <realm_stage>${cultivator.realm_stage}</realm_stage>
</cultivator>

<materials>
${materialsDesc}
</materials>

<user_intent>
${userPrompt || '无'}
</user_intent>

请根据材料特性和用户意图，选择合适的词条并设计丹药。
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  /**
   * 将蓝图转化为实际丹药
   */
  materialize(
    blueprint: ConsumableBlueprint,
    context: CreationContext,
  ): Consumable {
    const realm = context.cultivator.realm as RealmType;
    const quality = this.calculateQuality(context.materials);

    // 1. 校验词条选择
    const validation = validateConsumableAffixSelection(
      blueprint.selected_affixes.primary,
      blueprint.selected_affixes.secondary,
      CONSUMABLE_AFFIX_POOL.primary,
      CONSUMABLE_AFFIX_POOL.secondary || [],
      quality,
    );

    if (!validation.valid) {
      console.warn('词条选择校验警告:', validation.errors);
    }

    // 2. 构建数值化上下文
    const matContext: MaterializationContext = {
      realm,
      quality,
    };

    // 3. 数值化选中的词条
    const primaryEffects = materializeAffixesById(
      [blueprint.selected_affixes.primary],
      CONSUMABLE_AFFIX_POOL.primary,
      matContext,
    );

    const secondaryEffects = blueprint.selected_affixes.secondary
      ? materializeAffixesById(
          [blueprint.selected_affixes.secondary],
          CONSUMABLE_AFFIX_POOL.secondary || [],
          matContext,
        )
      : [];

    const effects = [...primaryEffects, ...secondaryEffects];

    // 4. 确定成丹数量
    const quantityRange =
      QUANTITY_HINT_MAP[blueprint.quantity_hint] || QUANTITY_HINT_MAP['single'];
    let quantity = this.randomInt(quantityRange.min, quantityRange.max);

    // 高品质丹药降低数量
    if (['地品', '天品', '仙品', '神品'].includes(quality) && quantity > 1) {
      quantity = 1;
    }

    return {
      name: blueprint.name,
      type: '丹药',
      quality,
      effects,
      quantity,
      description: blueprint.description,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: Consumable,
  ): Promise<void> {
    const score = calculateSingleElixirScore(resultItem);
    await tx.insert(consumables).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      prompt: context.userPrompt,
      type: resultItem.type,
      quality: resultItem.quality,
      effects: resultItem.effects ?? [],
      description: resultItem.description,
      quantity: resultItem.quantity || 1,
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
   * 随机整数
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}

import { DbTransaction } from '@/lib/drizzle/db';
import { consumables } from '@/lib/drizzle/schema';
import type { Consumable } from '@/types/cultivator';
import { calculateSingleElixirScore } from '@/utils/rankingUtils';
import { CreationFactory } from '../CreationFactory';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  ConsumableBlueprint,
  ConsumableBlueprintSchema,
  DIRECTION_TAG_VALUES,
  MaterialContext,
} from '../types';

export class AlchemyStrategy implements CreationStrategy<
  ConsumableBlueprint,
  Consumable
> {
  readonly craftType = 'alchemy';

  readonly schemaName = '丹药蓝图';

  readonly schemaDescription =
    '描述了丹药的名称、描述、效果方向等信息（数值由程序计算）';

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
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, materials, userPrompt } = context;

    const materialsDesc = materials
      .map(
        (m) =>
          `- ${m.name}(${m.rank}) 元素:${m.element || '无'} 类型:${m.type} 描述:${m.description || '无'}`,
      )
      .join('\n');

    const systemPrompt = `
# Role: 修仙界丹道宗师 - 丹药蓝图设计

你是一位隐世丹道宗师，负责为修士设计丹药蓝图。**你只负责创意设计，具体数值由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何数值**！不要输出 bonus、power 等数字。
> 程序会根据材料品质和修士境界自动计算所有数值。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **direction_tags**: ${DIRECTION_TAG_VALUES.join(', ')}
- **quantity_hint**: single（1颗）, medium（1-2颗）, batch（2-3颗）

## 核心规则

### 1. 效果类型判定（通过 direction_tags）
根据材料特性选择 1-2 个方向标签：
- 材料坚硬、血气旺盛（如龙骨、赤炎藤） → increase_vitality
- 材料蕴含高浓度灵气（如星髓草、千年灵芝） → increase_spirit
- 材料轻盈、风/雷属性（如云翼叶、疾风籽） → increase_speed
- 材料作用于魂魄或精神（如幽冥花、心莲） → increase_willpower
- 材料有"顿悟""道韵"等描述 → increase_wisdom（**谨慎使用**）

### 2. 成丹数量提示
- 低品材料 → batch（2-3颗）
- 中品材料 → medium（1-2颗）
- 高品材料（地品以上） → single（1颗）
- 程序会根据最终品质再次调整

### 3. 命名与描述
- 名称：2-10字，古朴典雅（如"九转凝魄丹"）
- 描述：30-100字，描述丹色、丹香或服用感
- **不得编造未提供的材料**

## 禁止行为
- ❌ 不得输出任何数值（bonus、power 等）
- ❌ 不得自定义枚举值
- ❌ 不得编造材料
- ❌ 不得让用户描述影响品质判定
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

<user_intent_for_naming_only>
${userPrompt || '无'}
</user_intent_for_naming_only>

注意：user_intent 仅影响丹药名称和描述风格，不影响效果判定！
依规炼丹，直接输出唯一合法 JSON。
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
    const materialContext: MaterialContext = {
      cultivatorRealm: context.cultivator.realm,
      cultivatorRealmStage: context.cultivator.realm_stage,
      materials: context.materials.map((m) => ({
        name: m.name,
        rank: m.rank,
        element: m.element,
        type: m.type,
        description: m.description,
      })),
      maxMaterialQuality: this.getMaxQuality(context.materials),
    };

    return CreationFactory.materializeConsumable(blueprint, materialContext);
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
      effect: resultItem.effect,
      description: resultItem.description,
      quantity: resultItem.quantity || 1,
      score,
    });
  }

  // ============ 辅助方法 ============

  private getMaxQuality(materials: CreationContext['materials']): string {
    const qualityOrder = [
      '凡品',
      '灵品',
      '玄品',
      '真品',
      '地品',
      '天品',
      '仙品',
      '神品',
    ];
    let maxIndex = 0;
    for (const mat of materials) {
      const index = qualityOrder.indexOf(mat.rank);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
    return qualityOrder[maxIndex];
  }
}

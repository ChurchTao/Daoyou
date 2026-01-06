/**
 * 法宝炼制策略
 *
 * 重构后使用 AffixGenerator + EffectMaterializer 生成效果
 */

import { DbTransaction } from '@/lib/drizzle/db';
import { artifacts } from '@/lib/drizzle/schema';
import type { ElementType, Quality, RealmType } from '@/types/constants';
import {
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  QUALITY_VALUES,
} from '@/types/constants';
import type { Artifact } from '@/types/cultivator';
import { calculateSingleArtifactScore } from '@/utils/rankingUtils';
import { AffixGenerator } from '../AffixGenerator';
import { hasElementConflict } from '../creationConfig';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  ArtifactBlueprint,
  ArtifactBlueprintSchema,
  DIRECTION_TAG_VALUES,
} from '../types';

export class RefiningStrategy implements CreationStrategy<
  ArtifactBlueprint,
  Artifact
> {
  readonly craftType = 'refine';

  readonly schemaName = '法宝蓝图';

  readonly schemaDescription =
    '描述法宝的名称、描述、槽位、属性方向（效果由程序生成）';

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

    // 检测材料是否有元素相克
    const elements = materials.map((m) => m.element).filter(Boolean);
    const hasConflict = hasElementConflict(elements as string[]);

    const systemPrompt = `
# Role: 修仙界炼器宗师 - 法宝蓝图设计

你是一位隐世炼器宗师，负责为修士设计法宝蓝图。**你只负责创意设计，具体效果由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何数值和效果**！
> 程序会根据材料品质和修士境界自动生成所有效果词条。

## 输出格式（严格遵守）

只输出一个符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **slot**: ${EQUIPMENT_SLOT_VALUES.join(', ')}
- **element_affinity**: ${ELEMENT_VALUES.join(', ')}
- **direction_tags**: ${DIRECTION_TAG_VALUES.join(', ')}

## 核心规则

### 1. 方向性标签选择
根据材料特性选择 1-3 个方向标签：
- 材料坚硬、防御性强 → increase_vitality, defense_boost
- 材料蕴含灵气 → increase_spirit
- 材料轻盈、风/雷属性 → increase_speed
- 材料与魂魄相关 → increase_willpower
- 材料有顿悟特性 → increase_wisdom（罕见）

### 2. 槽位判定
- 攻击性材料（利器、尖锐） → weapon
- 防御性材料（甲壳、金属） → armor
- 辅助性材料（灵石、玉石） → accessory

### 3. 命名与描述
- 名称：2-10字，古风霸气，结合材料特性
- 描述：50-150字，描述材料、炼制过程、外观、气息
${hasConflict ? '\n### ⚠️ 材料相克警告\n检测到投入的材料存在五行相克！描述中应体现法宝的不稳定或反噬风险。' : ''}

## 禁止行为
- ❌ 不得输出任何数值（bonus、power、chance 等）
- ❌ 不得描述具体效果（程序自动生成）
- ❌ 不得自定义枚举值
`;

    const userPromptText = `
请为以下修士设计法宝蓝图：

<cultivator>
  <realm>${cultivator.realm} ${cultivator.realm_stage}</realm>
</cultivator>

<materials>
${materials.map((m) => `  - ${m.name}(${m.rank}) 元素:${m.element || '无'} 类型:${m.type} 描述:${m.description || '无'}`).join('\n')}
</materials>

<user_intent_for_naming_only>
${userPrompt || '无'}
</user_intent_for_naming_only>

注意：user_intent 仅影响法宝名称和描述风格，不影响效果生成！
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

    // 使用 AffixGenerator 生成效果
    const { effects } = AffixGenerator.generateArtifactAffixes(
      blueprint.slot,
      quality,
      realm,
      element,
      blueprint.direction_tags,
    );

    // 检查五行相克，添加诅咒效果
    const elements = context.materials.map((m) => m.element);
    if (hasElementConflict(elements)) {
      const curseEffects = AffixGenerator.generateCurseAffix(realm, quality);
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

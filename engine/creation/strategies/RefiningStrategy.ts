import { DbTransaction } from '@/lib/drizzle/db';
import { artifacts } from '@/lib/drizzle/schema';
import { ELEMENT_VALUES, EQUIPMENT_SLOT_VALUES } from '@/types/constants';
import type { Artifact } from '@/types/cultivator';
import { calculateSingleArtifactScore } from '@/utils/rankingUtils';
import { CreationFactory } from '../CreationFactory';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';
import {
  ArtifactBlueprint,
  ArtifactBlueprintSchema,
  DIRECTION_TAG_VALUES,
  MaterialContext,
} from '../types';

export class RefiningStrategy implements CreationStrategy<
  ArtifactBlueprint,
  Artifact
> {
  readonly craftType = 'refine';

  readonly schemaName = '法宝蓝图';

  readonly schemaDescription =
    '描述了法宝的名称、描述、槽位、属性方向等信息（数值由程序计算）';

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
    const hasConflict = this.checkElementConflict(elements as string[]);

    const systemPrompt = `
# Role: 修仙界炼器宗师 - 法宝蓝图设计

你是一位隐世炼器宗师，负责为修士设计法宝蓝图。**你只负责创意设计，具体数值由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何数值**！不要输出 bonus、power、chance 等数字。
> 程序会根据材料品质和修士境界自动计算所有数值。

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

### 3. 特效提示（可选）
如果材料品质较高（地品以上），可添加 effect_hints：
- damage_boost: 伤害加成
- on_hit_status: 命中附加状态（需指定 status）
- element_damage: 元素伤害
- defense: 防御效果
- critical: 暴击效果

${
  hasConflict
    ? `
### 4. 诅咒提示（材料相克）
⚠️ 检测到投入的材料存在五行相克！必须添加 curse_hints：
- self_damage: 反噬自身
- hp_cost: 消耗生命
`
    : ''
}

### 5. 命名与描述
- 名称：2-10字，古风霸气，结合材料特性
- 描述：50-150字，描述材料、炼制过程、外观、气息

## 禁止行为
- ❌ 不得输出任何数值（bonus、power、chance 等）
- ❌ 不得自定义枚举值
- ❌ 不得让用户描述影响品质判定
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

注意：user_intent 仅影响法宝名称和描述风格，不影响属性分配！
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

    return CreationFactory.materializeArtifact(blueprint, materialContext);
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

  private checkElementConflict(elements: string[]): boolean {
    const conflicts: Record<string, string[]> = {
      火: ['水', '冰'],
      水: ['火', '雷'],
      木: ['金', '火'],
      金: ['木', '火'],
      土: ['木', '水'],
    };
    for (const el of elements) {
      const conflictList = conflicts[el] || [];
      for (const other of elements) {
        if (conflictList.includes(other)) {
          return true;
        }
      }
    }
    return false;
  }
}

import { DbTransaction } from '@/lib/drizzle/db';
import { consumables } from '@/lib/drizzle/schema';
import {
  CONSUMABLE_EFFECT_VALUES,
  CONSUMABLE_TYPE_VALUES,
  QUALITY_VALUES,
} from '@/types/constants';
import { getMaterialTypeLabel } from '@/types/dictionaries';
import { z } from 'zod';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';

// Zod Schema for Consumables
const ConsumableSchema = z.object({
  name: z.string(),
  type: z.enum(CONSUMABLE_TYPE_VALUES),
  quality: z.enum(QUALITY_VALUES),
  effect: z.array(
    z.object({
      effect_type: z.enum(CONSUMABLE_EFFECT_VALUES),
      bonus: z.number().optional(),
      vitality: z.number().optional(),
      spirit: z.number().optional(),
      wisdom: z.number().optional(),
      speed: z.number().optional(),
      willpower: z.number().optional(),
    }),
  ),
  description: z.string().max(50).optional(),
});

export class AlchemyStrategy implements CreationStrategy<
  z.infer<typeof ConsumableSchema>
> {
  readonly craftType = 'alchemy';

  readonly schemaName = '修仙丹药数据结构';

  readonly schemaDescription = '描述了丹药的名称、类型、效果、描述等信息';

  readonly schema = ConsumableSchema;

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
          `材料名：${m.name} 品阶：(${m.rank}) 元素：(${m.element || ''}) 类型：(${getMaterialTypeLabel(m.type)}) 描述：(${m.description || ''})`,
      )
      .join('\n');

    const systemPrompt = `你是一位修仙界的丹道大宗师，深谙君臣佐使之理。请根据投入的灵草药材和修士的神念，炼制一枚神效丹药(Consumable)。

请遵循丹道法则：
1. **药效匹配 (Effect Logic)**：
   丹药的效果必须是永久提升修士的属性，你需要根据材料的特性决定提升哪一种属性。
   - 坚硬、血气旺盛的材料 -> 倾向提升 **体魄** (Vitality) [永久提升体魄]
   - 蕴含灵气、能量的材料 -> 倾向提升 **灵力** (Spirit) [永久提升灵力]
   - 奇异、增加感悟的材料 -> 倾向提升 **悟性** (Wisdom) [永久提升悟性]
   - 轻盈、风属性的材料 -> 倾向提升 **身法** (Speed) [永久提升身法]
   - 增强精神、灵魂的材料 -> 倾向提升 **神识** (Willpower) [永久提升神识]
   
   **丹药品阶(quality)**
   - 丹药的品质(quality)必须与材料品阶相匹配，必须等于或小于材料中最高品阶的材料。

2. **药力强度 (Potency)**：
   提升的点数(bonus)必须严格受到材料品阶和修士境界的限制，切勿生成数值崩坏的丹药！
   
   **基础参考值 (基于最高品质材料)**：
   - 凡品/灵品：bonus 1-5
   - 玄品/真品：bonus 5-15
   - 地品/天品：bonus 15-40
   - 仙品/神品：bonus 40-100+

   **境界修正**：
   炼丹者的境界决定了对药力的吸收和凝练程度。
   - 炼气/筑基：药力利用率低，数值取下限。
   - 金丹/元婴：药力利用率中等。
   - 化神以上：药力利用率高，可发挥材料极致甚至突破上限。

3. **数据结构 (Schema Rules)**：
   - \`type\`: 必须固定为 '丹药'。
   - \`effect\`: 是一个数组，通常只有 1 个主要效果，极品材料可能有 2 个副效果。
   - \`effect_type\`: 必须是 [${CONSUMABLE_EFFECT_VALUES.join(', ')}] 中的一个。
   - \`bonus\`: 具体的提升数值 (整数)。

4. **命名与描述**：
   - 名称需古朴典雅，如"九转金丹"、"洗髓伐骨液"、"紫气东来丹"。
   - 描述(description)包含丹药色泽、丹香以及服用后的感受，最多50字。`;

    const userPromptText = `
【丹炉升火】

炼丹者境界: ${cultivator.realm} ${cultivator.realm_stage}
神念意图: ${userPrompt}

【投入药材】:
${materialsDesc}

请以此炼丹，生成唯一的丹药数据。
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: z.infer<typeof ConsumableSchema>,
  ): Promise<void> {
    await tx.insert(consumables).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      prompt: context.userPrompt,
      type: resultItem.type,
      quality: resultItem.quality,
      effect: resultItem.effect,
      description: resultItem.description,
    });
  }
}

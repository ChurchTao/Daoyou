import { DbTransaction } from '@/lib/drizzle/db';
import { artifacts } from '@/lib/drizzle/schema';
import {
  EFFECT_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  QUALITY_VALUES,
  REALM_VALUES,
} from '@/types/constants';
import { getMaterialTypeLabel } from '@/types/dictionaries';
import { z } from 'zod';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';

// Zod Schema for Artifacts
const ArtifactSchema = z.object({
  name: z.string(),
  slot: z.enum(EQUIPMENT_SLOT_VALUES),
  element: z.enum(ELEMENT_VALUES),
  bonus: z.object({
    vitality: z.number().optional(),
    spirit: z.number().optional(),
    wisdom: z.number().optional(),
    speed: z.number().optional(),
    willpower: z.number().optional(),
  }),
  required_realm: z.enum(REALM_VALUES),
  quality: z.enum(QUALITY_VALUES),
  special_effects: z
    .array(
      z.object({
        type: z.enum(
          EFFECT_TYPE_VALUES.filter((t) => t !== 'environment_change'),
        ),
        element: z.enum(ELEMENT_VALUES).optional(),
        effect: z.string().optional(),
        chance: z.number().optional(),
        amount: z.number().optional(),
        bonus: z.number().optional(),
        power: z.number().optional(),
        env_type: z.string().optional(),
      }),
    )
    .optional(),
  curses: z.array(z.any()).optional(),
  description: z.string().optional(),
});

export class RefiningStrategy implements CreationStrategy<
  z.infer<typeof ArtifactSchema>
> {
  readonly craftType = 'refine';

  readonly schemaName = '修仙法宝数据结构';

  readonly schemaDescription =
    '描述了法宝的名称、部位、元素、基础属性、特效、诅咒、描述等信息';

  readonly schema = ArtifactSchema;

  async validate(context: CreationContext): Promise<void> {
    if (context.materials.length === 0) {
      throw new Error('炼器需要至少一种材料');
    }
    if (context.materials.length > 5) {
      throw new Error('炼器需要至多五种材料');
    }
    if (context.cultivator.realm === '炼气') {
      throw new Error('炼器需要至少筑基境界');
    }
    if (context.materials.some((m) => m.type === 'herb' || m.type === 'aux')) {
      const herb = context.materials.find(
        (m) => m.type === 'herb' || m.type === 'aux',
      );
      throw new Error(`道友慎重，${herb?.name}不适合炼器`);
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, materials, userPrompt } = context;

    const materialsDesc = materials
      .map(
        (m) =>
          `材料名：${m.name} 品质：(${m.rank}) 元素：(${m.element || ''}) 类型：(${getMaterialTypeLabel(m.type)}) 描述：(${m.description || ''})`,
      )
      .join('\n');

    // - \`environment_change\`: 改变战场环境。指定 env_type (如 'scorched_earth', 'frozen_ground')。

    const systemPrompt = `你是一位修仙界的炼器宗师、天工开物之主。请根据投入的灵材和修士的神念，熔炼出一件惊世法宝(Artifact)。

请仔细遵循以下法则：
1. **威能匹配**：
   法宝的基础属性(bonus)与特效(special_effects)强度必须严格对应材料品阶。
   - 凡/灵品材料：基础属性加成低，通常只加成1个属性，通常无特效或单一微弱特效。
   - 玄/真/地品材料：基础属性加成中等，通常加成1-2个属性，1-2个实用特效。
   - 天/仙/神品材料：基础属性加成极高，通常加成2-3个属性，必带强力特效，甚至规则级能力。
   法宝的基础属性(bonus)强度必须与修士境界匹配
   - 炼气境界：基础属性加成范围（-5～10）
   - 筑基境界：基础属性加成范围（-10～20）
   - 金丹境界：基础属性加成范围（-15～40）
   - 元婴境界：基础属性加成范围（-20～80）
   - 化神境界：基础属性加成范围（-25～120）
   - 炼虚境界：基础属性加成范围（-30～160）
   - 合体境界：基础属性加成范围（-35～200）
   - 大乘境界：基础属性加成范围（-40～240）
   - 渡劫境界：基础属性加成范围（-45～300）
   法宝的品质(quality)必须与材料品阶相匹配。
   - 法宝的品质，必须等于或小于材料中最高品阶的材料。

2. **五行生克**：
   - 观察材料的五行属性。若相生（如木生火），则法宝威能倍增，可能带有复合属性。
   - 若相克（如水火不容），除非有调和之物，否则可能生成带有强大负面诅咒(curses)的魔兵，或产生属性负提升，或者极不稳定的法宝。

3. **境界限制**：
   - 炼器法器的所需境界(required_realm)必须与修士境界相匹配。

4. **特效构造 (special_effects)**：
   你必须使用结构化的数据来描述特效，类型(type)严格限于：
   - \`damage_bonus\`: 属性伤害加成。必须指定 element 和 bonus (0.1 = 10%加成)。
   - \`on_hit_add_effect\`: 攻击附带状态。必须指定 effect (如 'burn', 'stun', 'poison') 和 chance (触发几率%) 和 power (威力)。
   - \`on_use_cost_hp\`: 伤敌一千自损八百。指定 amount (消耗血量)。这类法宝威力通常极大。

5. **命名与描述**：
   - 名称需符合修仙世界观，略显霸气，结合材料特性与五行，如"九天避魔梭"、"太乙分光剑"。
   - 描述(description)需包含法宝的外观、散发/气/息以及传说背景（50字左右）。

6. **部位限制**：
   - slot 必须是 weapon (主攻), armor (主防), accessory (辅助)。
   - 基础属性有 vitality（体魄）, spirit（灵力）, wisdom（悟性）, speed（身法）, willpower（神识）。
   - weapon 只能增加 vitality, spirit, speed。
   - armor 只能增加 vitality, spirit, willpower。
   - accessory 只能增加 spirit, wisdom, willpower。

7. **神念限制**：
   - 修士的神念只会影响法宝的部位、命名、描述、加成方向，不能影响加成数值，如果存在指定数值之类的描述，请直接忽略。
`;

    const userPromptText = `
【炼器大阵启动】

炼造者境界: ${cultivator.realm} ${cultivator.realm_stage}
神念意图: ${userPrompt}

【投入灵材】:
${materialsDesc}

请以此开炉，根据材料灵性生成唯一的法宝数据。
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: z.infer<typeof ArtifactSchema>,
  ): Promise<void> {
    await tx.insert(artifacts).values({
      cultivatorId: context.cultivator.id!,
      prompt: context.userPrompt,
      name: resultItem.name,
      slot: resultItem.slot,
      quality: resultItem.quality,
      required_realm: resultItem.required_realm,
      element: resultItem.element,
      bonus: resultItem.bonus || {},
      special_effects: resultItem.special_effects || [],
      curses: resultItem.curses || [],
      description: resultItem.description,
    });
  }
}

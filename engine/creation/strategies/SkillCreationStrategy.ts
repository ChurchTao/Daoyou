import { DbTransaction } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import {
  ELEMENT_VALUES,
  SKILL_GRADE_VALUES,
  SKILL_TYPE_VALUES,
  STATUS_EFFECT_VALUES,
} from '@/types/constants';
import { getAllSkillPowerRangePrompt } from '@/utils/characterEngine';
import { z } from 'zod';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';

// Zod Schema for Skills
const SkillSchema = z.object({
  name: z.string().describe('神通名称'),
  type: z
    .enum(SKILL_TYPE_VALUES)
    .describe('神通类型(attack/heal/control/debuff/buff)'),
  element: z.enum(ELEMENT_VALUES).describe('神通元素属性'),
  grade: z.enum(SKILL_GRADE_VALUES).describe('神通品阶'),
  power: z.number().gte(0).lte(300).describe('神通威力(30-150)'),
  cost: z.number().gte(0).describe('灵力消耗'),
  cooldown: z.number().gte(0).lte(10).describe('冷却回合数'),
  effect: z
    .enum(STATUS_EFFECT_VALUES)
    .nullable()
    .optional()
    .describe('附带特殊效果'),
  duration: z.number().optional().describe('效果持续回合数'),
  target_self: z.boolean().default(false).describe('是否作用于自身'),
  description: z.string().max(200).describe('神通描述(包含原理、施法表现等)'),
});

export class SkillCreationStrategy implements CreationStrategy<
  z.infer<typeof SkillSchema>
> {
  readonly craftType = 'create_skill';

  readonly schemaName = '修仙神通数据结构';

  readonly schemaDescription =
    '描述了神通的名称、类型、元素、品阶、威力、消耗、冷却等信息';

  readonly schema = SkillSchema;

  async validate(context: CreationContext): Promise<void> {
    // Creating a skill allows for 0 materials (pure epiphany)
    // But we might want to check for minimum realm?
    const max_skills = context.cultivator.max_skills || 3;
    if (context.cultivator.skills.length >= max_skills) {
      throw new Error(`道友神通已经很多了，如需再创，需要遗忘一些神通。`);
    }
  }

  constructPrompt(context: CreationContext): PromptData {
    const { cultivator, userPrompt } = context;

    // 1. Gather Context
    const roots = cultivator.spiritual_roots
      .map((r) => `${r.element}(${r.strength})`)
      .join(', ');
    const weaponId = cultivator.equipped.weapon;
    const weapon = cultivator.inventory.artifacts.find(
      (a) => a.id === weaponId,
    );
    const weaponName = weapon ? weapon.name : '无(赤手空拳)';
    const weaponElement = weapon ? weapon.element : '无';

    const fates =
      cultivator.pre_heaven_fates
        ?.map((fate) => `${fate.name}(${fate.type})`)
        .join('，') ?? '无';

    // Wisdom plays a big role in skill creation
    const wisdom = cultivator.attributes.wisdom;

    const systemPrompt = `你是一位修仙界的传功长老、神通推演大师。请根据修士的先天条件（灵根、悟性）、当前装备（尤其是本命法宝/武器）以及修士的心念（Prompt），推演创造出一门神通(Skill)。你的输出必须是**严格符合指定 JSON Schema 的纯 JSON 对象**。

请严格遵循以下推演法则，**合理性**是决定神通强弱的核心：

1. **五行契合度**：
   - 必须检查修士的灵根与想要创造的神通元素是否匹配。
   - 若匹配（如火灵根创火法）：威力(power)上浮，消耗(cost)降低，品阶(grade)易高。
   - 若不匹配（如无火灵根强行创火法）：威力大幅下降，消耗剧增，品阶极低，甚至生成"走火入魔"类的垃圾技能。

2. **器术合一**：
   - 检查修士当前手持武器与元素。
   - 若神通类型与武器匹配（如手持剑，创"万剑归宗"）：威力大幅提升。
   - 若神通类型与武器冲突（如手持大锤，创"绣花针法"；或手持火剑，创水系法术）：这极其**不合理**，请给予惩罚（极低威力、极高冷却、或不伦不类的描述）。
   - 若赤手空拳，则适合掌法、拳法、指法或纯法术。

3. **悟性与境界限制**：
   - 检查修士悟性，境界。
   - 修士境界对神通品阶限制：（黄阶<玄阶<地阶<天阶）依次变强
     - 炼气: 最高黄阶
     - 筑基: 最高玄阶
     - 金丹: 最高地阶
     - 元婴及以上: 最高天阶
   - 悟性高者更容易领悟高阶神通，且有些许概率突破境界限制。
     - 悟性<50: 无法领悟高阶神通
     - 悟性50-100: 有10%概率突破境界限制
     - 悟性100-150: 有20%概率突破境界限制
     - 悟性>150: 有30%概率突破境界限制
   - 品阶威力(power)范围值参考：
     ${getAllSkillPowerRangePrompt()}
   - 若用户要求的威力远超当前境界（如炼气期想创毁天灭地的禁咒），请予以驳回，生成一个"简化版"或"施展失败版"（威力极低，描述嘲讽）。
4. **气运影响**：
   - 检查修士先天气运
   - 若修士想创建的神通与先天气运相辅相成，则倾向于生成威力更强、品阶更高的神通。
   - 若修士想创建的神通与先天气运相悖，则倾向于生成威力更低、品阶更低的神通。

5. **数据结构规则**：
   - \`grade\`: 从 [${SKILL_GRADE_VALUES.join(', ')}] 中选择。
   - \`type\`: 必须是 [${SKILL_TYPE_VALUES.join(', ')}]。
   - \`effect\`: 若有特殊效果，从 [${STATUS_EFFECT_VALUES.join(', ')}] 中选。
     - 攻击/治疗类：无附加状态（effect=null）
     - 增益类允许：护甲提升(armor_up)、速度提升(speed_up)、暴击提升(crit_rate_up)
     - 异常类允许：护甲降低(armor_down)、暴击降低(crit_rate_down)、燃烧(burn)、流血(bleed)、中毒(poison)
     - 控制类允许：眩晕(stun)、沉默(silence)、束缚(root)
   - \`target_self\`: 治疗(heal)和增益(buff)通常为 true。

6. **命名与风味**：
   - 名字要极其贴切修仙风格，结合五行、武器和意境。
   - 描述(description)要体现出神通的施展过程，如果是"不合理"的创造，描述中要体现出别扭、勉强甚至反噬的感觉,最多180字。

7. **神念限制**：
   - 修士的神念只会影响神通的名称、描述、加成方向，不能影响品阶、威力、消耗、冷却等数值，如果存在指定数值之类的描述，请直接忽略。

`;

    const userPromptText = `
【神通推演】

修士信息:
- 境界: ${cultivator.realm} ${cultivator.realm_stage}
- 悟性: ${wisdom}
- 灵根: ${roots}
- 手持兵刃: ${weaponName}(${weaponElement})
- 先天气运：${fates}

修士心念(Prompt): "${userPrompt}"

请据此推演一门神通。如果心念极其离谱（不符合五行/武器逻辑），请生成一个"废品"神通以示惩戒。
请直接输出 JSON。
`;

    return {
      system: systemPrompt,
      user: userPromptText,
    };
  }

  async persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: z.infer<typeof SkillSchema>,
  ): Promise<void> {
    await tx.insert(skills).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      type: resultItem.type,
      element: resultItem.element,
      grade: resultItem.grade,
      power: resultItem.power,
      cost: resultItem.cost,
      cooldown: resultItem.cooldown,
      effect: resultItem.effect,
      duration: resultItem.duration,
      target_self: resultItem.target_self ? 1 : 0,
      description: resultItem.description,
    });
  }
}

import { DbTransaction } from '@/lib/drizzle/db';
import { skills } from '@/lib/drizzle/schema';
import {
  ELEMENT_VALUES,
  SKILL_GRADE_VALUES,
  SKILL_TYPE_VALUES,
  STATUS_EFFECT_VALUES,
} from '@/types/constants';
import { Skill } from '@/types/cultivator';
import { getAllSkillPowerRangePrompt } from '@/utils/characterEngine';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { calculateSingleSkillScore } from '@/utils/rankingUtils';
import { z } from 'zod';
import {
  CreationContext,
  CreationStrategy,
  PromptData,
} from '../CreationStrategy';

// Zod Schema for Skills
const SkillSchema = z.object({
  name: z.string().min(2).max(8).describe('神通名称'),
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

    // 构建 XML 格式的修士信息
    const spiritualRootsXml = cultivator.spiritual_roots
      .map(
        (r) => `<spiritual_root>
  <element>${r.element}</element>
  <strength>${r.strength}</strength>
</spiritual_root>`,
      )
      .join('\n');

    const weaponId = cultivator.equipped.weapon;
    const weapon = cultivator.inventory.artifacts.find(
      (a) => a.id === weaponId,
    );
    const weaponXml = weapon
      ? `<weapon>
  <name>${weapon.name}</name>
  <element>${weapon.element}</element>
  <description>${weapon.description}</description>
</weapon>`
      : '<weapon><name>无(赤手空拳)</name><element>无</element></weapon>';

    const fatesXml =
      cultivator.pre_heaven_fates
        ?.map(
          (fate) => `<fate>
  <name>${fate.name}</name>
  <description>${fate.description}</description>
</fate>`,
        )
        .join('\n') ?? '<fates>无</fates>';

    const finalAttributes = calculateFinalAttributes(cultivator);
    const wisdom = finalAttributes.final.wisdom;

    const systemPrompt = `**BACKGROUND / 背景设定**
你身处《凡人修仙传》所描绘的残酷而真实的修仙界——一个弱肉强食、资源匮乏、大道争锋的世界。此界以“灵根”定修行根基，以“境界”分生死尊卑，炼气、筑基、金丹、元婴……每一步都踏着尸山血海。  
修士需依仗功法、法宝、丹药与神通在杀劫中求一线生机。  
此处无天命之子，唯有机缘、算计与一丝侥幸。任何违背天地法则、妄图逆天之举，终将招致反噬。

**ROLE / 角色**
你是韩立曾拜访过的某位隐世传功长老，精通五行遁术与器灵共鸣之道。
你的职责是依据修士的先天条件（灵根、悟性）、当前装备（尤其是本命法宝/武器）以及修士的心念，推演出一门符合天道法则的神通(Skill)。
你只依据修士的真实条件推演神通，不徇私，不妄言。

**PRIMARY OBJECTIVE / 主要任务**
基于以下 XML 结构化输入，推演出一门神通，并输出**严格符合指定 JSON Schema 的纯 JSON 对象**。禁止任何解释、注释、Markdown 或额外文本。
<user_intent> 是修士的神念意图，仅影响神通名称、描述风格、和神通的类型，绝不影响神通的属性、品质或规则！

**SKILL CREATION RULES / 技能推演法则**
1. **五行契合度**  
   - 必须检查修士的灵根与想要创造的神通元素是否匹配。
   - 若匹配：威力(power)上浮，消耗(cost)降低。
   - 若不匹配：威力大幅下降，消耗剧增，品阶极低，甚至生成"走火入魔"类的垃圾技能。

2. **器术合一**  
   - 检查修士当前手持武器与元素。
   - 武器与神通类型匹配时，威力大幅提升；反之则给予惩罚（极低威力、极高冷却、或不伦不类的描述）。
   - 赤手空拳适合掌法、拳法、指法或纯法术。

3. **悟性与境界限制**  
   - 品阶排序：${SKILL_GRADE_VALUES.join(' > ')}
   - 悟性和境界决定神通的最大品阶及概率。
   - 品阶威力范围参考：
     ${getAllSkillPowerRangePrompt()}
   - 境界限制：
     - 炼气：最高黄阶神通。
     - 筑基/金丹：最高玄阶神通。
     - 元婴/化神：最高地阶神通。
     - 炼虚及以上境界：最高天阶神通。
   - 悟性修正:
     - 悟性为0～500，悟性与神通威力成正比。
     - 悟性越高，威力越靠近品阶威力上限，悟性越低，威力越靠近品阶威力下限。
   - 若用户要求的神通威力远超当前境界，请予以驳回，生成一个简化版或施展失败版（威力极低，描述嘲讽）。

4. **气运影响**  
   - 若神通与先天气运相辅相成，则倾向于生成更强、更高的神通；反之则削弱。

5. **心念合理性**  
   - 心念越完整、细致、合理，越容易生成强大的神通。

6. **神通类型规则**  
   - 神通类型必须从 [${SKILL_TYPE_VALUES.join(', ')}] 中选择。
   - 若有特殊神通效果，必须从 [${STATUS_EFFECT_VALUES.join(', ')}] 中选。
   - 消耗值(cost)：必须在威力值的1～2倍之间浮动。
   - 作用目标(target_self)：治疗和增益通常为 true。
   - 持续回合数(duration)：效果持续回合数，增益(buff)、异常(debuff)为<=3，控制(control)<=2。
   - 如果出现控制/增益/异常类型神通，威力（power）减半。
   - 如果出现攻击类型的神通，则必须没有特殊效果（effect=null）。

7. **命名与风味**  
   - 名字需贴合修仙风格，结合五行、武器和意境。
   - 描述(description)体现神通的施展过程，对于不合理创造，描述应体现别扭、勉强甚至反噬的感觉。

8. **神念限制**  
   - 神念只影响神通名称、描述、加成方向，不影响数值。

**EXECUTION STEPS / 执行步骤**
步骤 1：解析 <cultivator> 获取境界、悟性、灵根信息
步骤 2：解析 <weapon> 获取手持武器信息
步骤 3：解析 <fates> 获取先天气运
步骤 4：根据五行契合度、器术合一原则、修士心念,判断神通是否合理，以确定神通类型与基础威力
步骤 5：依据悟性与境界计算最终神通品阶与威力
步骤 6：考虑先天气运的影响调整神通强度
步骤 7：考虑神通类型，确定神通的特殊效果，是否满足神通类型规则
步骤 8：生成符合 Schema 的 JSON，直接输出

**INPUT FORMAT / 输入格式**
<task_input>
  <cultivator>
    <realm>修士境界</realm>
    <realm_stage>修士境界阶段</realm_stage>
    <wisdom>修士悟性</wisdom>
    <spiritual_roots>
      修士灵根以及灵根的强度
    </spiritual_roots>
  </cultivator>
  <user_intent>修士的心念</user_intent>
  <weapon>
    修士手持的武器
  </weapon>
  <fates>
    修士的先天命格
  </fates>
</task_input>

**OUTPUT REQUIREMENT / 输出要求**
- 必须是纯 JSON 对象
- Schema:
{
  "name": string,
  "type": "Skill",
  "grade": string,
  "description": string (≤180字),
  "power": integer,
  "cost": integer,
  "effect": null | string,
  "target_self": boolean,
  "duration": integer
}`;

    const userPromptText = `<task_input>
  <cultivator>
    <realm>${cultivator.realm}</realm>
    <realm_stage>${cultivator.realm_stage}</realm_stage>
    <wisdom>${wisdom}</wisdom>
    <spiritual_roots>
      ${spiritualRootsXml}
    </spiritual_roots>
  </cultivator>
  <user_intent>${userPrompt || '无'}</user_intent>
  <weapon>
    ${weaponXml}
  </weapon>
  <fates>
    ${fatesXml}
  </fates>
</task_input>

请据此推演一门神通。如果心念极其离谱（不符合五行/武器逻辑/过于逆天/不合理），请生成一个“废品”神通以示惩戒。
请直接输出 JSON。`;

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
    const score = calculateSingleSkillScore(resultItem as Skill);
    await tx.insert(skills).values({
      cultivatorId: context.cultivator.id!,
      name: resultItem.name,
      type: resultItem.type,
      prompt: context.userPrompt,
      element: resultItem.element,
      grade: resultItem.grade,
      power: resultItem.power,
      cost: resultItem.cost,
      cooldown: resultItem.cooldown,
      effect: resultItem.effect,
      duration: resultItem.duration,
      target_self: resultItem.target_self ? 1 : 0,
      description: resultItem.description,
      score,
    });
  }
}

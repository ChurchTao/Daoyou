import type { BattleEngineResult } from '@/engine/battleEngine';
import {
  ELEMENT_VALUES,
  GENDER_VALUES,
  SKILL_GRADE_VALUES,
  SKILL_TYPE_VALUES,
  STATUS_EFFECT_VALUES,
} from '../types/constants';
import type { Attributes, Cultivator } from '../types/cultivator';
import type { BreakthroughAttemptSummary } from './breakthroughEngine';

/**
 * 角色生成 Prompt 模板（系统提示词）
 * 基于 basic.md 中的新 Cultivator JSON 结构。
 */
export function getCharacterGenerationPrompt(): string {
  const genderOptions = GENDER_VALUES.join(' | ');
  const elementOptions = ELEMENT_VALUES.join(' | ');
  const skillTypeOptions = SKILL_TYPE_VALUES.join(' | ');
  const statusEffectOptions = STATUS_EFFECT_VALUES.join(' | ');

  const skillGradeOptions = SKILL_GRADE_VALUES.join(' | ');

  return `你是"造化玉碟"，精通修仙设定。你会收到凡人的心念描述，请基于描述创造一个结构化的修仙者，并遵循天道平衡律：凡事有得必有失。

请严格输出 JSON（不要任何额外文字），遵循以下结构和取值范围：
{
  "name": "2~4 字中文姓名",
  "gender": "${genderOptions}",
  "origin": "出身势力或地域，10~20字",
  "personality": "性格概述，20~40字",

  "realm": "炼气 | 筑基",
  "realm_stage": "初期 | 中期 | 后期",
  "age": 整数，>= 10,
  "lifespan": 整数，炼气 100~130，筑基 300~330，不得小于 age,

  "attributes": {
    "vitality": 10~120,
    "spirit": 10~120,
    "wisdom": 10~120,
    "speed": 10~120,
    "willpower": 10~120
  },
  
  注意：属性总和不应超过所有属性上限总和的80%（筑基后期上限为120，总和上限为480）。

  "spiritual_roots": [
    {
      "element": "${elementOptions}",
      "strength": 0~100
    }
  ],
  
  灵根品阶规则：
  - 单灵根 = 天灵根（强度范围：70-90）
  - 双灵根 = 真灵根（强度范围：50-80）
  - 三/四灵根 = 伪灵根（强度范围：30-60）
  - 变异灵根（雷、风、冰）= 单灵根 = 天灵根（强度范围：70-95）
  注意：灵根品阶会根据灵根数量自动确定，无需在JSON中指定。

  "cultivations": [
    {
      "name": "功法名称（2~6字，古风）",
      "grade": "${skillGradeOptions}",
      "bonus": {
        "vitality": 可选整数加成（根据品阶调整：天阶上品20-30，天阶中品15-25，天阶下品10-20，地阶上品8-15，地阶中品5-12，地阶下品3-10，玄阶上品2-8，玄阶中品1-6，玄阶下品0-5，黄阶上品0-3，黄阶中品0-2，黄阶下品0-1）,
        "spirit": 可选整数加成（范围同上）,
        "wisdom": 可选整数加成（范围同上）,
        "speed": 可选整数加成（范围同上）,
        "willpower": 可选整数加成（范围同上）
      },
      "required_realm": "与上文 realm 相同或更低的境界名（必须从预定义列表中选择）"
    }
  ],
  
  功法要求：
  - 创建时带1-2个功法
  - 每个功法必须指定品阶（${skillGradeOptions}）
  - 功法是**被动加成**，会永久提升属性，请确保 bonus 字段至少包含一个非零的属性加成
  - 增幅数值必须符合品阶范围

  "skills": [
    {
      "name": "技能名",
      "type": "${skillTypeOptions}",
      "element": "${elementOptions}",
      "grade": "${skillGradeOptions}",
      "power": 30~150（必须符合品阶范围：天阶上品130-150，天阶中品115-135，天阶下品100-120，地阶上品85-105，地阶中品70-90，地阶下品55-75，玄阶上品50-70，玄阶中品40-60，玄阶下品30-50，黄阶上品30-45，黄阶中品30-40，黄阶下品30-35）,
      "cost": 0~100,
      "cooldown": 0~5,
      "effect": "可选：${statusEffectOptions}",
      "duration": 可选整数（持续回合数，1~4）,
      "target_self": 可选布尔值
    }
  ],
  
  技能要求：
  - 创建时带2个技能（神通）
  - 每个技能必须指定品阶（${skillGradeOptions}）
  - 技能威力必须符合品阶范围

  "inventory": {
    "artifacts": [],
    "consumables": []
  },

  "equipped": {
    "weapon": null,
    "armor": null,
    "accessory": null
  },

  "max_skills": 2~6 的整数,
  "background": "30~80字背景故事",
  "balance_notes": "古风描述，记录平衡原因"
}

重要约束与说明：
- **天道平衡律**：若用户描述过于强大，则天道会自动削弱角色，请在"balance_notes"字段中用古风描述记录平衡原因，若用户描述过于弱小，则天道会自动增强角色，请在"balance_notes"字段中用古风描述记录增强原因。
- **境界限制**：最高只能生成筑基后期，如果生成超过此境界，将自动降级。
- 元素必须从固定列表中选择：${elementOptions}。
- 技能类型必须是：${skillTypeOptions} 之一。
- 状态效果必须是：${statusEffectOptions} 之一。
- 所有数值字段必须是整数，且在给定范围之内。
- 至少 1 个灵根，最多 4 个。
- **先天气运(pre_heaven_fates)不在角色生成时创建，由系统单独生成供玩家选择。**
- 技能(skills)必须恰好2个，且应与角色设定和元素相符。
- 功法(cultivations)必须1-2个，且应与角色设定和元素相符。
- 装备（inventory.artifacts, inventory.consumables 和 equipped）不需要生成，创建角色时为空，由用户后续手动装备。
- 输出必须是**合法 JSON**，不要添加任何注释或多余文字。`;
}

interface BattlePromptPayload {
  player: Cultivator;
  opponent: Cultivator;
  battleResult: Pick<
    BattleEngineResult,
    'log' | 'turns' | 'playerHp' | 'opponentHp'
  > & { winnerId: string };
}

export function getBattleReportPrompt({
  player,
  opponent,
  battleResult,
}: BattlePromptPayload): [string, string] {
  const winner = battleResult.winnerId === opponent.id ? opponent : player;

  const summarizeCultivator = (cultivator: Cultivator) => {
    const attrs = cultivator.attributes;
    const roots = cultivator.spiritual_roots
      .map((root) => `${root.element}`)
      .join('，');
    const skills =
      cultivator.skills
        ?.map((skill) => `${skill.name}(${skill.element}/${skill.type})`)
        .join('，') ?? '无';
    const cultivations =
      cultivator.cultivations
        ?.map((cultivation) => `${cultivation.name}`)
        .join('，') ?? '无';
    const fates =
      cultivator.pre_heaven_fates
        ?.map((fate) => `${fate.name}(${fate.type})`)
        .join('，') ?? '无';
    return `姓名：${cultivator.name}
境界：${cultivator.realm}${cultivator.realm_stage}
灵根/属性：${roots}
属性：体魄${attrs.vitality} 灵力${attrs.spirit} 悟性${attrs.wisdom} 速度${attrs.speed} 神识${attrs.willpower}
神通：${skills}
功法：${cultivations}
先天气运/体质：${fates}`;
  };

  const battleLog = (battleResult.log || []).join('\n');

  const systemPrompt = `你是一位修仙题材连载小说作者，擅长写具有画面感的战斗场景。请根据设定与战斗日志，创作分回合的战斗播报，每回合描述控制在30-100字左右。

要求：
- 语言热血、古风、有镜头感、可以有台词、可以有心理描写
- 每回合战斗描述独立成行，以"【第X回合】"开头
- 双方招式须与技能、气运相符
- 明确写出每回合的攻击者、技能名称和伤害/治疗效果
- 若触发顿悟或底牌，需要重点描写
- 结尾单独一行，点明胜负与双方状态，可以有角色台词、心理描写
- 请为关键信息添加HTML标记，具体规则如下：
  - 回合数：<turn>【第X回合】</turn>
  - 人名：<name>人名</name>
  - 技能名称：<skill>技能名</skill>
  - 伤害数值：<damage>数字</damage>
  - 治疗数值：<heal>数字</heal>
  - 效果描述：<effect>效果描述</effect>
  - 胜负结果：<result>胜负描述</result>
- 禁止输出 JSON 或列表，仅写正文`;

  const userPrompt = `【对战双方设定】
${summarizeCultivator(player)}

---
${summarizeCultivator(opponent)}

【战斗日志】
${battleLog}

【战斗结论】
胜者：${winner.name}
回合数：${battleResult.turns ?? battleResult.log.length}
双方剩余气血：${player.name} ${
    battleResult.playerHp ?? '未知'
  } / ${opponent.name} ${battleResult.opponentHp ?? '未知'}

请写一段完整的战斗描写。`;

  return [systemPrompt, userPrompt];
}

export interface BreakthroughStoryPayload {
  cultivator: Cultivator;
  summary: BreakthroughAttemptSummary;
}

export function getBreakthroughStoryPrompt({
  cultivator,
  summary,
}: BreakthroughStoryPayload): [string, string] {
  const systemPrompt = `你是一位修仙题材小说作者，需要描写角色闭关突破成功的瞬间。

要求：
- 120~280字，语言古风、细腻，有意境
- 结合角色姓名、境界、悟性、灵根、功法等背景
- 具体写出闭关年限、感悟、瓶颈、破境细节以及天地异象
- 若为大境界突破，要强调劫难与蜕变；若为小境界，突出积累与打磨
- 可引用诗句/心声，但不要使用列表或标题
- 最后一两句点明突破后的境界与状态，为后续剧情埋下伏笔`;

  const roots =
    cultivator.spiritual_roots
      ?.map(
        (root) =>
          `${root.element}${root.grade ? `(${root.grade}/${root.strength})` : ''}`,
      )
      .join('，') ?? '未知';
  const cultivations =
    cultivator.cultivations?.map((cult) => cult.name).join('，') ?? '无';
  const attributeGain = formatAttributeGrowth(summary.attributeGrowth);
  const chancePercent = `${(summary.chance * 100).toFixed(1)}%`;
  const rollPercent = `${(summary.roll * 100).toFixed(1)}%`;
  const targetRealm = summary.toRealm ?? summary.fromRealm;
  const targetStage = summary.toStage ?? summary.fromStage;
  const userPrompt = `【角色】${cultivator.name}｜${cultivator.realm}${cultivator.realm_stage}｜悟性 ${cultivator.attributes.wisdom}
灵根：${roots}
功法：${cultivations}
年龄：${cultivator.age}，寿元：${cultivator.lifespan}

【闭关】本次闭关 ${summary.yearsSpent} 年，系统判定成功率 ${chancePercent}，实际掷值 ${rollPercent}。
【突破】从 ${summary.fromRealm}${summary.fromStage} → ${targetRealm}${targetStage}，${
    summary.isMajor ? '大境界突破' : '小境界精进'
  }，寿元提升 ${summary.lifespanGained} 年。
【收获】基础属性增幅：${attributeGain || '无（已触及上限）'}。

请依据以上资料创作突破成功的短篇故事，重点描绘心境、天地异象与突破瞬间。`;

  return [systemPrompt, userPrompt];
}

export interface LifespanExhaustedStoryPayload {
  cultivator: Cultivator;
  summary: BreakthroughAttemptSummary;
}

export function getLifespanExhaustedStoryPrompt({
  cultivator,
  summary,
}: LifespanExhaustedStoryPayload): [string, string] {
  const systemPrompt = `你是一位修仙志怪小说作者，需要描写寿元耗尽、突破失败的修士坐化场景。

要求：
- 180~320字，古意盎然
- 细写寿元将尽的征兆、失败后的心绪，以及天地对其的回应
- 提及其曾经的境界、灵根、功法与执念
- 结尾要引出“转世重修/轮回再来”的伏笔，语气既有惋惜又有希望`;

  const roots =
    cultivator.spiritual_roots
      ?.map(
        (root) =>
          `${root.element}${root.grade ? `(${root.grade}/${root.strength})` : ''}`,
      )
      .join('，') ?? '未知';
  const chancePercent = `${(summary.chance * 100).toFixed(1)}%`;
  const rollPercent = `${(summary.roll * 100).toFixed(1)}%`;
  const userPrompt = `【角色】${cultivator.name}｜${cultivator.realm}${cultivator.realm_stage}｜悟性 ${cultivator.attributes.wisdom}
灵根：${roots}
功法：${cultivator.cultivations?.map((c) => c.name).join('，') || '无'}
年龄：${cultivator.age}，寿元上限：${cultivator.lifespan}

【闭关】本次闭关 ${summary.yearsSpent} 年，突破方向：${summary.fromRealm}${summary.fromStage} → ${
    summary.toRealm ?? summary.fromRealm
  }${summary.toStage ?? summary.fromStage}。
系统给出的成功率 ${chancePercent}，实际掷值 ${rollPercent}，结果失败且寿元耗尽。

请描绘其油尽灯枯的心境、未了的执念，以及天道赐予转世重修机会的伏笔，让玩家在阅读后愿意点击“转世重修”。`;

  return [systemPrompt, userPrompt];
}

function formatAttributeGrowth(growth: Partial<Attributes>): string {
  if (!growth) return '';
  const mapping: Array<{ key: keyof Attributes; label: string }> = [
    { key: 'vitality', label: '体魄' },
    { key: 'spirit', label: '灵力' },
    { key: 'speed', label: '身法' },
    { key: 'willpower', label: '神识' },
  ];
  return mapping
    .map(({ key, label }) => {
      const value = growth[key];
      if (!value) return null;
      return `${label}+${value}`;
    })
    .filter(Boolean)
    .join('，');
}

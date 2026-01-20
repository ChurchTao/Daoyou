import type { BattleEngineResult } from '@/engine/battle';
import type { RealmStage, RealmType } from '../types/constants';
import type { Attributes, Cultivator } from '../types/cultivator';
import type { BreakthroughModifiers } from './breakthroughCalculator';

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
        ?.map((skill) => `${skill.name}(${skill.element}/todo(待填充))`)
        .join('，') ?? '无';
    const cultivations = 
      cultivator.cultivations
        ?.map((cultivation) => `${cultivation.name}`)
        .join('，') ?? '无';
    const fates = 
      cultivator.pre_heaven_fates?.map((fate) => `${fate.name}`).join('，') ??
      '无';
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
  summary: {
    success: boolean;
    isMajor: boolean;
    yearsSpent: number;
    chance: number;
    roll: number;
    fromRealm: RealmType;
    fromStage: RealmStage;
    toRealm?: RealmType;
    toStage?: RealmStage;
    lifespanGained: number;
    attributeGrowth: Partial<Attributes>;
    lifespanDepleted: boolean;
    modifiers: BreakthroughModifiers;
  };
}

export function getBreakthroughStoryPrompt({
  cultivator,
  summary,
}: BreakthroughStoryPayload): [string, string] {
  const systemPrompt = `你是一位修仙题材小说作者，需要描写角色闭关突破成功的瞬间。

要求：
- 80~150字，语言古风、细腻，有意境
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
  const fates =
    cultivator.pre_heaven_fates
      ?.map((fate) => `${fate.name}(${fate.description})`)
      .join('，') ?? '无';
  const attributeGain = formatAttributeGrowth(summary.attributeGrowth);
  const targetRealm = summary.toRealm ?? summary.fromRealm;
  const targetStage = summary.toStage ?? summary.fromStage;
  const userPrompt = `【角色】${cultivator.name}｜${cultivator.realm}${cultivator.realm_stage}｜悟性 ${cultivator.attributes.wisdom}
灵根：${roots}
功法：${cultivations}
气运：${fates}
年龄：${cultivator.age}，寿元：${cultivator.lifespan}

【闭关】本次闭关 ${summary.yearsSpent} 年。
【突破】从 ${summary.fromRealm}${summary.fromStage} → ${targetRealm}${targetStage}，${ 
    summary.isMajor ? '大境界突破' : '小境界精进' 
  }，寿元提升 ${summary.lifespanGained} 年。
【收获】基础属性增幅：${attributeGain}。

请依据以上资料创作突破成功的短篇故事，重点描绘心境、天地异象与突破瞬间。`;

  return [systemPrompt, userPrompt];
}

export interface LifespanExhaustedStoryPayload {
  cultivator: Cultivator;
  summary: {
    success: boolean;
    isMajor: boolean;
    yearsSpent: number;
    chance: number;
    roll: number;
    fromRealm: RealmType;
    fromStage: RealmStage;
    toRealm?: RealmType;
    toStage?: RealmStage;
    lifespanGained: number;
    attributeGrowth: Partial<Attributes>;
    lifespanDepleted: boolean;
    modifiers: BreakthroughModifiers;
  };
}

export function getLifespanExhaustedStoryPrompt({
  cultivator,
  summary,
}: LifespanExhaustedStoryPayload): [string, string] {
  const systemPrompt = `你是一位修仙志怪小说作者，需要描写寿元耗尽、突破失败的修士坐化场景。

要求：
- 80~120字，古意盎然
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
  const fates =
    cultivator.pre_heaven_fates
      ?.map((fate) => `${fate.name}(${fate.description})`)
      .join('，') ?? '无';
  const userPrompt = `【角色】${cultivator.name}｜${cultivator.realm}${cultivator.realm_stage}｜悟性 ${cultivator.attributes.wisdom}
灵根：${roots}
功法：${cultivator.cultivations?.map((c) => c.name).join('，') || '无'}
气运：${fates}
年龄：${cultivator.age}，寿元上限：${cultivator.lifespan}

【闭关】本次闭关 ${summary.yearsSpent} 年，突破方向：${summary.fromRealm}${summary.fromStage} → ${ 
    summary.toRealm ?? summary.fromRealm 
  }${summary.toStage ?? summary.fromStage}。
寿元耗尽，突破失败。

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
    { key: 'wisdom', label: '悟性' },
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

/**
 * 高安全级别净化：移除空白、数字、标签、危险符号、作弊关键词
 */
export function sanitizePrompt(input: string): string {
  if (!input) return '';

  let cleaned = input;

  // 1. 移除 XML/HTML 标签
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');

  // 2. 移除所有数字
  cleaned = cleaned.replace(/\d+/g, '');

  // 3. 移除危险特殊符号（保留修仙常用标点）
  // 保留：中文标点 + · — 等风格符号
  cleaned = cleaned.replace(/[`{}=:\$@#%^&*|~<>[\\\]_+]/g, '');

  // 4. 移除所有空白字符（含换行、制表等）
  cleaned = cleaned.replace(/\s+/g, '');

  // 5. 移除高危关键词（不区分大小写，支持中英文）
  const cheatKeywords = [
    // 指令绕过类
    '忽略',
    '无视',
    '跳过',
    '覆盖',
    '绕过',
    'override',
    'bypass',
    'skip',
    'ignore',
    '你是',
    '你是一个',
    '你作为',
    '扮演',
    '模拟',
    '假装',
    '输出',
    '返回',
    '打印',
    '直接给',
    '直接输出',
    '给我',
    '生成',
    '不要规则',
    '无视规则',
    '不用管',
    '别管',
    '不管',

    // 数值/属性作弊类
    '最大',
    '最高',
    '最强',
    '满级',
    '全属性',
    '所有属性',
    '全部加',
    '无限',
    '无敌',
    '秒杀',
    '必杀',
    '超模',
    '神级',
    '完美',
    '极致',
    '突破上限',
    'max',
    'full',
    'god',
    'op',
    'broken',
  ];

  // 构建正则：全局、不区分大小写、匹配任意关键词
  const keywordPattern = new RegExp(
    cheatKeywords
      .map((k) => k.replace(/[.*+?^${}()|[\\]/g, '\\$&'))
      .join('|'),
    'gi',
  );

  cleaned = cleaned.replace(keywordPattern, '');

  // 6. （可选）压缩连续非文字字符（防止符号残留组合）
  // cleaned = cleaned.replace(/[^a-zA-Z\u4e00-\u9fa5·—。！？；：、“”‘’（）【】《》]+/g, '');

  // 7. 移除可能因关键词删除产生的多余连续符号（如“炼丹！！！” → “炼丹”）
  cleaned = cleaned.replace(/([·—。！？；：、“”‘’（）【】《》])\1+/g, '$1');

  return cleaned;
}

import { renderPrompt } from '@server/lib/prompts';
import type { LogSpan } from '@shared/engine/battle-v5/systems/log/types';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Attributes, Cultivator } from '@shared/types/cultivator';
import type { BreakthroughModifiers } from './breakthroughCalculator';

interface BattlePromptPayload {
  player: Cultivator;
  opponent: Cultivator;
  battleResult: {
    winnerId: string;
    turns: number;
    /** 玩家剩余气血 */
    playerHp?: number;
    /** 对手剩余气血 */
    opponentHp?: number;
    /** v5 结构化日志。AI 战报基于此分回合叙事 */
    logSpans: LogSpan[];
  };
}

function formatSpansAsBattleLog(spans: LogSpan[]): string {
  const byTurn = new Map<number, string[]>();
  for (const span of spans) {
    if (span.type !== 'action' && span.type !== 'action_after') continue;
    const lines = byTurn.get(span.turn) ?? [];
    for (const entry of span.entries) {
      const text =
        typeof (entry as unknown as { text?: string }).text === 'string'
          ? (entry as unknown as { text: string }).text
          : JSON.stringify(entry);
      lines.push(text);
    }
    byTurn.set(span.turn, lines);
  }
  const turns = [...byTurn.keys()].sort((a, b) => a - b);
  return turns
    .map((turn) => `【第${turn}回合】\n${(byTurn.get(turn) ?? []).join('\n')}`)
    .join('\n');
}

function summarizeCultivator(cultivator: Cultivator): string {
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
}

export function getBattleReportPrompt({
  player,
  opponent,
  battleResult,
}: BattlePromptPayload): [string, string] {
  const winner = battleResult.winnerId === opponent.id ? opponent : player;
  const battleLog = formatSpansAsBattleLog(battleResult.logSpans ?? []);
  const { system, user } = renderPrompt('battle-report', {
    playerSummary: summarizeCultivator(player),
    opponentSummary: summarizeCultivator(opponent),
    battleLog,
    winnerName: winner.name,
    turns: battleResult.turns,
    playerName: player.name,
    playerHp: battleResult.playerHp ?? '未知',
    opponentName: opponent.name,
    opponentHp: battleResult.opponentHp ?? '未知',
  });

  return [system, user];
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
  const { system, user } = renderPrompt('breakthrough-story', {
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    wisdom: cultivator.attributes.wisdom,
    roots,
    cultivations,
    fates,
    age: cultivator.age,
    lifespan: cultivator.lifespan,
    yearsSpent: summary.yearsSpent,
    fromRealm: summary.fromRealm,
    fromStage: summary.fromStage,
    toRealm: targetRealm,
    toStage: targetStage,
    breakthroughType: summary.isMajor ? '大境界突破' : '小境界精进',
    lifespanGained: summary.lifespanGained,
    attributeGain,
  });

  return [system, user];
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
  const { system, user } = renderPrompt('lifespan-exhausted', {
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    wisdom: cultivator.attributes.wisdom,
    roots,
    cultivations:
      cultivator.cultivations?.map((c) => c.name).join('，') || '无',
    fates,
    age: cultivator.age,
    lifespan: cultivator.lifespan,
    yearsSpent: summary.yearsSpent,
    fromRealm: summary.fromRealm,
    fromStage: summary.fromStage,
    toRealm: summary.toRealm ?? summary.fromRealm,
    toStage: summary.toStage ?? summary.fromStage,
  });

  return [system, user];
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
  cleaned = cleaned.replace(/[`{}=:$@#%^&*|~<>[\\\]_+]/g, '');

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
    cheatKeywords.map((k) => k.replace(/[.*+?^${}()|[\\]/g, '\\$&')).join('|'),
    'gi',
  );

  cleaned = cleaned.replace(keywordPattern, '');

  // 6. （可选）压缩连续非文字字符（防止符号残留组合）
  // cleaned = cleaned.replace(/[^a-zA-Z\u4e00-\u9fa5·—。！？；：、“”‘’（）【】《》]+/g, '');

  // 7. 移除可能因关键词删除产生的多余连续符号（如“炼丹！！！” → “炼丹”）
  cleaned = cleaned.replace(/([·—。！？；：、“”‘’（）【】《》])\1+/g, '$1');

  return cleaned;
}

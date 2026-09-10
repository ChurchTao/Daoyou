import { renderPrompt } from '@server/lib/prompts';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Attributes, Cultivator } from '@shared/types/cultivator';
import { getAttributeInfo } from '@shared/lib/gameConceptDisplay';
import type { BreakthroughModifiers } from './breakthroughCalculator';

export type RetreatStoryCultivator = Pick<
  Cultivator,
  | 'name'
  | 'realm'
  | 'realm_stage'
  | 'age'
  | 'lifespan'
  | 'attributes'
  | 'cultivation_progress'
  | 'spiritual_roots'
  | 'pre_heaven_fates'
>;

function summarizeRootElements(
  cultivator: Pick<Cultivator, 'spiritual_roots'>,
): string {
  return cultivator.spiritual_roots?.map((root) => root.element).join('，') ?? '未知';
}

function summarizeFateNames(
  cultivator: Pick<Cultivator, 'pre_heaven_fates'>,
): string {
  return cultivator.pre_heaven_fates?.map((fate) => fate.name).join('，') ?? '无';
}

export interface BreakthroughStoryPayload {
  cultivator: RetreatStoryCultivator;
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
    naturalAttributeGrowth?: number;
    attributePointReward?: number;
    lifespanDepleted: boolean;
    modifiers: BreakthroughModifiers;
  };
}

export function getBreakthroughStoryPrompt({
  cultivator,
  summary,
}: BreakthroughStoryPayload): [string, string] {
  const roots = summarizeRootElements(cultivator);
  const fates = summarizeFateNames(cultivator);
  const attributeGainParts: string[] = [];
  if (summary.naturalAttributeGrowth && summary.naturalAttributeGrowth > 0) {
    attributeGainParts.push(
      `六维各自然成长 ${summary.naturalAttributeGrowth} 点`,
    );
  }
  if (summary.attributePointReward !== undefined) {
    attributeGainParts.push(`获得 ${summary.attributePointReward} 点可分配属性点`);
  }
  const attributeGain =
    attributeGainParts.length > 0
      ? attributeGainParts.join('，')
      : formatAttributeGrowth(summary.attributeGrowth);
  const targetRealm = summary.toRealm ?? summary.fromRealm;
  const targetStage = summary.toStage ?? summary.fromStage;
  const { system, user } = renderPrompt('breakthrough-story', {
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    insight: cultivator.cultivation_progress?.comprehension_insight ?? 0,
    roots,
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
  cultivator: RetreatStoryCultivator;
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
    naturalAttributeGrowth?: number;
    attributePointReward?: number;
    lifespanDepleted: boolean;
    modifiers: BreakthroughModifiers;
  };
}

export function getLifespanExhaustedStoryPrompt({
  cultivator,
  summary,
}: LifespanExhaustedStoryPayload): [string, string] {
  const roots = summarizeRootElements(cultivator);
  const fates = summarizeFateNames(cultivator);
  const { system, user } = renderPrompt('lifespan-exhausted', {
    name: cultivator.name,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    insight: cultivator.cultivation_progress?.comprehension_insight ?? 0,
    roots,
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
    { key: 'vitality', label: getAttributeInfo('vitality').label },
    { key: 'strength', label: getAttributeInfo('strength').label },
    { key: 'spirit', label: getAttributeInfo('spirit').label },
    { key: 'endurance', label: getAttributeInfo('endurance').label },
    { key: 'speed', label: getAttributeInfo('speed').label },
    { key: 'willpower', label: getAttributeInfo('willpower').label },
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

import type {
  AttributeModifierConfig,
  BuffConfig,
  EffectConfig,
  ListenerConfig,
} from '../../core/configs';
import { ModifierType } from '../../core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { attrLabel } from './attributes';
import { formatAffixNumber, formatAffixPercent } from './format';
import { labelTagList } from './gameplayTagText';
import { describeListener } from './listeners';

type EffectTextFormatter = (
  effect: EffectConfig,
  context?: { buffTags?: string[] },
) => string;

const BUFF_ID_LABELS: Record<string, string> = {
  karma_mirror_ready: '业镜',
  thunder_devour_charge: '蓄雷',
  thunder_mark: '雷印',
  blood_ink_talisman: '血墨符',
  wind_exchange_step: '借风',
  heaven_jealousy: '天妒',
  leakless_body: '无漏',
  steal_heaven_first_buff: '偷天印',
  calamity_debt: '劫债',
};

export function describeBuffMatch(match: { id?: string; tags?: string[] }): string {
  if (match.id) return `「${BUFF_ID_LABELS[match.id] ?? '该状态'}」`;
  if (match.tags?.length) return labelTagList(match.tags);
  return '状态';
}

export function describeBuffType(type: BuffConfig['type']): string {
  switch (type) {
    case 'buff':
      return '正面状态';
    case 'debuff':
      return '负面状态';
    case 'control':
      return '控制状态';
    default:
      return '状态';
  }
}

export function describeStackRule(rule: BuffConfig['stackRule']): string {
  switch (rule) {
    case 'stack_layer':
      return '可叠层，同名状态会增加层数';
    case 'refresh_duration':
      return '重复命中时刷新持续时间';
    case 'override':
      return '新效果会覆盖旧效果';
    case 'ignore':
      return '已有同名状态时忽略新效果';
    default:
      return '按状态规则处理';
  }
}

export function describeStackRuleShort(rule: BuffConfig['stackRule']): string {
  switch (rule) {
    case 'stack_layer':
      return '可叠层';
    case 'refresh_duration':
      return '重复命中刷新持续';
    case 'override':
      return '新效果覆盖旧效果';
    case 'ignore':
      return '已有时不重复附加';
    default:
      return '';
  }
}

export function describeBuffStatusEffects(buff: BuffConfig): string[] {
  const statusTags = buff.statusTags ?? [];
  return [
    statusTags.includes(GameplayTags.STATUS.CONTROL.NO_ACTION)
      ? '无法行动'
      : '',
    statusTags.includes(GameplayTags.STATUS.CONTROL.NO_SKILL)
      ? '无法施放神通'
      : '',
    statusTags.includes(GameplayTags.STATUS.CONTROL.NO_BASIC)
      ? '无法普通攻击'
      : '',
  ].filter(Boolean);
}

export function formatBuffModifier(mod: AttributeModifierConfig): string {
  const label = attrLabel(mod.attrType);
  const value = mod.value;
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';

  switch (mod.type) {
    case ModifierType.ADD:
      return `${label} ${sign}${formatAffixPercent(abs)}`;
    case ModifierType.MULTIPLY:
      return `${label} ×${formatAffixNumber(value)}`;
    case ModifierType.BASE:
    case ModifierType.FIXED:
    default:
      return `${label} ${sign}${formatAffixNumber(abs)}`;
  }
}

export function describeBuffListenerInline(
  listener: ListenerConfig,
  buffTags: string[] | undefined,
  stackRule: BuffConfig['stackRule'],
  describeEffect: EffectTextFormatter,
): string {
  const trigger = describeListener({
    eventType: listener.eventType,
    scope: listener.scope,
    priority: listener.priority,
    ...(listener.mapping ? { mapping: listener.mapping } : {}),
    ...(listener.guard ? { guard: listener.guard } : {}),
  });
  const effectTexts = listener.effects.map((effect) =>
    describeEffect(effect, { buffTags }),
  );
  const stackText =
    stackRule === 'stack_layer' && buffTags?.includes(GameplayTags.BUFF.DOT.ROOT)
      ? '，按层数放大'
      : '';

  return `${trigger || '触发时'}${effectTexts.join('、')}${stackText}`;
}

export function describeBuffListener(
  listener: ListenerConfig,
  buffTags: string[] | undefined,
  describeEffect: EffectTextFormatter,
): string {
  const trigger = describeListener({
    eventType: listener.eventType,
    scope: listener.scope,
    priority: listener.priority,
    ...(listener.mapping ? { mapping: listener.mapping } : {}),
    ...(listener.guard ? { guard: listener.guard } : {}),
  });
  const effectTexts = listener.effects.map((effect) =>
    describeEffect(effect, { buffTags }),
  );
  return `${trigger || '触发时'}：${effectTexts.join('、')}`;
}

export function describeBuffRuntimeSummary(
  buff: BuffConfig,
  describeEffect: EffectTextFormatter,
): string[] {
  if (buff.description) return [buff.description];

  return [
    ...describeBuffStatusEffects(buff),
    ...(buff.modifiers ?? []).map(formatBuffModifier),
    ...(buff.listeners ?? []).map((listener) =>
      describeBuffListenerInline(listener, buff.tags, buff.stackRule, describeEffect),
    ),
  ].filter(Boolean);
}

export function describeBuffRuntimeSummaryText(
  buff: BuffConfig,
  describeEffect: EffectTextFormatter,
): string | undefined {
  const summary = describeBuffRuntimeSummary(buff, describeEffect);
  return summary.length > 0 ? summary.join('；') : undefined;
}

export function describeApplyBuffText(
  buff: BuffConfig,
  chance: number | undefined,
  target: 'caster' | 'target' | undefined,
  describeEffect: EffectTextFormatter,
): string {
  const chanceText =
    chance !== undefined ? `${formatAffixPercent(chance)}概率` : '';
  const targetText = target === 'caster' ? '自身' : target === 'target' ? '目标' : '';
  const stateParts = [
    describeBuffType(buff.type),
    buff.duration === -1 ? '常驻' : `${buff.duration}回合`,
    describeStackRuleShort(buff.stackRule),
  ].filter(Boolean);
  const effectParts = describeBuffRuntimeSummary(buff, describeEffect);
  const detail = [...stateParts, ...effectParts].join('；');
  const targetPrefix = targetText ? `给${targetText}` : '';

  return `${chanceText}${targetPrefix}附加「${buff.name}」${detail ? `（${detail}）` : ''}`;
}

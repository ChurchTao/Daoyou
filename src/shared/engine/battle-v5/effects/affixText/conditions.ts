/**
 * 条件 → 中文前缀的翻译。
 *
 * 输入一组 ConditionConfig，产出如 "被暴击时"、"气血低于30%时"、"35%概率" 等短句，
 * 供 renderAffixLine 作为"触发条件"段落。
 */
import type { ConditionConfig } from '../../core/configs';
import { formatAffixPercent } from './format';
import type { AffixTextRenderContext } from './context';

const ELEMENT_TAG_TO_LABEL: Record<string, string> = {
  'Ability.Element.Fire': '火',
  'Ability.Element.Water': '水',
  'Ability.Element.Wood': '木',
  'Ability.Element.Earth': '土',
  'Ability.Element.Metal': '金',
  'Ability.Element.Wind': '风',
  'Ability.Element.Ice': '冰',
  'Ability.Element.Thunder': '雷',
};

const CHANNEL_TAG_TO_LABEL: Record<string, string> = {
  'Ability.Channel.Magic': '法术',
  'Ability.Channel.Physical': '物理',
  'Ability.Channel.True': '真实',
};

function tagLabel(tag: string): string {
  if (ELEMENT_TAG_TO_LABEL[tag]) return `${ELEMENT_TAG_TO_LABEL[tag]}系`;
  if (CHANNEL_TAG_TO_LABEL[tag]) return CHANNEL_TAG_TO_LABEL[tag];
  const leaf = tag.split('.').pop() ?? tag;
  return leaf;
}

type RenderSubject = 'self' | 'target';

function resolveConditionSubject(
  scope: ConditionConfig['params']['scope'],
  context?: AffixTextRenderContext,
): RenderSubject {
  if (scope === 'caster') {
    return context?.listenerScope === 'owner_as_target' ? 'target' : 'self';
  }

  return context?.listenerScope === 'owner_as_caster' ||
    context?.listenerScope === 'owner_as_actor'
    ? 'target'
    : 'self';
}

function prefixSubject(subject: RenderSubject, text: string): string {
  return `${subject === 'self' ? '自身' : '目标'}${text}`;
}

function usesCasterPerspective(context?: AffixTextRenderContext): boolean {
  return (
    context?.listenerScope === 'owner_as_caster' ||
    context?.listenerScope === 'owner_as_actor'
  );
}

function describeDamageTagCondition(
  tag: string,
  context: AffixTextRenderContext | undefined,
  negative = false,
): string {
  const prefix = usesCasterPerspective(context) ? '造成' : '受到';
  return `${prefix}${negative ? '非' : ''}「${tagLabel(tag)}」伤害时`;
}

function describeOne(
  cond: ConditionConfig,
  context?: AffixTextRenderContext,
): string | null {
  const { type, params } = cond;
  const subject = resolveConditionSubject(params.scope, context);
  switch (type) {
    case 'is_critical':
      return usesCasterPerspective(context) ? '暴击时' : '被暴击时';
    case 'chance':
      return params.value !== undefined
        ? `${formatAffixPercent(params.value)}概率`
        : null;
    case 'hp_below':
      return params.value !== undefined
        ? prefixSubject(subject, `气血低于${formatAffixPercent(params.value)}`)
        : null;
    case 'hp_above':
      return params.value !== undefined
        ? prefixSubject(subject, `气血高于${formatAffixPercent(params.value)}`)
        : null;
    case 'mp_below':
      return params.value !== undefined
        ? prefixSubject(subject, `真元低于${formatAffixPercent(params.value)}`)
        : null;
    case 'mp_above':
      return params.value !== undefined
        ? prefixSubject(subject, `真元高于${formatAffixPercent(params.value)}`)
        : null;
    case 'has_shield':
      return prefixSubject(subject, '存在护盾');
    case 'buff_count_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `至少${params.value}层增益`)
        : null;
    case 'debuff_count_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `至少${params.value}层减益`)
        : null;
    case 'damage_type_is': {
      const labels: Record<string, string> = {
        physical: '物理',
        magical: '法术',
        true: '真实',
        dot: '持续',
      };
      return params.damageType
        ? `${usesCasterPerspective(context) ? '造成' : '受到'}${labels[params.damageType] ?? params.damageType}伤害时`
        : null;
    }
    case 'shield_absorbed_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `护盾至少吸收${params.value}`)
        : null;
    case 'has_tag':
    case 'has_tag_on':
      return params.tag
        ? prefixSubject(subject, `持有「${tagLabel(params.tag)}」`)
        : null;
    case 'has_not_tag':
      return params.tag
        ? prefixSubject(subject, `未持有「${tagLabel(params.tag)}」`)
        : null;
    case 'ability_has_tag':
      return params.tag ? describeDamageTagCondition(params.tag, context) : null;
    case 'ability_has_not_tag':
      return params.tag
        ? describeDamageTagCondition(params.tag, context, true)
        : null;
    default:
      return null;
  }
}

/**
 * 将条件数组翻译成中文短句（无末尾"时"字），例如：
 * [is_critical]                             → "被暴击"
 * [hp_below 0.3, chance 0.35]               → "气血低于30% 且 35%概率"
 * [ability_has_tag: Ability.Element.Fire]   → "受到「火系」伤害"
 */
export function describeConditions(
  conditions: ConditionConfig[] | undefined,
  context?: AffixTextRenderContext,
): string {
  if (!conditions || conditions.length === 0) return '';
  const parts = conditions
    .map((cond) => describeOne(cond, context))
    .filter((p): p is string => p !== null && p.length > 0);
  if (parts.length === 0) return '';
  return parts.join('且');
}

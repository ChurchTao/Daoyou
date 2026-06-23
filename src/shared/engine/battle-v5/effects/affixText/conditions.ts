/**
 * 条件 → 中文前缀的翻译。
 *
 * 输入一组 ConditionConfig，产出如 "被暴击时"、"气血低于30%时"、"35%概率" 等短句，
 * 供 renderAffixLine 作为"触发条件"段落。
 */
import { getResourceLabel } from '@shared/lib/gameConceptDisplay';
import type { ConditionConfig } from '../../core/configs';
import { formatAffixPercent } from './format';
import type { AffixTextRenderContext } from './context';
import { labelDamageType, labelGameplayTag } from './gameplayTagText';

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
  return `${prefix}${negative ? '非' : ''}${labelGameplayTag(tag)}伤害时`;
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
    case 'is_lethal':
      return '受到致命伤时';
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
        ? prefixSubject(subject, `${getResourceLabel('mp')}低于${formatAffixPercent(params.value)}`)
        : null;
    case 'mp_above':
      return params.value !== undefined
        ? prefixSubject(subject, `${getResourceLabel('mp')}高于${formatAffixPercent(params.value)}`)
        : null;
    case 'has_shield':
      return prefixSubject(subject, '存在护盾');
    case 'buff_count_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `至少${params.value}层增益`)
        : null;
    case 'buff_layer_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `「${params.id ?? params.tag ?? '状态'}」至少${params.value}层`)
        : null;
    case 'debuff_count_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `至少${params.value}层减益`)
        : null;
    case 'damage_type_is': {
      return params.damageType
        ? `${usesCasterPerspective(context) ? '造成' : '受到'}${labelDamageType(params.damageType)}时`
        : null;
    }
    case 'shield_absorbed_at_least':
      return params.value !== undefined
        ? prefixSubject(subject, `护盾至少吸收${params.value}`)
        : null;
    case 'resource_compare': {
      const resource = getResourceLabel(params.resource ?? 'mp');
      const left = params.left === 'target' ? '目标' : '自身';
      const right = params.right === 'target' ? '目标' : '自身';
      const op = params.op === 'lte' || params.op === 'lt' ? '不高于' : '高于';
      return `${left}${resource}${op}${right}${resource}`;
    }
    case 'has_tag':
    case 'has_tag_on':
      return params.tag
        ? prefixSubject(subject, `处于「${labelGameplayTag(params.tag)}」`)
        : null;
    case 'has_not_tag':
      return params.tag
        ? prefixSubject(subject, `未处于「${labelGameplayTag(params.tag)}」`)
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

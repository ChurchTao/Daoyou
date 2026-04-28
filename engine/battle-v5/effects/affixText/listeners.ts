/**
 * AffixListenerSpec → 中文前缀的翻译。
 *
 * 将词缀的 listenerSpec（eventType + scope）转化为 "受击时" / "每回合" 等前缀，
 * 用于 renderAffixLine 拼接整句。
 */
import type { AffixListenerSpec } from '@/engine/creation-v2/affixes/types';
import type { ListenerScope } from '../../core/configs';
import type { AffixTextRenderContext } from './context';

const EVENT_LABEL: Record<string, string> = {
  DamageTakenEvent: '受击后',
  DamageRequestEvent: '造成伤害时',
  DamageEvent: '伤害结算时',
  RoundPreEvent: '每回合',
  ActionPreEvent: '行动前',
  SkillCastEvent: '施法时',
  BuffAddEvent: '获得状态时',
  DeathPreventEvent: '免死触发时',
};

function describeDamageTakenListener(scope?: ListenerScope): string {
  switch (scope) {
    case 'owner_as_caster':
      return '造成伤害后';
    case 'owner_as_actor':
    case 'global':
      return '伤害结算后';
    case 'owner_as_target':
    default:
      return '受击后';
  }
}

function describeDamageRequestListener(scope?: ListenerScope): string {
  switch (scope) {
    case 'owner_as_target':
      return '将受伤害时';
    case 'owner_as_actor':
    case 'global':
      return '伤害计算时';
    case 'owner_as_caster':
    default:
      return '造成伤害时';
  }
}

/**
 * 把 listenerSpec 翻译成中文前缀。无 listener（静态属性词条）返回空串。
 */
export function describeListener(
  spec?: AffixListenerSpec,
  context?: AffixTextRenderContext,
): string {
  if (!spec) return '';
  const eventType = context?.eventType ?? spec.eventType;
  const scope = context?.listenerScope ?? spec.scope;

  switch (eventType) {
    case 'DamageTakenEvent':
      return describeDamageTakenListener(scope);
    case 'DamageRequestEvent':
      return describeDamageRequestListener(scope);
    default:
      return EVENT_LABEL[eventType] ?? '';
  }
}

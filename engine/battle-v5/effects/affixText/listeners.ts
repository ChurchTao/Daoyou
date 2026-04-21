/**
 * AffixListenerSpec → 中文前缀的翻译。
 *
 * 将词缀的 listenerSpec（eventType + scope）转化为 "受击时" / "每回合" 等前缀，
 * 用于 renderAffixLine 拼接整句。
 */
import type { AffixListenerSpec } from '@/engine/creation-v2/affixes/types';

const EVENT_LABEL: Record<string, string> = {
  DamageTakenEvent: '受击时',
  DamageRequestEvent: '攻击时',
  DamageEvent: '伤害结算时',
  RoundPreEvent: '每回合',
  ActionPreEvent: '行动前',
  SkillCastEvent: '施法时',
  BuffAddEvent: '获得状态时',
  DeathPreventEvent: '免死触发时',
};

/**
 * 把 listenerSpec 翻译成中文前缀。无 listener（静态属性词条）返回空串。
 */
export function describeListener(spec?: AffixListenerSpec): string {
  if (!spec) return '';
  return EVENT_LABEL[spec.eventType] ?? '';
}

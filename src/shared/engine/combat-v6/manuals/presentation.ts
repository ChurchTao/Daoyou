import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/characterAttributeLabels';
import { manualAttributeValue } from './attributes';
import { manualMechanismValue } from './mechanism';
import type { ManualMechanism } from './pack';
import type { CharacterManualDefV1 } from './types';

const conditions: Record<ManualMechanism['condition'], string> = {
  always: '',
  selfHpBelow50: '自身气血低于50%时，',
  selfHpBelow35: '自身气血低于35%时，',
  selfHpAbove70: '自身气血高于70%时，',
  targetHpBelow50: '目标气血低于50%时，',
  targetHpBelow35: '目标气血低于35%时，',
  targetHpAbove70: '目标气血高于70%时，',
  selfMpBelow50: '自身法力低于50%时，',
  selfMpAbove50: '自身法力高于50%时，',
  selfMpAbove70: '自身法力高于70%时，',
  defending: '自身防御时，',
  selfBarrier: '自身有护盾时，',
  targetBarrier: '目标有护盾时，',
  targetDot: '目标带有持续伤害状态时，',
  selfControl: '自身处于可解除封印时，',
  selfDebuff: '自身带有减益状态时，',
};
const damageLabels = { physical: '物理', spell: '法术', fixed: '普通固定' };
export function manualMechanismDescription(
  manual: CharacterManualDefV1,
  level: number,
): string {
  const effect = manual.mechanism;
  const value = Number((manualMechanismValue(effect, level) * 100).toFixed(6));
  const prefix = conditions[effect.condition];
  switch (effect.type) {
    case 'damage':
      return `${prefix}普攻、宗门主动技能对主目标的直接${effect.kinds.map((k) => damageLabels[k]).join('、')}伤害+${value}%`;
    case 'mitigation':
      return `${prefix}受到的直接${effect.kinds.map((k) => damageLabels[k]).join('、')}伤害-${value}%`;
    case 'heal':
      return `${prefix}宗门主动技能对主目标的治疗量+${value}%`;
    case 'barrier':
      return `${prefix}宗门主动技能对主目标的护盾量+${value}%`;
    case 'evasion':
      return `${prefix}直接物理攻击的命中概率-${value}%（概率差值）`;
    case 'sealResist':
      return `受到封印时，对方封印成功概率-${value}%（概率差值，遵守封印上下限）`;
    case 'restoreHp':
      return `回合结束时，${prefix}恢复最大气血的${value}%`;
    case 'restoreMp':
      return `回合结束时，${prefix}恢复最大法力的${value}%`;
  }
}
export function manualEffectLines(
  manual: CharacterManualDefV1,
  level: number,
): string[] {
  return [
    ...manual.effects.map(
      (e) =>
        `${CHARACTER_ATTRIBUTE_LABELS[e.attribute]} +${manualAttributeValue(e, level)}`,
    ),
    manualMechanismDescription(manual, level),
  ];
}

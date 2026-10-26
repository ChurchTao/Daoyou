import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import { manualAttributeValue } from './attributes.js';
import { manualMechanismValue } from './mechanism-value.js';
import type { ManualMechanism } from '@daoyou/game-domain/manuals/authoring';
import type { CharacterManualDefV1 } from '@daoyou/game-domain/manuals';

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
const damageLabels = { physical: '物理', spell: '法术', fixed: '固定' };
export function manualMechanismDescription(
  manual: CharacterManualDefV1,
  level: number,
  nextLevel?: number,
): string {
  const effect = manual.mechanism;
  const value = Number((manualMechanismValue(effect, level) * 100).toFixed(6));
  const nextValue = nextLevel === undefined ? undefined : Number((manualMechanismValue(effect, nextLevel) * 100).toFixed(6));
  const percent = (divisor = 1) => nextValue === undefined
    ? `${value / divisor}%`
    : `${value / divisor}% → ${nextValue / divisor}%`;
  const prefix = conditions[effect.condition];
  switch (effect.type) {
    case 'damage':
      return `${prefix}普攻和宗门技能对主目标的直接${effect.kinds.map((k) => damageLabels[k]).join('、')}伤害+${value}%`;
    case 'mitigation':
      return `${prefix}受到的直接${effect.kinds.map((k) => damageLabels[k]).join('、')}伤害-${value}%`;
    case 'heal':
      return `${prefix}宗门技能对主目标的治疗量+${value}%`;
    case 'barrier':
      return `${prefix}宗门技能对主目标的护盾量+${value}%`;
    case 'evasion':
      return `${prefix}直接物理攻击的命中概率-${value}%`;
    case 'sealResist':
      return `受到封印时，对方封印成功概率-${value}%`;
    case 'restoreHp':
      return `回合结束时，${prefix}恢复最大气血的${value}%`;
    case 'restoreMp':
      return `回合结束时，${prefix}恢复最大法力的${value}%`;
    case 'sealRecovery':
      return `封印自然结束或被己方解除后，再次被封印的概率降低${percent()}，持续至下回合末。`;
    case 'primaryDamage':
      return `普攻和主动技能对主目标的直接伤害提高${percent()}，不含按气血比例扣除的伤害。`;
    case 'healingBarrier':
      return `主动治疗后，为存活人物主目标附加其最大气血${percent()}的护盾，不超过自身最大气血${percent()}。每回合1次，持续至下回合末。`;
    case 'focusedPhysical':
      return `连续物理攻击同一主目标时，从第2次攻击起忽视${percent()}物防。换目标或改用其他行动后重新计数。`;
    case 'defendBarrier':
      return `防御后获得最大气血${percent()}的护盾，持续至下回合末。`;
    case 'dotMitigation':
      return `受到中毒、灼烧等持续气血伤害降低${percent()}。`;
    case 'secondaryMitigation':
      return `受到群体攻击时，若自身不是主目标，物理和法术伤害降低${percent()}。`;
    case 'dotDamage':
      return `自身对敌人造成的中毒、灼烧等持续气血伤害提高${percent()}。`;
    case 'barrierDamage':
      return `普攻和主动技能对护盾造成的物理、法术伤害提高${percent()}。额外破盾不会伤及气血。`;
    case 'adaptiveMitigation':
      return `根据上回合最后一次使自身损失气血的敌方物理或法术攻击，本回合受到该类伤害降低${percent()}。`;
    case 'openingBarrier':
      return `开战时获得最大法力${percent()}的护盾，上限为最大气血${percent(2)}，持续至第2回合末。`;
    case 'damageBarrier':
      return `每回合首次用普攻或主动技能打伤主目标后，获得该次直接气血伤害${percent()}的护盾，上限为最大气血${percent(2)}，持续至下回合末。按气血比例扣除的伤害不计入。`;
    case 'damageRecovery':
      return `普攻和主动技能打伤主目标后，按直接气血伤害的${percent()}恢复自身气血；每次出手最多恢复最大气血${percent(2)}。按气血比例扣除的伤害不计入。`;
    case 'heavyMitigation':
      return `受到敌方物理或法术攻击时，单段伤害超过自身最大气血15%的部分减少${percent()}。`;
    case 'physicalFury':
      return `普攻和主动物理技能的狂暴几率+${percent()}。`;
    case 'debuffDefenseIgnore':
      return `法术攻击带有我方施加的可驱散减益、封印或持续气血伤害的敌人时，忽视${percent()}法防。`;
    case 'defendWeaken':
      return `防御后，下回合首次用物理或法术攻击打伤主目标时，使其下一次物理、法术出手伤害降低${percent()}。削弱持续至下回合末。`;
    case 'followupMitigation':
      return `每回合首次被敌方物理或法术攻击打伤后，本回合后续受到的物理和法术伤害降低${percent()}。`;
    case 'repeatedMitigation':
      return `同一敌人连续用相同招式打伤自身时，从第2次出手起，该招式的物理和法术伤害降低${percent()}。其他敌人或招式打伤自身后重新识破。`;
    case 'unhurtRecovery':
      return `回合末，若自身缺血且本回合未损失气血，恢复最大气血${percent()}。每场战斗最多恢复3次。`;
    case 'secondaryDamage':
      return `群体主动技能对主目标以外的敌人直接伤害提高${percent()}，不含按气血比例扣除的伤害。`;
    case 'attackDispel':
      return `普攻或主动技能打伤主目标后，有${percent()}概率驱散其1项提升攻防、速度等数值的增益。每2回合最多尝试1次。`;
    case 'selfCleanse':
      return `每回合开始，有${percent()}概率解除自身1项敌方造成的属性减益或持续气血伤害，不能解除封印。`;
    case 'preActionMitigation':
      return `每回合开始至自身出手结束，受到的物理和法术伤害降低${percent()}。因封印或休息跳过出手时，防护也随之结束。`;
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

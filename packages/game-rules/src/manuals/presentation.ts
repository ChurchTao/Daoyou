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
    case 'sealRecovery':
      return `可解除封印自然结束或被友方驱散后，至下回合末受到封印的成功率乘以${100 - value}%；每回合至多获得1次，不主动解封`;
    case 'primaryDamage':
      return `宗门主动对主目标的直接伤害+${value}%；含普通固定伤害，排除比例伤害、持续伤害和派生伤害`;
    case 'healingBarrier':
      return `正常完成甘露愿／归元愿后，为存活人物主目标附加其最大气血${value}%的护盾，且不超过自身最大气血${value}%；每回合1次，至下回合末`;
    case 'focusedPhysical':
      return `连续实际物理攻击同一主目标时，后续宗门物理主动忽视${value}%物防；仅1档，强制休息和受控跳过不中断，主动换目标或改用辅助中断`;
    case 'defendBarrier':
      return `实际执行防御后，获得最大气血${value}%的自身护盾，至下回合末；同源不叠加`;
    case 'dotMitigation':
      return `受到魂毒、蚀骨魂毒、余火的气血跳伤-${value}%；在封顶后减免，不减少扣蓝或直接攻击`;
    case 'secondaryMitigation':
      return `作为群攻非主目标时，受到的直接物理／法术伤害-${value}%；不减主目标伤害或持续伤害`;
    case 'dotDamage':
      return `本人施加的魂毒、蚀骨魂毒、余火气血跳伤+${value}%；封顶后增幅1次，不改变跳数、扣蓝和绕盾`;
    case 'barrierDamage':
      return `宗门主动直接法术对护盾的损耗+${value}%；额外耗盾不转为气血伤害`;
    case 'adaptiveMitigation':
      return `按上回合最后一次使自身掉血的敌方直接物理／法术类型，本回合同类直接伤害-${value}%；每次只适应1类`;
    case 'openingBarrier':
      return `每场首回合获得最大法力${value}%的护盾，不超过最大气血${value / 2}%；不扣法力，至第2回合末`;
    case 'damageBarrier':
      return `每回合首个造成主目标实际掉血的宗门攻击结束后，按整次合格实伤的${value}%获得短盾，上限最大气血${value / 2}%；至下回合末`;
    case 'damageRecovery':
      return `宗门主动对主目标造成合格实际掉血后，按${value}%恢复自身气血；整次出手上限最大气血${value / 2}%，不计盾吸收、比例或派生伤害`;
    case 'heavyMitigation':
      return `敌方直接物理／法术单段伤害在计算阶段超过自身最大气血15%的部分减少${value}%；先计算防护再扣盾，不是气血损失硬上限`;
    case 'physicalFury':
      return `宗门主动物理攻击的狂暴概率+${value}%（概率差值），沿用物理狂暴结算，不增加攻击次数`;
    case 'debuffDefenseIgnore':
      return `宗门主动法术攻击带可净化普通数值减益的目标时，忽视${value}%法防；不将封印、印记或持续伤害算作该减益`;
    case 'defendWeaken':
      return `防御后，下回合首次造成主目标实际掉血的宗门物理／法术攻击附加折锋：该敌人下次物理／法术伤害行动-${value}%；准备与折锋均短期有效，可驱散`;
    case 'followupMitigation':
      return `每回合首次被敌方直接物理／法术攻击造成实际掉血后，本回合后续此类伤害-${value}%；首击不减，同次攻击后续段也生效，不含普通固定伤害、持续伤害或自损`;
    case 'repeatedMitigation':
      return `最近同一敌人连续使用同一宗门攻击招式对本人造成直接物理／法术伤害时，后续出手伤害-${value}%；仅1档，多段不自行完成识破，换敌或换招重记`;
    case 'unhurtRecovery':
      return `回合末本回合未发生任何气血减少且缺血时，恢复最大气血${value}%；每场至多3次，气血费用与自损也打断，不储存过量`;
    case 'secondaryDamage':
      return `宗门主动群攻对非主目标的直接伤害+${value}%；含普通固定伤害，排除比例伤害、持续伤害和派生伤害`;
    case 'attackDispel':
      return `宗门主动使主目标实际掉血后，有${value}%概率驱散其1项普通数值增益；每2回合至多尝试1次，无合格增益不尝试，不吞护盾或规则状态`;
    case 'selfCleanse':
      return `每回合开始，有${value}%概率净除自身1项敌方普通数值减益或气血持续伤害；不要求2种负面，不解封印、规则状态和自施代价`;
    case 'preActionMitigation':
      return `每回合开始至自身行动窗口结束，所受敌方直接物理／法术伤害-${value}%；受控或休息跳过也结束防护，不改变先后手`;
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

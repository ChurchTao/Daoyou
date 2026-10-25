import type { CharacterManualDefV1 } from '@daoyou/game-domain/manuals';
import { manualMechanismDescription } from '@daoyou/game-rules/manuals/presentation';
import { manualMechanismValue } from '@daoyou/game-rules/manuals/projection';

export function manualMechanismSummary(
  manual: CharacterManualDefV1,
  level: number,
) {
  const effect = manual.mechanism;
  const description = manualMechanismDescription(manual, level);
  switch (effect.type) {
    case 'damage':
    case 'mitigation':
    case 'heal':
    case 'barrier':
    case 'evasion':
    case 'sealResist':
    case 'restoreHp':
    case 'restoreMp':
      break;
    default:
      return {
        condition: '',
        label: '',
        value: '',
        tag: {
          sealRecovery: '抗封',
          primaryDamage: '主攻',
          healingBarrier: '护持',
          focusedPhysical: '专攻',
          defendBarrier: '守御',
          dotMitigation: '化毒',
          secondaryMitigation: '避锋',
          dotDamage: '蚀伤',
          barrierDamage: '破盾',
          adaptiveMitigation: '应变',
          openingBarrier: '凝盾',
          damageBarrier: '攻守',
          damageRecovery: '汲血',
          heavyMitigation: '削峰',
          physicalFury: '狂暴',
          debuffDefenseIgnore: '破防',
          defendWeaken: '折锋',
          followupMitigation: '承势',
          repeatedMitigation: '识破',
          unhurtRecovery: '调息',
          secondaryDamage: '群攻',
          attackDispel: '驱散',
          selfCleanse: '自净',
          preActionMitigation: '先御',
        }[effect.type],
        description,
        fullRule: true,
      };
  }
  const firstSeparator = description.indexOf('，');
  const separator =
    effect.type === 'restoreHp' || effect.type === 'restoreMp'
      ? description.indexOf('，', firstSeparator + 1)
      : firstSeparator;
  const condition =
    separator < 0 ? '受到封印时' : description.slice(0, separator);
  const kinds =
    'kinds' in effect
      ? effect.kinds
          .map(
            (k) => ({ physical: '物理', spell: '法术', fixed: '普通固定' })[k],
          )
          .join('／')
      : '';
  const label =
    effect.type === 'damage'
      ? `${kinds}伤害`
      : effect.type === 'mitigation'
        ? `受到${kinds}伤害`
        : {
            heal: '主动治疗量',
            barrier: '主动护盾量',
            evasion: '敌方物理命中率',
            sealResist: '敌方封印成功率',
            restoreHp: '恢复最大气血',
            restoreMp: '恢复最大法力',
          }[effect.type];
  const negative = ['mitigation', 'evasion', 'sealResist'].includes(
    effect.type,
  );
  const value = Number((manualMechanismValue(effect, level) * 100).toFixed(6));
  const tag = {
    damage: '增伤',
    mitigation: '减伤',
    heal: '养元',
    barrier: '护盾',
    evasion: '闪避',
    sealResist: '抗封',
    restoreHp: '回气',
    restoreMp: '回灵',
  }[effect.type];
  return {
    condition,
    label,
    value: `${negative ? '−' : '+'}${value}%`,
    tag,
    description,
    fullRule: false,
  };
}

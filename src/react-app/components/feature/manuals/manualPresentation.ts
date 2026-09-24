import { manualMechanismValue } from '@shared/engine/combat-v6/manuals/mechanism';
import { manualMechanismDescription } from '@shared/engine/combat-v6/manuals/presentation';
import type { CharacterManualDefV1 } from '@shared/engine/combat-v6/manuals/types';

export function manualMechanismSummary(
  manual: CharacterManualDefV1,
  level: number,
) {
  const effect = manual.mechanism;
  const description = manualMechanismDescription(manual, level);
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
  const unit =
    effect.type === 'evasion' || effect.type === 'sealResist' ? '百分点' : '%';
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
    value: `${negative ? '−' : '+'}${value}${unit}`,
    tag,
    description,
  };
}

/**
 * EffectConfig → 词缀效果核心文本（"动词 + 数值"）。
 *
 * 约定：这里只描述"做什么 + 多少"，**不**包含触发条件、**不**包含监听语境前缀。
 * 条件与监听由 conditions.ts / listeners.ts 分别处理，再由 index.ts 统一拼接。
 *
 * 例：
 *   reflect 34%            → "反弹 34% 伤害"
 *   shield {base=38, ...}  → "获得护盾 38 + 神识×29%"
 *   heal mp                → "回复真元 12 + 灵力×40%"
 */
import type { EffectConfig } from '../../core/configs';
import { formatAffixNumber, formatAffixPercent } from './format';
import { formatScalableValue } from './values';

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

function prettyTagList(tags: string[]): string {
  return tags
    .map(
      (t) =>
        ELEMENT_TAG_TO_LABEL[t] ??
        CHANNEL_TAG_TO_LABEL[t] ??
        t.split('.').pop() ??
        t,
    )
    .join('、');
}

export function describeEffectCore(effect: EffectConfig): string {
  switch (effect.type) {
    case 'damage':
      return `造成 ${formatScalableValue(effect.params.value)} 点伤害`;

    case 'heal': {
      const resource = effect.params.target === 'mp' ? '真元' : '气血';
      return `回复${resource} ${formatScalableValue(effect.params.value)}`;
    }

    case 'shield':
      return `获得护盾 ${formatScalableValue(effect.params.value)}`;

    case 'mana_burn':
      return `削减真元 ${formatScalableValue(effect.params.value)}`;

    case 'reflect':
      return `反弹 ${formatAffixPercent(effect.params.ratio)} 伤害`;

    case 'resource_drain': {
      const source = effect.params.sourceType === 'hp' ? '伤害' : '真元消耗';
      const target = effect.params.targetType === 'hp' ? '气血' : '真元';
      return `将 ${formatAffixPercent(effect.params.ratio)} ${source}转化为${target}`;
    }

    case 'percent_damage_modifier': {
      const action = effect.params.mode === 'increase' ? '增伤' : '减伤';
      return `${action} ${formatAffixPercent(effect.params.value)}`;
    }

    case 'death_prevent':
      if (effect.params.hpFloorPercent === undefined) {
        return '免死保留 1 点气血';
      }
      return `免死保留 ${formatAffixPercent(effect.params.hpFloorPercent)} 气血`;

    case 'damage_immunity':
      return `免疫${prettyTagList(effect.params.tags)}伤害`;

    case 'buff_immunity':
      return `免疫状态：${prettyTagList(effect.params.tags)}`;

    case 'dispel':
      return `驱散 ${effect.params.maxCount ?? 1} 个状态`;

    case 'magic_shield':
      return `法盾吸收上限 ${formatAffixPercent(effect.params.absorbRatio ?? 0.98)}`;

    case 'apply_buff': {
      const chance =
        effect.params.chance !== undefined
          ? `（${formatAffixPercent(effect.params.chance)}）`
          : '';
      return `附加「${effect.params.buffConfig.name}」${chance}`;
    }

    case 'cooldown_modify': {
      const action = effect.params.cdModifyValue >= 0 ? '增加' : '减少';
      return `${action}冷却 ${formatAffixNumber(Math.abs(effect.params.cdModifyValue))} 回合`;
    }

    case 'tag_trigger':
      if (effect.params.damageRatio !== undefined) {
        return `命中「${effect.params.triggerTag}」触发额外伤害（系数 ${formatAffixPercent(effect.params.damageRatio)}）`;
      }
      return `命中「${effect.params.triggerTag}」触发额外效果`;

    case 'buff_duration_modify': {
      const action = effect.params.rounds >= 0 ? '延长' : '缩短';
      return `${action}状态 ${Math.abs(effect.params.rounds)} 回合`;
    }

    default: {
      const exhaustive: never = effect;
      return (exhaustive as EffectConfig).type;
    }
  }
}

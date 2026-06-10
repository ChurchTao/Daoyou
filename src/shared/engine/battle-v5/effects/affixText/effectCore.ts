/**
 * EffectConfig → 词缀效果核心文本（"动词 + 数值"）。
 *
 * 约定：这里只描述"做什么 + 多少"，**不**包含触发条件、**不**包含监听语境前缀。
 * 条件与监听由 conditions.ts / listeners.ts 分别处理，再由 index.ts 统一拼接。
 *
 * 例：
 *   reflect 34%            → "反弹 34% 伤害"
 *   shield {base=38, ...}  → "获得护盾 38 + 神识×29%"
 *   heal mp                → "回复法力 12 + 灵力×40%"
 */
import { getResourceLabel } from '@shared/lib/gameConceptDisplay';
import type { EffectConfig } from '../../core/configs';
import { formatAffixNumber, formatAffixPercent } from './format';
import { formatScalableValue } from './values';
import {
  inferDamageTypeLabels,
  labelGameplayTag,
  labelTagList,
} from './gameplayTagText';

export interface EffectCoreTextContext {
  abilityTags?: string[];
  buffTags?: string[];
  listenerScope?: string;
}

export function describeEffectCore(
  effect: EffectConfig,
  context: EffectCoreTextContext = {},
): string {
  switch (effect.type) {
    case 'damage': {
      const damageLabel = inferDamageTypeLabels({
        abilityTags: context.abilityTags,
        buffTags: context.buffTags,
      })[0] ?? '伤害';
      return `造成 ${formatScalableValue(effect.params.value)} 点${damageLabel}`;
    }

    case 'heal': {
      const resource = getResourceLabel(effect.params.target ?? 'hp');
      return `回复${resource} ${formatScalableValue(effect.params.value)}`;
    }

    case 'shield':
      return `获得护盾 ${formatScalableValue(effect.params.value)}`;

    case 'mana_burn':
      return `削减法力 ${formatScalableValue(effect.params.value)}`;

    case 'reflect':
      return `反弹 ${formatAffixPercent(effect.params.ratio)} 伤害`;

    case 'resource_drain': {
      const source =
        effect.params.sourceType === 'hp' ? '伤害' : '法力消耗';
      const target = getResourceLabel(effect.params.targetType);
      return `将 ${formatAffixPercent(effect.params.ratio)} ${source}转化为${target}`;
    }

    case 'percent_damage_modifier': {
      if (effect.params.mode === 'increase') {
        return `提升造成的伤害 ${formatAffixPercent(effect.params.value)}`;
      }
      return `降低受到的伤害 ${formatAffixPercent(effect.params.value)}`;
    }

    case 'death_prevent':
      if (effect.params.hpFloorPercent === undefined) {
        return '免疫死亡保留 1 点气血';
      }
      return `免疫死亡保留 ${formatAffixPercent(effect.params.hpFloorPercent)} 气血`;

    case 'damage_immunity':
      return `免疫${labelTagList(effect.params.tags)}伤害`;

    case 'buff_immunity':
      return `免疫状态：${labelTagList(effect.params.tags)}`;

    case 'dispel':
      return effect.params.targetTag
        ? `驱散 ${effect.params.maxCount ?? 1} 个${labelGameplayTag(effect.params.targetTag)}`
        : `驱散 ${effect.params.maxCount ?? 1} 个状态`;

    case 'magic_shield':
      return `优先使用法力吸收受到的伤害，吸收比例 ${formatAffixPercent(effect.params.absorbRatio ?? 0.98)}`;

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
        return `命中「${labelGameplayTag(effect.params.triggerTag)}」触发额外伤害（系数 ${formatAffixPercent(effect.params.damageRatio)}）`;
      }
      return `命中「${labelGameplayTag(effect.params.triggerTag)}」触发额外效果`;

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

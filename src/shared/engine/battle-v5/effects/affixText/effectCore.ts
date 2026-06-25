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
import {
  describeApplyBuffText,
  describeBuffMatch,
} from './buffText';

export interface EffectCoreTextContext {
  abilityTags?: string[];
  buffTags?: string[];
  listenerScope?: string;
}

export function describeEffectCore(
  effect: EffectConfig,
  context: EffectCoreTextContext = {},
): string {
  const describeChildren = (effects: readonly EffectConfig[]) =>
    effects.map((child) => describeEffectCore(child, context)).join('、');

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
      return describeApplyBuffText(
        effect.params.buffConfig,
        effect.params.chance,
        effect.params.target,
        (child, childContext) =>
          describeEffectCore(child, {
            ...context,
            ...childContext,
          }),
      );
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

    case 'consume_status_trigger':
      return `消耗${describeBuffMatch(effect.params.match)}后${describeChildren(effect.params.effects)}`;

    case 'delayed_effect':
      return `${effect.params.delayTurns} 回合后触发「${effect.params.name}」：${describeChildren(effect.params.effects)}`;

    case 'damage_memory':
      if (effect.params.mode === 'record') {
        return `记录${describeMemoryEvent(effect.params.event)}${effect.params.maxStored !== undefined ? `，上限 ${formatAffixNumber(effect.params.maxStored)}` : ''}`;
      }
      if (effect.params.mode === 'clear') return '清除战斗记忆';
      return `将记录值的 ${formatAffixPercent(effect.params.ratio ?? 1)} 转为${describeMemoryRelease(effect.params.releaseAs)}`;

    case 'buff_layer_modify':
      return `${describeLayerOperation(effect.params.operation, effect.params.layers)}${describeBuffMatch(effect.params.match)}${effect.params.effects?.length ? `并${effect.params.scaleEffectsByLayer ? '按原层数重复' : ''}${describeChildren(effect.params.effects)}` : ''}`;

    case 'ability_transform':
      return `强化下一次神通：${describeTransform(effect.params)}`;

    case 'hp_sacrifice_damage':
      return `消耗当前气血 ${formatAffixPercent(effect.params.hpRatio)} 追加伤害`;

    case 'ability_lock':
      return `封禁神通 ${effect.params.rounds} 回合`;

    case 'status_spread':
      return `扩散${describeBuffMatch(effect.params.match)}（1v1 无额外目标时不生效）`;

    case 'buff_copy':
      return `${effect.params.maxTriggers ? `最多 ${effect.params.maxTriggers} 次，` : ''}${effect.params.replayRemoved ? '重施最近被驱散的' : '复制'}${effect.params.match ? describeBuffMatch(effect.params.match) : '状态'}给${effect.params.target === 'target' ? '目标' : '自身/施加者'}${effect.params.durationDelta ? `，持续延长 ${formatAffixNumber(effect.params.durationDelta)} 回合` : ''}`;

    case 'damage_defer':
      return `延迟结算 ${formatAffixPercent(effect.params.ratio)} 伤害`;

    case 'next_hit_rule':
      return effect.params.forceCritical ? '下一次命中必定暴击' : '强化下一次命中';

    case 'dynamic_scalar':
      return `根据${effect.params.resource === 'hp' ? '气血' : '法力'}动态修正伤害`;

    case 'turn_state_counter':
      return `累计 ${effect.params.threshold} 次${effect.params.event === 'no_damage_dealt' ? '未造成伤害' : '造成伤害'}后${describeChildren(effect.params.effects)}`;

    case 'element_history':
      return `集齐 ${effect.params.threshold} 种元素后${describeChildren(effect.params.effects)}`;

    case 'effect_sequence':
      return describeChildren(effect.params.effects);

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

function describeMemoryEvent(event?: string): string {
  switch (event) {
    case 'damage_dealt':
      return '造成伤害';
    case 'heal':
      return '治疗量';
    case 'shield':
      return '护盾量';
    case 'critical_taken':
      return '受到暴击伤害';
    case 'damage_taken':
    default:
      return '受到伤害';
  }
}

function describeMemoryRelease(releaseAs?: string): string {
  switch (releaseAs) {
    case 'heal':
      return '治疗';
    case 'shield':
      return '护盾';
    case 'reflect':
      return '反射伤害';
    case 'damage':
    default:
      return '伤害';
  }
}

function describeLayerOperation(operation: string, layers?: number): string {
  switch (operation) {
    case 'add':
      return `增加 ${formatAffixNumber(layers ?? 1)} 层`;
    case 'subtract':
      return `减少 ${formatAffixNumber(layers ?? 1)} 层`;
    case 'clear':
      return '清空';
    case 'set':
      return `设为 ${formatAffixNumber(layers ?? 1)} 层`;
    default:
      return '调整';
  }
}

function describeTransform(params: {
  trueDamage?: boolean;
  addDispel?: unknown;
  mpCostToHp?: boolean;
  cooldownModify?: number;
  forceCritical?: boolean;
  bonusDamageMemory?: { ratio?: number };
}): string {
  const parts = [
    params.trueDamage ? '转为真实伤害' : '',
    params.forceCritical ? '必定暴击' : '',
    params.addDispel ? '附带驱散' : '',
    params.mpCostToHp ? '法力消耗改为气血消耗' : '',
    params.cooldownModify !== undefined
      ? `冷却${params.cooldownModify >= 0 ? '增加' : '减少'} ${formatAffixNumber(Math.abs(params.cooldownModify))} 回合`
      : '',
    params.bonusDamageMemory
      ? `附加记录值 ${formatAffixPercent(params.bonusDamageMemory.ratio ?? 1)} 伤害`
      : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('、') : '获得一次强化';
}

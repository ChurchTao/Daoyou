import type {
  AbilityConfig,
  AttributeModifierConfig,
  CombatResourceDefinition,
  ConditionConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  AttributeType,
  DamageSource,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import type { ScalableValue } from '@shared/engine/battle-v5/core/ValueCalculator';
import { describeEffectCore } from '@shared/engine/battle-v5/effects/affixText/effectCore';

const ATTRIBUTE_LABELS: Partial<Record<AttributeType, string>> = {
  [AttributeType.ATK]: '物攻',
  [AttributeType.DEF]: '物防',
  [AttributeType.MAGIC_ATK]: '法攻',
  [AttributeType.MAGIC_DEF]: '法防',
  [AttributeType.SPEED]: '身法',
  [AttributeType.EVASION_RATE]: '闪避',
  [AttributeType.CONTROL_RESISTANCE]: '控制抗性',
};

const DAMAGE_SOURCE_LABELS: Partial<Record<DamageSource, string>> = {
  [DamageSource.DIRECT]: '直接',
  [DamageSource.COUNTER]: '反击',
  [DamageSource.FOLLOW_UP]: '追击',
  [DamageSource.REFLECT]: '反伤',
};

function number(value: number): string {
  return String(Number(value.toFixed(2)));
}

function conditionText(condition: ConditionConfig): string {
  if (
    condition.type === 'attribute_compare' &&
    condition.params.attribute &&
    condition.params.left &&
    condition.params.right
  ) {
    const left = condition.params.left === 'caster' ? '自身' : '目标';
    const right = condition.params.right === 'caster' ? '自身' : '目标';
    const attribute =
      ATTRIBUTE_LABELS[condition.params.attribute] ??
      condition.params.attribute;
    const operation =
      condition.params.op === 'gt' || condition.params.op === 'gte'
        ? '高于'
        : '低于';
    return `${left}${attribute}${operation}${right}`;
  }
  if (
    condition.type === 'damage_source_is' &&
    condition.params.damageSource === 'direct'
  ) {
    return '受到直接伤害';
  }
  return '';
}

function joinEffects(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join('、')}，并${parts[parts.length - 1]}`;
}

function percent(value: number): string {
  return `${number(value * 100)}%`;
}

function resourceName(
  resourceId: string,
  resources: readonly CombatResourceDefinition[],
): string {
  return (
    resources.find((resource) => resource.id === resourceId)?.name ?? '战斗资源'
  );
}

function scalableValue(value: ScalableValue): string {
  const parts: string[] = [];
  if (value.base) parts.push(number(value.base));
  if (value.attribute) {
    const label = ATTRIBUTE_LABELS[value.attribute] ?? value.attribute;
    parts.push(`${number((value.coefficient ?? 1) * 100)}%${label}`);
  }
  if (value.targetMaxHpRatio)
    parts.push(`${percent(value.targetMaxHpRatio)}目标最大气血`);
  if (value.targetMaxMpRatio)
    parts.push(`${percent(value.targetMaxMpRatio)}目标最大法力`);
  return parts.join(' + ') || '0';
}

function modifierText(modifier: AttributeModifierConfig): string {
  const label = ATTRIBUTE_LABELS[modifier.attrType] ?? modifier.attrType;
  if (
    modifier.type === ModifierType.FIXED &&
    [AttributeType.EVASION_RATE, AttributeType.CONTROL_RESISTANCE].includes(
      modifier.attrType,
    )
  ) {
    return `${label}+${number(modifier.value * 100)}个百分点`;
  }
  if (modifier.type === ModifierType.ADD) {
    return `${label}${modifier.value >= 0 ? '+' : ''}${percent(modifier.value)}`;
  }
  return `${label}${modifier.value >= 0 ? '+' : ''}${number(modifier.value)}`;
}

function damageSourceScopeText(
  sources: readonly DamageSource[] | undefined,
): string {
  if (!sources?.length) return '';
  const labels = sources.map(
    (source) => DAMAGE_SOURCE_LABELS[source] ?? source,
  );
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join('、')}和${labels[labels.length - 1]}`;
}

function damageEffectsRow(
  effects: readonly EffectConfig[],
  resources: readonly CombatResourceDefinition[],
): string[] {
  const damageEffects = effects.filter(
    (effect): effect is Extract<EffectConfig, { type: 'damage' }> =>
      effect.type === 'damage',
  );
  if (damageEffects.length === 0) return [];

  const unconditional = damageEffects.filter(
    (effect) => !effect.conditions?.length,
  );
  const resourceConditional = damageEffects.filter((effect) =>
    effect.conditions?.some(
      (condition) => condition.type === 'combat_resource_at_least',
    ),
  );
  if (
    unconditional.length === 1 &&
    resourceConditional.length > 1 &&
    resourceConditional.every(
      (effect) =>
        scalableValue(effect.params.value) ===
        scalableValue(resourceConditional[0].params.value),
    )
  ) {
    const condition = resourceConditional[0].conditions?.find(
      (candidate) => candidate.type === 'combat_resource_at_least',
    );
    const name =
      condition?.type === 'combat_resource_at_least' &&
      condition.params.resourceId
        ? resourceName(condition.params.resourceId, resources)
        : '战斗资源';
    return [
      `伤害：基础相当于${scalableValue(unconditional[0].params.value)}，每点${name}追加一段相当于${scalableValue(resourceConditional[0].params.value)}`,
      ...(damageEffects.every((effect) => effect.params.forceCritical)
        ? ['暴击：整次施法全部伤害段必定暴击']
        : []),
    ];
  }

  if (
    damageEffects.every((effect) => !effect.conditions?.length) &&
    damageEffects.every(
      (effect) =>
        scalableValue(effect.params.value) ===
          scalableValue(damageEffects[0].params.value) &&
        effect.params.damageSource === damageEffects[0].params.damageSource,
    )
  ) {
    const label = scalableValue(damageEffects[0].params.value);
    return [
      damageEffects.length > 1
        ? `伤害：${damageEffects.length}段 × ${label}`
        : `伤害：相当于${label}`,
      ...(damageEffects.every((effect) => effect.params.forceCritical)
        ? ['暴击：整次施法全部伤害段必定暴击']
        : []),
      ...(damageEffects.some((effect) => effect.params.bypassDefense)
        ? ['穿防：该伤害绕过防御']
        : []),
    ];
  }

  const unconditionalCount = damageEffects.filter(
    (effect) => !effect.conditions?.length,
  ).length;
  return damageEffects.flatMap((effect, index) => {
    const condition = effect.conditions
      ?.map(conditionText)
      .filter(Boolean)
      .join('且');
    const source = effect.params.damageSource === 'follow_up' ? '追击' : '伤害';
    const prefix = condition ? `${condition}时，` : '';
    const action = source === '追击' ? '追加' : '';
    const row = `${source}${unconditionalCount > 1 && !condition ? index + 1 : ''}：${prefix}${action}相当于${scalableValue(effect.params.value)}`;
    return [
      row,
      ...(effect.params.bypassDefense ? ['穿防：该伤害绕过防御'] : []),
    ];
  });
}

function listenerTrigger(listener: ListenerConfig): string {
  const direct = listener.conditions?.some(
    (condition) =>
      condition.type === 'damage_source_is' &&
      condition.params.damageSource === 'direct',
  );
  if (listener.eventType === 'DodgeEvent') {
    return listener.budget?.maxTriggers === 1 &&
      listener.budget.reset === 'buff_lifetime'
      ? '持续期间首次闪避时'
      : '闪避时';
  }
  if (listener.eventType === 'DamageTakenEvent') {
    if (
      listener.budget?.maxTriggers === 1 &&
      listener.budget.reset === 'round'
    ) {
      return `持续期间每回合首次${direct ? '受到直接伤害' : '受击'}时`;
    }
    return direct ? '受到直接伤害时' : '受击时';
  }
  return '';
}

function listenerChildText(
  effect: EffectConfig,
  resources: readonly CombatResourceDefinition[],
): string {
  switch (effect.type) {
    case 'damage': {
      const action =
        effect.params.damageSource === 'counter' ? '反击造成' : '追加';
      return `${action}相当于${scalableValue(effect.params.value)}的伤害`;
    }
    case 'combat_resource_modify': {
      const name = resourceName(effect.params.resourceId, resources);
      const amount = Math.abs(effect.params.amount ?? 0);
      return `${effect.params.operation === 'add' ? '获得' : '消耗'}${amount}点${name}`;
    }
    case 'shield':
      return `获得相当于${scalableValue(effect.params.value)}的护盾`;
    case 'apply_buff':
      return effect.params.target === 'target'
        ? `向目标施加1层${effect.params.buffConfig.name}${effect.params.buffConfig.duration >= 0 ? `，持续目标未来${effect.params.buffConfig.duration}次行动` : ''}`
        : `获得《${effect.params.buffConfig.name}》`;
    case 'dispel':
      return `驱散目标${effect.params.maxCount ?? 1}个正面状态`;
    case 'percent_damage_modifier':
      return effect.params.mode === 'reduce'
        ? `受到的直接伤害降低${percent(effect.params.value)}`
        : `造成的伤害提高${percent(effect.params.value)}`;
    default:
      return describeEffectCore(effect);
  }
}

function listenerRows(
  listener: ListenerConfig,
  resources: readonly CombatResourceDefinition[],
): string[] {
  if (
    listener.eventType === 'DamageRequestEvent' &&
    listener.effects.length === 1 &&
    listener.effects[0].type === 'percent_damage_modifier'
  ) {
    const child = listener.effects[0];
    return [
      child.params.mode === 'reduce'
        ? `承伤：受到的直接伤害降低${percent(child.params.value)}`
        : `伤害：造成的伤害提高${percent(child.params.value)}`,
    ];
  }
  const trigger = listenerTrigger(listener);
  const effects = listener.effects.map((effect) =>
    listenerChildText(effect, resources),
  );
  return effects.length
    ? [`触发：${trigger ? `${trigger}，` : ''}${joinEffects(effects)}`]
    : [];
}

function describeEffect(
  effect: EffectConfig,
  resources: readonly CombatResourceDefinition[],
  stackCount = 1,
): string[] {
  switch (effect.type) {
    case 'damage':
      return [];
    case 'combat_resource_modify': {
      const name = resourceName(effect.params.resourceId, resources);
      if (effect.params.operation === 'consume_all') {
        return [`施放后：消耗全部${name}`];
      }
      const amount = Math.abs(effect.params.amount ?? 0);
      if (effect.params.reason === 'refund')
        return [`${name}：返还${amount}点`];
      return [
        `${name}：${effect.params.operation === 'add' ? '获得' : '消耗'}${amount}点`,
      ];
    }
    case 'resource_scaled_damage': {
      const name = resourceName(effect.params.resourceId, resources);
      const rows = [
        `伤害：基础相当于${number(effect.params.baseCoefficient * 100)}%物攻，每点${name}增加${number(effect.params.coefficientPerPoint * 100)}%物攻`,
        `施放条件：至少${effect.params.minPoints ?? 0}点${name}`,
      ];
      if ((effect.params.bypassDefenseRatio ?? 0) > 0) {
        rows.push(`穿防：${percent(effect.params.bypassDefenseRatio ?? 0)}`);
      }
      if (
        effect.params.minPoints !== undefined &&
        effect.params.minPoints === effect.params.maxPoints
      ) {
        const points = effect.params.minPoints;
        rows.push(
          `${points}点${name}时总倍率：${number((effect.params.baseCoefficient + effect.params.coefficientPerPoint * points) * 100)}%物攻`,
        );
      }
      if (effect.params.forceCritical) rows.push('暴击：整次施法必定暴击');
      if (effect.params.consume) {
        rows.push(
          effect.params.consume === 'all'
            ? `施放后：消耗全部${name}`
            : `施放后：消耗${effect.params.consume}点${name}`,
        );
      }
      return rows;
    }
    case 'skip_action':
      return [`调息：施放后跳过未来${effect.params.count ?? 1}次自身行动`];
    case 'queue_action': {
      const nested = damageEffectsRow(effect.params.effects, resources).map(
        (row) => row.replace(/^伤害：/, '后发：'),
      );
      const rows = [
        `蓄势：下一次自身行动发动《${effect.params.name}》`,
        ...nested,
      ];
      if (effect.params.interruptPolicy === 'uninterruptible') {
        rows.push('蓄势：除自身死亡外不可打断');
      }
      if (effect.params.hitPolicy === 'guaranteed') rows.push('后发：必然命中');
      for (const child of effect.params.effects) {
        if (child.type !== 'damage')
          rows.push(...describeEffect(child, resources));
      }
      return rows;
    }
    case 'apply_buff': {
      const buff = effect.params.buffConfig;
      if (effect.params.target === 'target') {
        const rows = [
          `${buff.name}：向目标施加${stackCount}层${buff.duration >= 0 ? `，持续目标未来${buff.duration}次行动` : ''}`,
        ];
        if (buff.maxLayers) rows.push(`${buff.name}：最多${buff.maxLayers}层`);
        for (const modifier of buff.modifiers ?? []) {
          if (modifier.scaleByLayer)
            rows.push(`每层：${modifierText(modifier)}`);
        }
        for (const listener of buff.listeners ?? []) {
          for (const child of listener.effects) {
            if (
              child.type === 'percent_damage_modifier' &&
              child.params.scaleByBuffLayer
            ) {
              rows.push(
                child.params.mode === 'increase'
                  ? `每层：受到的${damageSourceScopeText(child.params.allowedDamageSources)}伤害提高${percent(child.params.value)}`
                  : `每层：受到的伤害降低${percent(child.params.value)}`,
              );
            }
          }
        }
        return rows;
      }
      const modifiers = buff.modifiers?.map(modifierText) ?? [];
      const rows =
        modifiers.length > 0
          ? [`状态：${modifiers.join('、')}`]
          : [`状态：自身获得《${buff.name}》`];
      if (buff.duration >= 0) rows.push(`持续：未来${buff.duration}次自身行动`);
      for (const listener of buff.listeners ?? []) {
        rows.push(...listenerRows(listener, resources));
      }
      return rows;
    }
    case 'shield':
      return [`护盾：相当于${scalableValue(effect.params.value)}`];
    case 'heal': {
      if (
        effect.params.target === 'hp' &&
        effect.params.value.targetMaxHpRatio
      ) {
        const subject = effect.params.recipient === 'caster' ? '自身' : '目标';
        return [
          `恢复：${percent(effect.params.value.targetMaxHpRatio)}${subject}最大气血`,
        ];
      }
      return [describeEffectCore(effect)];
    }
    case 'dispel':
      return [`驱散：目标${effect.params.maxCount ?? 1}个正面状态`];
    case 'ability_transform':
      return [describeEffectCore(effect)];
    case 'consume_status_trigger': {
      const consume =
        effect.params.consume === 'all'
          ? '全部'
          : typeof effect.params.consume === 'number'
            ? `${effect.params.consume}层`
            : '1层';
      const childRows = damageEffectsRow(effect.params.effects, resources).map(
        (row) => row.replace(/^伤害：/, '每层追加：'),
      );
      return [
        `状态：消耗${consume}${effect.params.displayName ?? '匹配状态'}`,
        ...childRows,
      ];
    }
    case 'runtime_counter_modify': {
      const nested = effect.params.effects ?? [];
      return [
        ...damageEffectsRow(nested, resources),
        ...nested.flatMap((child) => describeEffect(child, resources)),
      ];
    }
    case 'cooldown_modify':
      return effect.params.cdModifyValue < 0
        ? [`冷却：当前冷却减少${Math.abs(effect.params.cdModifyValue)}回合`]
        : [`冷却：当前冷却增加${effect.params.cdModifyValue}回合`];
    default:
      return [describeEffectCore(effect)];
  }
}

function describeEffectList(
  effects: readonly EffectConfig[],
  resources: readonly CombatResourceDefinition[],
  timing: 'hit' | 'cast',
): string[] {
  const rows: string[] = [];
  const handled = new Set<number>();
  effects.forEach((effect, index) => {
    if (handled.has(index) || effect.type === 'damage') return;
    if (
      effect.type === 'apply_buff' &&
      effect.params.target === 'target' &&
      effect.params.buffConfig.maxLayers
    ) {
      const matches = effects
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(
          ({ candidate }) =>
            candidate.type === 'apply_buff' &&
            candidate.params.target === 'target' &&
            candidate.params.buffConfig.id === effect.params.buffConfig.id,
        );
      matches.forEach(({ candidateIndex }) => handled.add(candidateIndex));
      rows.push(
        ...applyEffectTiming(
          effect,
          describeEffect(effect, resources, matches.length),
          timing,
        ),
      );
      return;
    }
    handled.add(index);
    rows.push(
      ...applyEffectTiming(effect, describeEffect(effect, resources), timing),
    );
  });
  return rows;
}

function applyEffectTiming(
  effect: EffectConfig,
  rows: readonly string[],
  timing: 'hit' | 'cast',
): string[] {
  const timingLabel = timing === 'hit' ? '命中后' : '施展后';
  return rows.map((row) => {
    if (
      row.startsWith('伤害：') ||
      row.startsWith('暴击：') ||
      row.startsWith('穿防：') ||
      row.startsWith('施放条件：') ||
      /点.+时总倍率：/.test(row)
    ) {
      return row;
    }
    if (effect.type === 'queue_action') {
      if (row.startsWith('后发：') || row.startsWith('蓄势：除')) return row;
      if (row.startsWith('蓄势：')) return `${timingLabel}：${row}`;
      return `后发命中后：${row.replace(/^施放后：/, '')}`;
    }
    if (row.startsWith('施放后：')) {
      return `${timingLabel}：${row.slice('施放后：'.length)}`;
    }
    return `${timingLabel}：${row}`;
  });
}

export function describeSectAbilityConfig(
  config: AbilityConfig,
  resources: readonly CombatResourceDefinition[],
): string[] {
  const rows: string[] = [];
  for (const condition of config.castConditions ?? []) {
    if (
      condition.type === 'combat_resource_at_least' &&
      condition.params.resourceId &&
      condition.params.value !== undefined
    ) {
      rows.push(
        `施放条件：至少${condition.params.value}点${resourceName(condition.params.resourceId, resources)}`,
      );
    }
  }
  rows.push(...damageEffectsRow(config.effects ?? [], resources));
  rows.push(
    ...describeEffectList(
      config.effects ?? [],
      resources,
      config.targetPolicy?.team === 'enemy' ? 'hit' : 'cast',
    ),
  );
  rows.push(...describeEffectList(config.castEffects ?? [], resources, 'cast'));
  return Array.from(new Set(rows.filter(Boolean)));
}

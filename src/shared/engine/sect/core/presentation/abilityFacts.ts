import type {
  AbilityConfig,
  AttributeModifierConfig,
  CombatResourceDefinition,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
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

function number(value: number): string {
  return Number(value.toFixed(2)).toFixed(value % 1 === 0 ? 0 : 2);
}

function percent(value: number): string {
  return `${number(value * 100)}%`;
}

function resourceName(
  resourceId: string,
  resources: readonly CombatResourceDefinition[],
): string {
  return resources.find((resource) => resource.id === resourceId)?.name ?? '战斗资源';
}

function scalableValue(value: ScalableValue): string {
  const parts: string[] = [];
  if (value.base) parts.push(number(value.base));
  if (value.attribute) {
    const label = ATTRIBUTE_LABELS[value.attribute] ?? value.attribute;
    parts.push(`${number(value.coefficient ?? 1)}${label}`);
  }
  if (value.targetMaxHpRatio) parts.push(`${percent(value.targetMaxHpRatio)}目标最大气血`);
  if (value.targetMaxMpRatio) parts.push(`${percent(value.targetMaxMpRatio)}目标最大法力`);
  return parts.join(' + ') || '0';
}

function modifierText(modifier: AttributeModifierConfig): string {
  const label = ATTRIBUTE_LABELS[modifier.attrType] ?? modifier.attrType;
  if (
    modifier.type === ModifierType.FIXED &&
    [
      AttributeType.EVASION_RATE,
      AttributeType.CONTROL_RESISTANCE,
    ].includes(modifier.attrType)
  ) {
    return `${label}+${number(modifier.value * 100)}个百分点`;
  }
  if (modifier.type === ModifierType.ADD) {
    return `${label}+${percent(modifier.value)}`;
  }
  return `${label}${modifier.value >= 0 ? '+' : ''}${number(modifier.value)}`;
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
    const name = condition?.type === 'combat_resource_at_least' && condition.params.resourceId
      ? resourceName(condition.params.resourceId, resources)
      : '战斗资源';
    return [
      `伤害：基础${scalableValue(unconditional[0].params.value)}，每点${name}追加一段${scalableValue(resourceConditional[0].params.value)}`,
      ...(damageEffects.every((effect) => effect.params.forceCritical)
        ? ['暴击：整次施法全部伤害段必定暴击']
        : []),
    ];
  }

  if (
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
        : `伤害：${label}`,
      ...(damageEffects.every((effect) => effect.params.forceCritical)
        ? ['暴击：整次施法全部伤害段必定暴击']
        : []),
      ...(damageEffects.some((effect) => effect.params.bypassDefense)
        ? ['穿防：该伤害绕过防御']
        : []),
    ];
  }

  return damageEffects.map(
    (effect, index) => `伤害${index + 1}：${scalableValue(effect.params.value)}`,
  );
}

function describeEffect(
  effect: EffectConfig,
  resources: readonly CombatResourceDefinition[],
): string[] {
  switch (effect.type) {
    case 'damage':
      return [];
    case 'combat_resource_modify': {
      const name = resourceName(effect.params.resourceId, resources);
      if (effect.params.operation === 'consume_all') return [`${name}：消耗全部`];
      const amount = Math.abs(effect.params.amount ?? 0);
      if (effect.params.reason === 'refund') return [`${name}：返还${amount}点`];
      return [
        `${name}：${effect.params.operation === 'add' ? '获得' : '消耗'}${amount}点`,
      ];
    }
    case 'resource_scaled_damage': {
      const name = resourceName(effect.params.resourceId, resources);
      const rows = [
        `伤害：单段${number(effect.params.baseCoefficient)}物攻 + 每点${name}${number(effect.params.coefficientPerPoint)}物攻`,
        `释放：至少${effect.params.minPoints ?? 0}点${name}`,
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
          `${points}点${name}时总倍率：${number(effect.params.baseCoefficient + effect.params.coefficientPerPoint * points)}物攻`,
        );
      }
      if (effect.params.forceCritical) rows.push('暴击：整次施法必定暴击');
      if (effect.params.consume) {
        rows.push(
          effect.params.consume === 'all'
            ? `释放后：消耗全部${name}`
            : `释放后：消耗${effect.params.consume}点${name}`,
        );
      }
      return rows;
    }
    case 'skip_action':
      return [`调息：施放后跳过未来${effect.params.count ?? 1}次自身行动`];
    case 'queue_action': {
      const nested = damageEffectsRow(effect.params.effects, resources).map((row) =>
        row.replace(/^伤害：/, '后发：'),
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
        if (child.type !== 'damage') rows.push(...describeEffect(child, resources));
      }
      return rows;
    }
    case 'apply_buff': {
      const buff = effect.params.buffConfig;
      const modifiers = buff.modifiers?.map(modifierText) ?? [];
      const rows = modifiers.length > 0
        ? [`状态：${modifiers.join('、')}`]
        : [`状态：获得《${buff.name}》`];
      if (buff.duration >= 0) rows.push(`持续：未来${buff.duration}次自身行动`);
      for (const listener of buff.listeners ?? []) {
        for (const child of listener.effects) {
          if (child.type === 'percent_damage_modifier') {
            rows.push(
              child.params.mode === 'reduce'
                ? `承伤：降低${percent(child.params.value)}`
                : `伤害：提高${percent(child.params.value)}`,
            );
          } else if (child.type === 'damage') {
            const source = child.params.damageSource === 'counter' ? '反击' : '追加伤害';
            rows.push(`${source}：${scalableValue(child.params.value)}`);
          } else if (child.type === 'combat_resource_modify') {
            rows.push(...describeEffect(child, resources));
          }
        }
      }
      return rows;
    }
    case 'shield':
      return [`护盾：${scalableValue(effect.params.value)}`];
    case 'dispel':
      return [`驱散：目标${effect.params.maxCount ?? 1}个正面状态`];
    case 'ability_transform':
      return [describeEffectCore(effect)];
    case 'consume_status_trigger': {
      const consume = effect.params.consume === 'all'
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
    case 'runtime_counter_modify':
      if (!effect.params.effects?.length) return [];
      return effect.params.effects.flatMap((child) => {
        if (child.type === 'damage') {
          const label = child.params.damageSource === 'follow_up'
            ? '追击'
            : child.params.damageSource === 'counter'
              ? '反击'
              : '追加伤害';
          return [`${label}：${scalableValue(child.params.value)}`];
        }
        return describeEffect(child, resources);
      });
    case 'cooldown_modify':
      return [
        `冷却：${effect.params.target === 'target' ? '目标' : '自身'}神通${effect.params.cdModifyValue >= 0 ? '+' : ''}${effect.params.cdModifyValue}`,
      ];
    default:
      return [describeEffectCore(effect)];
  }
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
        `释放：至少${condition.params.value}点${resourceName(condition.params.resourceId, resources)}`,
      );
    }
  }
  rows.push(...damageEffectsRow(config.effects ?? [], resources));
  for (const effect of config.effects ?? []) {
    if (effect.type !== 'damage') rows.push(...describeEffect(effect, resources));
  }
  for (const effect of config.castEffects ?? []) {
    rows.push(...describeEffect(effect, resources));
  }
  return Array.from(new Set(rows.filter(Boolean)));
}

import type {
  BuffConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import type { ScalableValue } from '@shared/engine/battle-v5/core/ValueCalculator';
import type {
  SectCompiledAbility,
  SectDefinition,
  SectHeartMethodDefinition,
  SectMethodEffectCategory,
  SectMethodGrowthCurve,
  SectMethodGrowthPolicy,
  SectMethodId,
} from '../domain';
import {
  normalizeSectMethodLevel,
  resolveSectMethodCurve,
  roundSectMethodGrowthValue,
  sectAbilityMethodId,
} from '../domain';
import { consumeSectBuffMethodGrowth } from './SectMethodGrowthAuthoring';

export interface SectMethodGrowthValues {
  methodId?: SectMethodId;
  level: number;
  curve?: SectMethodGrowthCurve;
  progress: number;
  damageMultiplier: number;
  healMultiplier: number;
  shieldMultiplier: number;
  statusMultiplier: number;
  durationBonus: number;
  countBonus: number;
}

function milestoneBonus(
  milestones: readonly { level: number; bonus: number }[] | undefined,
  level: number,
): number {
  return (milestones ?? []).reduce(
    (bonus, milestone) => (level >= milestone.level ? milestone.bonus : bonus),
    0,
  );
}

function assertNeverEffect(effect: never): never {
  throw new Error(`未声明心法成长语义的效果: ${JSON.stringify(effect)}`);
}

/** 依照每本心法自己的成长档案，将 authoring 配置投影为运行时配置。 */
export class StandardSectMethodGrowthPolicy implements SectMethodGrowthPolicy {
  private readonly methods: ReadonlyMap<
    SectMethodId,
    SectHeartMethodDefinition
  >;

  constructor(methods: readonly SectHeartMethodDefinition[]) {
    this.methods = new Map(methods.map((method) => [method.id, method]));
  }

  resolve(
    methodId: SectMethodId,
    rawLevel: number | undefined,
  ): SectMethodGrowthValues {
    const method = this.methods.get(methodId);
    if (!method) throw new Error(`未知心法成长档案: ${methodId}`);
    const level = normalizeSectMethodLevel(rawLevel);
    const profile = method.growthProfile;
    const progress = resolveSectMethodCurve(profile.curve, level);
    return {
      methodId,
      level,
      curve: profile.curve,
      progress,
      damageMultiplier: roundSectMethodGrowthValue(
        1 + profile.effects.damage * progress,
      ),
      healMultiplier: roundSectMethodGrowthValue(
        1 + profile.effects.heal * progress,
      ),
      shieldMultiplier: roundSectMethodGrowthValue(
        1 + profile.effects.shield * progress,
      ),
      statusMultiplier: roundSectMethodGrowthValue(
        1 + profile.effects.status * progress,
      ),
      durationBonus: milestoneBonus(profile.durationMilestones, level),
      countBonus: milestoneBonus(profile.countMilestones, level),
    };
  }

  scaleEffect(
    methodId: SectMethodId,
    category: SectMethodEffectCategory,
    value: number,
    rawLevel: number | undefined,
  ): number {
    return roundSectMethodGrowthValue(
      value * this.factor(this.resolve(methodId, rawLevel), category),
    );
  }

  growDuration(
    methodId: SectMethodId,
    duration: number,
    rawLevel: number | undefined,
  ): number {
    return duration < 0
      ? duration
      : duration + this.resolve(methodId, rawLevel).durationBonus;
  }

  growCount(
    methodId: SectMethodId,
    baseCount: number,
    rawLevel: number | undefined,
  ): number {
    return (
      Math.max(0, Math.floor(baseCount)) +
      this.resolve(methodId, rawLevel).countBonus
    );
  }

  projectAbility(
    ability: SectCompiledAbility,
    methodId: SectMethodId,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): SectCompiledAbility {
    return this.projectAbilityWithGrowth(
      ability,
      this.resolve(methodId, methodLevels[methodId]),
      methodLevels,
    );
  }

  projectAbilities(
    definition: SectDefinition,
    abilities: Record<string, SectCompiledAbility>,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): Record<string, SectCompiledAbility> {
    return Object.fromEntries(
      Object.entries(abilities).map(([abilityId, ability]) => {
        const abilityDefinition = definition.abilities.find(
          (entry) => entry.id === abilityId,
        );
        const methodId = abilityDefinition
          ? sectAbilityMethodId(abilityDefinition)
          : undefined;
        return [
          abilityId,
          methodId
            ? this.projectAbility(ability, methodId, methodLevels)
            : this.projectAbilityWithoutMethod(ability, methodLevels),
        ];
      }),
    );
  }

  projectAbilityWithoutMethod(
    ability: SectCompiledAbility,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): SectCompiledAbility {
    return this.projectAbilityWithGrowth(
      ability,
      this.neutralGrowth(),
      methodLevels,
    );
  }

  private projectAbilityWithGrowth(
    ability: SectCompiledAbility,
    growth: SectMethodGrowthValues,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): SectCompiledAbility {
    const projected = structuredClone(ability);
    projected.config.effects = projected.config.effects?.map((effect) =>
      this.projectEffect(effect, growth, methodLevels),
    );
    projected.config.completionEffects =
      projected.config.completionEffects?.map((effect) =>
        this.projectEffect(effect, growth, methodLevels),
      );
    projected.config.effectLayers = projected.config.effectLayers?.map(
      (layer) => ({
        ...layer,
        effects: layer.effects?.map((effect) =>
          this.projectEffect(effect, growth, methodLevels),
        ),
        completionEffects: layer.completionEffects?.map((effect) =>
          this.projectEffect(effect, growth, methodLevels),
        ),
      }),
    );
    projected.config.castEffects = projected.config.castEffects?.map((effect) =>
      this.projectEffect(effect, growth, methodLevels),
    );
    projected.config.listeners = projected.config.listeners?.map((listener) =>
      this.projectListener(listener, growth, methodLevels),
    );
    return projected;
  }

  private projectEffect(
    effect: EffectConfig,
    growth: SectMethodGrowthValues,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): EffectConfig {
    const projected = structuredClone(effect);
    switch (projected.type) {
      case 'damage':
        projected.params.value = this.scaleValue(
          projected.params.value,
          growth.damageMultiplier,
        );
        break;
      case 'heal':
        projected.params.value = this.scaleValue(
          projected.params.value,
          growth.healMultiplier,
        );
        break;
      case 'shield':
        projected.params.value = this.scaleValue(
          projected.params.value,
          growth.shieldMultiplier,
        );
        break;
      case 'resource_scaled_damage':
        projected.params.baseCoefficient = roundSectMethodGrowthValue(
          projected.params.baseCoefficient * growth.damageMultiplier,
        );
        projected.params.coefficientPerPoint = roundSectMethodGrowthValue(
          projected.params.coefficientPerPoint * growth.damageMultiplier,
        );
        break;
      case 'percent_damage_modifier':
        projected.params.value = roundSectMethodGrowthValue(
          projected.params.value * growth.statusMultiplier,
        );
        break;
      case 'apply_buff':
        projected.params.buffConfig = this.projectBuff(
          projected.params.buffConfig,
          growth,
          methodLevels,
        );
        break;
      case 'hp_sacrifice_damage':
        projected.params.damagePerHp = roundSectMethodGrowthValue(
          projected.params.damagePerHp * growth.damageMultiplier,
        );
        break;
      case 'tag_trigger':
        if (projected.params.damageRatio !== undefined) {
          projected.params.damageRatio = roundSectMethodGrowthValue(
            projected.params.damageRatio * growth.damageMultiplier,
          );
        }
        break;
      case 'dynamic_scalar':
        projected.params.value = roundSectMethodGrowthValue(
          projected.params.value * growth.statusMultiplier,
        );
        break;
      case 'resource_drain':
      case 'dispel':
      case 'magic_shield':
      case 'reflect':
      case 'mana_burn':
      case 'cooldown_modify':
      case 'buff_duration_modify':
      case 'consume_status_trigger':
      case 'delayed_effect':
      case 'damage_memory':
      case 'refund_paid_cost':
      case 'mechanic_log':
      case 'buff_layer_modify':
      case 'combat_resource_modify':
      case 'ability_transform':
      case 'ability_lock':
      case 'status_spread':
      case 'buff_copy':
      case 'damage_defer':
      case 'next_hit_rule':
      case 'turn_state_counter':
      case 'runtime_counter_modify':
      case 'effect_sequence':
      case 'death_prevent':
      case 'buff_immunity':
      case 'damage_immunity':
      case 'skill_immunity':
      case 'skip_action':
      case 'queue_action':
      case 'ability_mode':
      case 'lifesteal':
        break;
      default:
        assertNeverEffect(projected);
    }

    const params = projected.params as {
      effects?: EffectConfig[];
      fallbackEffects?: EffectConfig[];
      cancelEffects?: EffectConfig[];
      onResistEffects?: EffectConfig[];
    };
    for (const key of [
      'effects',
      'fallbackEffects',
      'cancelEffects',
      'onResistEffects',
    ] as const) {
      if (params[key]) {
        params[key] = params[key]!.map((nested) =>
          this.projectEffect(nested, growth, methodLevels),
        );
      }
    }
    return projected;
  }

  private projectBuff(
    buff: BuffConfig,
    inheritedGrowth: SectMethodGrowthValues,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): BuffConfig {
    const authored = consumeSectBuffMethodGrowth(buff);
    const growth = authored.growth?.methodId
      ? this.resolve(
          authored.growth.methodId,
          methodLevels[authored.growth.methodId],
        )
      : inheritedGrowth;
    const projected = authored.config;
    if (authored.growth?.duration && projected.duration >= 0) {
      projected.duration += growth.durationBonus;
    }
    projected.modifiers = projected.modifiers?.map((modifier) => ({
      ...modifier,
      value: roundSectMethodGrowthValue(
        modifier.value * growth.statusMultiplier,
      ),
    }));
    projected.listeners = projected.listeners?.map((listener) =>
      this.projectListener(listener, growth, methodLevels),
    );
    return projected;
  }

  private projectListener(
    listener: ListenerConfig,
    growth: SectMethodGrowthValues,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): ListenerConfig {
    return {
      ...listener,
      effects: listener.effects.map((effect) =>
        this.projectEffect(effect, growth, methodLevels),
      ),
    };
  }

  private scaleValue(value: ScalableValue, factor: number): ScalableValue {
    return {
      ...value,
      base:
        value.base === undefined
          ? undefined
          : roundSectMethodGrowthValue(value.base * factor),
      coefficient:
        value.coefficient === undefined
          ? undefined
          : roundSectMethodGrowthValue(value.coefficient * factor),
      targetMaxHpRatio:
        value.targetMaxHpRatio === undefined
          ? undefined
          : roundSectMethodGrowthValue(value.targetMaxHpRatio * factor),
      targetMaxMpRatio:
        value.targetMaxMpRatio === undefined
          ? undefined
          : roundSectMethodGrowthValue(value.targetMaxMpRatio * factor),
    };
  }

  private factor(
    growth: SectMethodGrowthValues,
    category: SectMethodEffectCategory,
  ): number {
    if (category === 'damage') return growth.damageMultiplier;
    if (category === 'heal') return growth.healMultiplier;
    if (category === 'shield') return growth.shieldMultiplier;
    return growth.statusMultiplier;
  }

  private neutralGrowth(): SectMethodGrowthValues {
    return {
      level: 0,
      progress: 0,
      damageMultiplier: 1,
      healMultiplier: 1,
      shieldMultiplier: 1,
      statusMultiplier: 1,
      durationBonus: 0,
      countBonus: 0,
    };
  }
}

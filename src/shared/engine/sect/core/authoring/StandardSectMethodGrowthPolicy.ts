import type {
  BuffConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import type { ScalableValue } from '@shared/engine/battle-v5/core/ValueCalculator';
import type {
  SectCompiledAbility,
  SectDefinition,
  SectMethodId,
} from '../domain';
import { consumeSectBuffMethodGrowth } from './SectMethodGrowthAuthoring';

export interface SectMethodGrowthValues {
  level: number;
  magnitude: number;
  statusMagnitude: number;
  durationBonus: number;
}

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

function assertNeverEffect(effect: never): never {
  throw new Error(`未声明心法成长语义的效果: ${JSON.stringify(effect)}`);
}

/** 宗门神通的标准 1–180 级投影策略。 */
export class StandardSectMethodGrowthPolicy {
  resolve(rawLevel: number | undefined): SectMethodGrowthValues {
    const normalized =
      rawLevel === undefined || Number.isNaN(rawLevel) ? 1 : rawLevel;
    const level = Math.max(1, Math.min(180, Math.floor(normalized)));
    if (level === 180) {
      return { level, magnitude: 1.5, statusMagnitude: 1.4, durationBonus: 3 };
    }
    if (level >= 150) {
      return {
        level,
        magnitude: 1.4167,
        statusMagnitude: 1.3333,
        durationBonus: 2,
      };
    }
    if (level >= 120) {
      return {
        level,
        magnitude: 1.3333,
        statusMagnitude: 1.2667,
        durationBonus: 2,
      };
    }
    if (level >= 90) {
      return { level, magnitude: 1.25, statusMagnitude: 1.2, durationBonus: 1 };
    }
    if (level >= 60) {
      return {
        level,
        magnitude: 1.1667,
        statusMagnitude: 1.1333,
        durationBonus: 1,
      };
    }
    if (level >= 30) {
      return {
        level,
        magnitude: 1.0833,
        statusMagnitude: 1.0667,
        durationBonus: 0,
      };
    }
    return { level, magnitude: 1, statusMagnitude: 1, durationBonus: 0 };
  }

  scaleMagnitude(value: number, rawLevel: number | undefined): number {
    return round4(value * this.resolve(rawLevel).magnitude);
  }

  scaleStatusMagnitude(value: number, rawLevel: number | undefined): number {
    return round4(value * this.resolve(rawLevel).statusMagnitude);
  }

  growDuration(duration: number, rawLevel: number | undefined): number {
    return duration < 0
      ? duration
      : duration + this.resolve(rawLevel).durationBonus;
  }

  projectAbility(
    ability: SectCompiledAbility,
    methodId: SectMethodId,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): SectCompiledAbility {
    const projected = structuredClone(ability);
    const growth = this.resolve(methodLevels[methodId]);
    projected.config.effects = projected.config.effects?.map((effect) =>
      this.projectEffect(effect, growth, methodLevels),
    );
    projected.config.castEffects = projected.config.castEffects?.map((effect) =>
      this.projectEffect(effect, growth, methodLevels),
    );
    return projected;
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
        if (!abilityDefinition) return [abilityId, ability];
        return [
          abilityId,
          this.projectAbility(
            ability,
            abilityDefinition.methodId,
            methodLevels,
          ),
        ];
      }),
    );
  }

  private projectEffect(
    effect: EffectConfig,
    growth: SectMethodGrowthValues,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): EffectConfig {
    const projected = structuredClone(effect);
    switch (projected.type) {
      case 'damage':
      case 'heal':
      case 'shield':
        projected.params.value = this.scaleValue(
          projected.params.value,
          growth.magnitude,
        );
        break;
      case 'resource_scaled_damage':
        projected.params.baseCoefficient = round4(
          projected.params.baseCoefficient * growth.magnitude,
        );
        projected.params.coefficientPerPoint = round4(
          projected.params.coefficientPerPoint * growth.magnitude,
        );
        break;
      case 'percent_damage_modifier':
        projected.params.value = round4(
          projected.params.value * growth.statusMagnitude,
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
        projected.params.damagePerHp = round4(
          projected.params.damagePerHp * growth.magnitude,
        );
        break;
      case 'tag_trigger':
        if (projected.params.damageRatio !== undefined) {
          projected.params.damageRatio = round4(
            projected.params.damageRatio * growth.magnitude,
          );
        }
        break;
      case 'dynamic_scalar':
        projected.params.value = round4(
          projected.params.value * growth.statusMagnitude,
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
      case 'element_history':
      case 'effect_sequence':
      case 'death_prevent':
      case 'buff_immunity':
      case 'damage_immunity':
      case 'skip_action':
      case 'queue_action':
        break;
      default:
        assertNeverEffect(projected);
    }

    const params = projected.params as {
      effects?: EffectConfig[];
      cancelEffects?: EffectConfig[];
    };
    if (params.effects) {
      params.effects = params.effects.map((nested) =>
        this.projectEffect(nested, growth, methodLevels),
      );
    }
    if (params.cancelEffects) {
      params.cancelEffects = params.cancelEffects.map((nested) =>
        this.projectEffect(nested, growth, methodLevels),
      );
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
      ? this.resolve(methodLevels[authored.growth.methodId])
      : inheritedGrowth;
    const projected = authored.config;
    if (authored.growth?.duration && projected.duration >= 0) {
      projected.duration += growth.durationBonus;
    }
    projected.modifiers = projected.modifiers?.map((modifier) => ({
      ...modifier,
      value: round4(modifier.value * growth.statusMagnitude),
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
      base: value.base === undefined ? undefined : round4(value.base * factor),
      coefficient:
        value.coefficient === undefined
          ? undefined
          : round4(value.coefficient * factor),
      targetMaxHpRatio:
        value.targetMaxHpRatio === undefined
          ? undefined
          : round4(value.targetMaxHpRatio * factor),
      targetMaxMpRatio:
        value.targetMaxMpRatio === undefined
          ? undefined
          : round4(value.targetMaxMpRatio * factor),
    };
  }
}

export const standardSectMethodGrowthPolicy =
  new StandardSectMethodGrowthPolicy();

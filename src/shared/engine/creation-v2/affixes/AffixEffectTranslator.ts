import { Quality, QUALITY_ORDER } from '@shared/types/constants';
import {
  ApplyBuffParams,
  AttributeType,
  EffectConfig,
} from '../contracts/battle';
import { RolledAffix } from '../types';
import {
  AffixEffectTemplate,
  AffixScalableValue,
  ScalableParam,
  ScalableValueV2,
  SCALE_MODE,
} from './types';

/**
 * 词缀效果翻译器
 *
 * 将 AffixEffectTemplate（品质缩放参数）解析为 battle-v5 可直接消费的 EffectConfig
 * 这是造物域与战斗域之间的唯一数值换算边界
 */
export class AffixEffectTranslator {
  /**
   * 翻译词缀定义 + 品质 → 具体 EffectConfig
   */
  translate(affix: RolledAffix, quality: Quality): EffectConfig {
    return this.withConditions(
      affix,
      this.resolveTemplate(
        affix.effectTemplate,
        QUALITY_ORDER[quality],
        affix.finalMultiplier,
      ),
    );
  }

  private withConditions(def: RolledAffix, effect: EffectConfig): EffectConfig {
    const conditions = def.effectTemplate.conditions;

    if (!conditions || conditions.length === 0) {
      return effect;
    }

    return {
      ...effect,
      conditions,
    };
  }

  private resolveTemplate(
    template: AffixEffectTemplate,
    qualityOrder: number,
    multiplier: number,
  ): EffectConfig {
    switch (template.type) {
      case 'damage':
        return {
          type: 'damage',
          params: {
            value: this.resolveScalableValue(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.damageType
              ? { damageType: template.params.damageType }
              : {}),
          },
        };

      case 'heal':
        return {
          type: 'heal',
          params: {
            value: this.resolveScalableValue(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.target
              ? { target: template.params.target }
              : {}),
          },
        };

      case 'shield':
        return {
          type: 'shield',
          params: {
            value: this.resolveScalableValue(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'mana_burn':
        return {
          type: 'mana_burn',
          params: {
            value: this.resolveScalableValue(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'resource_drain':
        return {
          type: 'resource_drain',
          params: {
            sourceType: template.params.sourceType,
            targetType: template.params.targetType,
            ratio: this.resolveParam(
              template.params.ratio,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'magic_shield':
        return {
          type: 'magic_shield',
          params: {
            ...(template.params.absorbRatio !== undefined
              ? {
                  absorbRatio: this.resolveParam(
                    template.params.absorbRatio,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
          },
        };

      case 'reflect':
        return {
          type: 'reflect',
          params: {
            ratio: this.resolveParam(
              template.params.ratio,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'cooldown_modify':
        return {
          type: 'cooldown_modify',
          params: {
            cdModifyValue: this.resolveParam(
              template.params.cdModifyValue,
              qualityOrder,
              // CD 修改通常是整数且不建议受随机倍率影响
              1.0,
            ),
            ...(template.params.tags ? { tags: template.params.tags } : {}),
            ...(template.params.maxCount !== undefined
              ? { maxCount: template.params.maxCount }
              : {}),
          },
        };

      case 'tag_trigger':
        return {
          type: 'tag_trigger',
          params: {
            triggerTag: template.params.triggerTag,
            ...(template.params.damageRatio !== undefined
              ? {
                  damageRatio: this.resolveParam(
                    template.params.damageRatio,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
            ...(template.params.removeOnTrigger !== undefined
              ? { removeOnTrigger: template.params.removeOnTrigger }
              : {}),
            ...(template.params.effects
              ? {
                  effects: this.resolveEffectList(
                    template.params.effects,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
          },
        };

      case 'consume_status_trigger':
        return {
          type: 'consume_status_trigger',
          params: {
            match: template.params.match,
            ...(template.params.consume !== undefined
              ? { consume: template.params.consume }
              : {}),
            effects: this.resolveEffectList(
              template.params.effects,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'delayed_effect':
        return {
          type: 'delayed_effect',
          params: {
            id: template.params.id,
            name: template.params.name,
            ...(template.params.description
              ? { description: template.params.description }
              : {}),
            delayTurns: Math.max(
              1,
              Math.round(
                this.resolveParam(template.params.delayTurns, qualityOrder, 1),
              ),
            ),
            effects: this.resolveEffectList(
              template.params.effects,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.tags ? { tags: template.params.tags } : {}),
            ...(template.params.statusTags
              ? { statusTags: template.params.statusTags }
              : {}),
            ...(template.params.record
              ? {
                  record: {
                    key: template.params.record.key,
                    event: template.params.record.event,
                    ...(template.params.record.maxStored !== undefined
                      ? {
                          maxStored: this.resolveParam(
                            template.params.record.maxStored,
                            qualityOrder,
                            multiplier,
                          ),
                        }
                      : {}),
                  },
                }
              : {}),
            ...(template.params.triggerOnDispel !== undefined
              ? { triggerOnDispel: template.params.triggerOnDispel }
              : {}),
            ...(template.params.maxTriggers !== undefined
              ? { maxTriggers: template.params.maxTriggers }
              : {}),
          },
        };

      case 'damage_memory':
        return {
          type: 'damage_memory',
          params: {
            key: template.params.key,
            mode: template.params.mode,
            ...(template.params.event ? { event: template.params.event } : {}),
            ...(template.params.ratio !== undefined
              ? {
                  ratio: this.resolveParam(
                    template.params.ratio,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
            ...(template.params.releaseAs
              ? { releaseAs: template.params.releaseAs }
              : {}),
            ...(template.params.target ? { target: template.params.target } : {}),
            ...(template.params.maxStored !== undefined
              ? {
                  maxStored: this.resolveParam(
                    template.params.maxStored,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
            ...(template.params.consume !== undefined
              ? { consume: template.params.consume }
              : {}),
          },
        };

      case 'buff_layer_modify':
        return {
          type: 'buff_layer_modify',
          params: {
            match: template.params.match,
            operation: template.params.operation,
            ...(template.params.layers !== undefined
              ? {
                  layers: this.resolveParam(
                    template.params.layers,
                    qualityOrder,
                    1,
                  ),
                }
              : {}),
            ...(template.params.effects
              ? {
                  effects: this.resolveEffectList(
                    template.params.effects,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
            ...(template.params.scaleEffectsByLayer !== undefined
              ? { scaleEffectsByLayer: template.params.scaleEffectsByLayer }
              : {}),
          },
        };

      case 'ability_transform':
        return {
          type: 'ability_transform',
          params: {
            id: template.params.id,
            ...(template.params.triggers !== undefined
              ? { triggers: template.params.triggers }
              : {}),
            ...(template.params.appliesToTags
              ? { appliesToTags: template.params.appliesToTags }
              : {}),
            ...(template.params.trueDamage !== undefined
              ? { trueDamage: template.params.trueDamage }
              : {}),
            ...(template.params.addDispel
              ? { addDispel: template.params.addDispel }
              : {}),
            ...(template.params.mpCostToHp !== undefined
              ? { mpCostToHp: template.params.mpCostToHp }
              : {}),
            ...(template.params.cooldownModify !== undefined
              ? {
                  cooldownModify: this.resolveParam(
                    template.params.cooldownModify,
                    qualityOrder,
                    1,
                  ),
                }
              : {}),
            ...(template.params.forceCritical !== undefined
              ? { forceCritical: template.params.forceCritical }
              : {}),
            ...(template.params.bonusDamageMemory
              ? {
                  bonusDamageMemory: {
                    key: template.params.bonusDamageMemory.key,
                    ...(template.params.bonusDamageMemory.ratio !== undefined
                      ? {
                          ratio: this.resolveParam(
                            template.params.bonusDamageMemory.ratio,
                            qualityOrder,
                            multiplier,
                          ),
                        }
                      : {}),
                    ...(template.params.bonusDamageMemory.consume !== undefined
                      ? { consume: template.params.bonusDamageMemory.consume }
                      : {}),
                  },
                }
              : {}),
          },
        };

      case 'hp_sacrifice_damage':
        return {
          type: 'hp_sacrifice_damage',
          params: {
            hpRatio: this.resolveParam(
              template.params.hpRatio,
              qualityOrder,
              multiplier,
            ),
            damagePerHp: this.resolveParam(
              template.params.damagePerHp,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.minHpFloor !== undefined
              ? { minHpFloor: template.params.minHpFloor }
              : {}),
          },
        };

      case 'ability_lock':
        return {
          type: 'ability_lock',
          params: {
            rounds: Math.max(
              1,
              Math.round(this.resolveParam(template.params.rounds, qualityOrder, 1)),
            ),
            ...(template.params.tags ? { tags: template.params.tags } : {}),
            ...(template.params.maxCount !== undefined
              ? { maxCount: template.params.maxCount }
              : {}),
          },
        };

      case 'status_spread':
        return {
          type: 'status_spread',
          params: { ...template.params },
        };

      case 'buff_copy':
        return {
          type: 'buff_copy',
          params: {
            ...(template.params.id ? { id: template.params.id } : {}),
            ...(template.params.match ? { match: template.params.match } : {}),
            ...(template.params.target ? { target: template.params.target } : {}),
            ...(template.params.durationDelta !== undefined
              ? {
                  durationDelta: this.resolveParam(
                    template.params.durationDelta,
                    qualityOrder,
                    1,
                  ),
                }
              : {}),
            ...(template.params.replayRemoved !== undefined
              ? { replayRemoved: template.params.replayRemoved }
              : {}),
            ...(template.params.maxTriggers !== undefined
              ? { maxTriggers: template.params.maxTriggers }
              : {}),
          },
        };

      case 'damage_defer':
        return {
          type: 'damage_defer',
          params: {
            ratio: this.resolveParam(
              template.params.ratio,
              qualityOrder,
              multiplier,
            ),
            delayTurns: Math.max(
              1,
              Math.round(
                this.resolveParam(template.params.delayTurns, qualityOrder, 1),
              ),
            ),
            ...(template.params.thresholdMaxHpRatio !== undefined
              ? {
                  thresholdMaxHpRatio: this.resolveParam(
                    template.params.thresholdMaxHpRatio,
                    qualityOrder,
                    multiplier,
                  ),
                }
              : {}),
          },
        };

      case 'next_hit_rule':
        return {
          type: 'next_hit_rule',
          params: { ...template.params },
        };

      case 'dynamic_scalar':
        return {
          type: 'dynamic_scalar',
          params: {
            mode: template.params.mode,
            value: this.resolveParam(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
            resource: template.params.resource,
            ...(template.params.lowerIsStronger !== undefined
              ? { lowerIsStronger: template.params.lowerIsStronger }
              : {}),
            ...(template.params.cap !== undefined
              ? { cap: template.params.cap }
              : {}),
          },
        };

      case 'turn_state_counter':
        return {
          type: 'turn_state_counter',
          params: {
            key: template.params.key,
            event: template.params.event,
            threshold: template.params.threshold,
            effects: this.resolveEffectList(
              template.params.effects,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.resetOnTrigger !== undefined
              ? { resetOnTrigger: template.params.resetOnTrigger }
              : {}),
          },
        };

      case 'element_history':
        return {
          type: 'element_history',
          params: {
            key: template.params.key,
            threshold: template.params.threshold,
            effects: this.resolveEffectList(
              template.params.effects,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.resetOnTrigger !== undefined
              ? { resetOnTrigger: template.params.resetOnTrigger }
              : {}),
          },
        };

      case 'effect_sequence':
        return {
          type: 'effect_sequence',
          params: {
            effects: this.resolveEffectList(
              template.params.effects,
              qualityOrder,
              multiplier,
            ),
          },
        };

      case 'apply_buff': {
        const params: ApplyBuffParams = {
          buffConfig: template.params.buffConfig,
        };
        if (template.params.chance !== undefined) {
          params.chance = this.resolveParam(
            template.params.chance,
            qualityOrder,
            multiplier,
          );
        }
        if (template.params.target) {
          params.target = template.params.target;
        }
        return {
          type: 'apply_buff',
          params,
        };
      }

      case 'attribute_modifier': {
        throw new Error(
          'AffixEffectTranslator: attribute_modifier must be projected to AbilityConfig.modifiers in passive policy',
        );
      }

      case 'random_attribute_modifier': {
        throw new Error(
          'AffixEffectTranslator: random_attribute_modifier must be projected to AbilityConfig.modifiers in passive policy',
        );
      }

      case 'percent_damage_modifier': {
        return {
          type: 'percent_damage_modifier',
          params: {
            mode: template.params.mode,
            value: this.resolveParam(
              template.params.value,
              qualityOrder,
              multiplier,
            ),
            ...(template.params.cap !== undefined
              ? { cap: template.params.cap }
              : {}),
          },
        };
      }

      case 'death_prevent':
        return {
          type: 'death_prevent',
          params: template.params,
        };

      case 'buff_immunity':
        return {
          type: 'buff_immunity',
          params: template.params,
        };

      case 'damage_immunity':
        return {
          type: 'damage_immunity',
          params: template.params,
        };

      case 'dispel':
        return {
          type: 'dispel',
          params: { ...template.params },
        };

      default: {
        const _exhaustive: never = template;
        throw new Error(
          `AffixEffectTranslator: 未支持的效果类型: ${(_exhaustive as AffixEffectTemplate).type}`,
        );
      }
    }
  }

  private resolveScalableValue(
    sv: AffixScalableValue,
    qualityOrder: number,
    multiplier: number,
  ): { base?: number; attribute?: AttributeType; coefficient?: number; targetMaxHpRatio?: number } {
    return {
      base: this.resolveParam(sv.base, qualityOrder, multiplier),
      ...(sv.attribute !== undefined ? { attribute: sv.attribute } : {}),
      ...(sv.coefficient !== undefined
        ? {
            coefficient: this.resolveParam(
              sv.coefficient,
              qualityOrder,
              multiplier,
            ),
          }
        : {}),
      ...(sv.targetMaxHpRatio !== undefined
        ? {
            targetMaxHpRatio: this.resolveParam(
              sv.targetMaxHpRatio,
              qualityOrder,
              multiplier,
            ),
          }
        : {}),
    };
  }

  resolveParam(
    param: ScalableParam,
    qualityOrder: number,
    multiplier: number = 1.0,
  ): number {
    let baseValue = 0;
    if (typeof param === 'number') {
      baseValue = param;
    } else {
      const sv = param as ScalableValueV2;
      baseValue =
        sv.scale === SCALE_MODE.NONE
          ? sv.base
          : sv.base + qualityOrder * sv.coefficient;
    }

    return baseValue * multiplier;
  }

  private resolveEffectList(
    effects: AffixEffectTemplate[],
    qualityOrder: number,
    multiplier: number,
  ): EffectConfig[] {
    return effects.map((effect) =>
      this.resolveTemplate(effect, qualityOrder, multiplier),
    );
  }
}

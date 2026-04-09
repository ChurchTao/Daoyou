import { AffixEffectTranslator } from '../../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../../affixes/AffixRegistry';
import type { AffixListenerSpec } from '../../affixes/types';
import {
  buildCreationListenerGuard,
  buildGroupedListeners,
} from '../../composers/shared';
import {
  CREATION_LISTENER_PRIORITIES,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import type {
  AttributeModifierConfig,
  EffectConfig,
  ListenerConfig,
} from '../../contracts/battle';
import { AttributeType } from '../../contracts/battle';
import { CreationTags } from '../../core/GameplayTags';
import { AFFIX_CATEGORIES } from '../../types';
import {
  CompositionDecision,
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import { assembleAbilityTags } from './AbilityTagAssembler';

/**
 * ProjectionRules
 * 将词缀翻译为战斗层投影策略（projectionPolicy）
 * skill → SkillProjectionPolicy
 * artifact / gongfa → PassiveProjectionPolicy
 */
/*
 * ProjectionRules: 负责将领域词缀（affix）翻译为战斗层的投影策略（projectionPolicy）。
 * - 对于技能（skill）构建 SkillProjectionPolicy（mp/cooldown/priority/effects/targetPolicy）
 * - 对于法宝/功法构建 PassiveProjectionPolicy（listeners 与 abilityTags）
 * 该规则使用 AffixEffectTranslator 进行 effect 的数值化（质量敏感），并记录诊断轨迹。
 */
export class ProjectionRules implements Rule<
  CompositionFacts,
  CompositionDecision
> {
  readonly id = 'composition.projection';

  constructor(
    private readonly registry: AffixRegistry,
    private readonly translator: AffixEffectTranslator,
  ) {}

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    const { productType } = facts;

    if (productType === 'skill') {
      decision.projectionPolicy = this.buildSkillPolicy(
        facts,
        decision,
        diagnostics,
      );
    } else {
      decision.projectionPolicy = this.buildPassivePolicy(facts);
    }

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `构建 projectionPolicy: ${decision.projectionPolicy.kind}`,
    });
  }

  private buildSkillPolicy(
    facts: CompositionFacts,
    decision: CompositionDecision,
    diagnostics: RuleContext<
      CompositionFacts,
      CompositionDecision
    >['diagnostics'],
  ): SkillProjectionPolicy {
    const { intent, affixes, materialQualityProfile } = facts;
    const projectionQuality = materialQualityProfile.weightedAverageQuality;

    const directEffects: EffectConfig[] = [];
    const extraListeners: ListenerConfig[] = [];

    for (const rolled of affixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      const effect = this.translator.translate(def, projectionQuality);
      if (def.listenerSpec) {
        const guard = buildCreationListenerGuard(
          def.listenerSpec.eventType,
          effect,
          def.listenerSpec.guard,
        );

        extraListeners.push({
          eventType: def.listenerSpec.eventType,
          scope: def.listenerSpec.scope,
          priority: def.listenerSpec.priority,
          ...(def.listenerSpec.mapping
            ? { mapping: def.listenerSpec.mapping }
            : {}),
          ...(guard ? { guard } : {}),
          effects: [effect],
        });
      } else {
        directEffects.push(effect);
      }
    }

    const coreAffix = affixes.find((r) => r.category === AFFIX_CATEGORIES.CORE);
    const coreDef = coreAffix
      ? this.registry.queryById(coreAffix.id)
      : undefined;
    const coreType = coreDef?.effectTemplate.type ?? 'damage';
    if (!coreDef) {
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: `coreType fallback to 'damage': no core affix found (coreAffixId=${coreAffix?.id ?? 'none'})`,
      });
    }

    const cooldown =
      coreType === 'heal'
        ? CREATION_SKILL_DEFAULTS.healCooldown
        : coreType === 'apply_buff'
          ? CREATION_SKILL_DEFAULTS.buffCooldown
          : CREATION_SKILL_DEFAULTS.damageCooldown;
    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `cooldown=${cooldown} (coreType=${coreType})`,
    });

    // EnergyConversionRules must have already populated decision.energyConversion
    // (it runs before ProjectionRules in CompositionRuleSet).
    const conv = decision.energyConversion;
    if (!conv) {
      throw new Error(
        '[ProjectionRules] energyConversion not populated — EnergyConversionRules must run first',
      );
    }
    const { mpCost, priority } = conv;

    const targetPolicy =
      coreType === 'heal'
        ? { team: 'self' as const, scope: 'single' as const }
        : { team: 'enemy' as const, scope: 'single' as const };

    const abilityTags =
      directEffects.length === 0 &&
      extraListeners.length === 0 &&
      affixes.length === 0
        ? assembleAbilityTags({
            productType: 'skill',
            effects: [
              {
                type: 'damage',
                params: {
                  value: {
                    base: 0,
                    attribute: AttributeType.MAGIC_ATK,
                    coefficient: 0,
                  },
                },
              },
            ],
            elementBias: intent.elementBias,
          })
        : assembleAbilityTags({
            productType: 'skill',
            effects: directEffects,
            listeners: extraListeners,
            elementBias: intent.elementBias,
          });

    return {
      kind: 'active_skill',
      cooldown,
      mpCost,
      priority,
      abilityTags,
      targetPolicy,
      effects: directEffects,
      ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
    };
  }

  private buildPassivePolicy(facts: CompositionFacts): PassiveProjectionPolicy {
    const { productType, intent, affixes, materialQualityProfile } = facts;
    const qualityOrder = materialQualityProfile.weightedAverageOrder;
    const projectionQuality = materialQualityProfile.weightedAverageQuality;

    // Partition affixes: attribute_modifier → direct AbilityConfig.modifiers
    // everything else → listener-wrapped effects
    const modifiers: AttributeModifierConfig[] = [];
    const listenerAffixIds: string[] = [];

    for (const rolled of affixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      if (def.effectTemplate.type === 'attribute_modifier') {
        const modifierEntries =
          'modifiers' in def.effectTemplate.params
            ? def.effectTemplate.params.modifiers
            : [
                {
                  attrType: def.effectTemplate.params.attrType,
                  modType: def.effectTemplate.params.modType,
                  value: def.effectTemplate.params.value,
                },
              ];

        for (const modifierEntry of modifierEntries) {
          modifiers.push({
            attrType: modifierEntry.attrType,
            type: modifierEntry.modType,
            value: this.translator.resolveParam(
              modifierEntry.value,
              qualityOrder,
            ),
          });
        }
      } else {
        listenerAffixIds.push(rolled.id);
      }
    }

    const defaultListenerSpec = this.resolveDefaultListenerSpec(
      productType as 'artifact' | 'gongfa',
    );
    const listeners = buildGroupedListeners({
      registry: this.registry,
      translator: this.translator,
      affixIds: listenerAffixIds,
      quality: projectionQuality,
      defaultListenerSpec,
    });

    const abilityTags = assembleAbilityTags({
      productType,
      listeners,
      elementBias: intent.elementBias,
    });

    const projectionKind =
      productType === 'artifact' ? 'artifact_passive' : 'gongfa_passive';

    return {
      kind: projectionKind,
      abilityTags,
      listeners,
      ...(modifiers.length > 0 ? { modifiers } : {}),
    } as PassiveProjectionPolicy;
  }

  private resolveDefaultListenerSpec(
    productType: 'artifact' | 'gongfa',
  ): AffixListenerSpec {
    if (productType === 'artifact') {
      return {
        eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
        scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
        priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      };
    }
    return {
      eventType: CreationTags.BATTLE_EVENT.ACTION_PRE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR,
      priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
    };
  }
}

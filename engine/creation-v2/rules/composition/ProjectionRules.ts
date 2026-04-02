import type { EffectConfig, ListenerConfig } from '../../contracts/battle';
import {
  CREATION_LISTENER_PRIORITIES,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import { CORE_EFFECT_TYPE_TO_ABILITY_TAG, ELEMENT_TO_ABILITY_TAG } from '../../config/CreationMappings';
import { AffixEffectTranslator } from '../../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../../affixes/AffixRegistry';
import type { AffixListenerSpec } from '../../affixes/types';
import { buildGroupedListeners } from '../../composers/shared';
import { CreationTags } from '../../core/GameplayTags';
import { AFFIX_CATEGORIES } from '../../types';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import {
  CompositionDecision,
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';

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
export class ProjectionRules implements Rule<CompositionFacts, CompositionDecision> {
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
      decision.projectionPolicy = this.buildSkillPolicy(facts, decision, diagnostics);
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
    diagnostics: RuleContext<CompositionFacts, CompositionDecision>['diagnostics'],
  ): SkillProjectionPolicy {
    const { intent, energyBudget, affixes, dominantQuality } = facts;

    const directEffects: EffectConfig[] = [];
    const extraListeners: ListenerConfig[] = [];

    for (const rolled of affixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      const effect = this.translator.translate(def, dominantQuality);
      if (def.listenerSpec) {
        extraListeners.push({
          eventType: def.listenerSpec.eventType,
          scope: def.listenerSpec.scope,
          priority: def.listenerSpec.priority,
          ...(def.listenerSpec.mapping ? { mapping: def.listenerSpec.mapping } : {}),
          ...(def.listenerSpec.guard ? { guard: def.listenerSpec.guard } : {}),
          effects: [effect],
        });
      } else {
        directEffects.push(effect);
      }
    }

    const coreAffix = affixes.find((r) => r.category === AFFIX_CATEGORIES.CORE);
    const coreDef = coreAffix ? this.registry.queryById(coreAffix.id) : undefined;
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

    const elementTag = intent.elementBias
      ? ELEMENT_TO_ABILITY_TAG[intent.elementBias]
      : undefined;

    const abilityTypeTag =
      CORE_EFFECT_TYPE_TO_ABILITY_TAG[facts.coreEffectType ?? coreType] ??
      CreationTags.BATTLE.ABILITY_TYPE_DAMAGE;
    const abilityTags = [
      abilityTypeTag,
      ...(elementTag ? [elementTag] : []),
    ];

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

  private buildPassivePolicy(
    facts: CompositionFacts,
  ): PassiveProjectionPolicy {
    const { productType, intent, affixes, dominantQuality } = facts;

    const defaultListenerSpec = this.resolveDefaultListenerSpec(
      productType as 'artifact' | 'gongfa',
    );
    const listeners = buildGroupedListeners({
      registry: this.registry,
      translator: this.translator,
      affixIds: affixes.map((a) => a.id),
      quality: dominantQuality,
      defaultListenerSpec,
    });

    const elementTag = intent.elementBias
      ? ELEMENT_TO_ABILITY_TAG[intent.elementBias]
      : undefined;

    const abilityTags =
      productType === 'artifact'
        ? [...(elementTag ? [elementTag] : []), CreationTags.BATTLE.ABILITY_KIND_ARTIFACT]
        : [CreationTags.BATTLE.ABILITY_KIND_GONGFA];

    const projectionKind =
      productType === 'artifact' ? 'artifact_passive' : 'gongfa_passive';

    return {
      kind: projectionKind,
      abilityTags,
      listeners,
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

import { EquipmentSlot } from '@/types/constants';
import { AffixEffectTranslator } from '../../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../../affixes/AffixRegistry';
import type { AffixAttributeModifierTemplate } from '../../affixes/types';
import type { AttributeModifierConfig, EffectConfig } from '../../contracts/battle';
import { AttributeType } from '../../contracts/battle';
import { CreationTags } from '../../core/GameplayTags';
import { BuffType, StackRule } from '../../contracts/battle';
import {
  CREATION_LISTENER_PRIORITIES,
  CREATION_PASSIVE_DEFAULTS,
  CREATION_PROJECTION_BALANCE,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import {
  CREATION_FALLBACK_ARTIFACT_CORE_AFFIX,
  CREATION_FALLBACK_CORE_AFFIX,
  CREATION_FALLBACK_GONGFA_BUFF,
  CREATION_FALLBACK_MARKERS,
} from '../../config/CreationFallbackPolicy';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import {
  CompositionDecision,
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';

/**
 * FallbackOutcomeRules
 * 当词缀为空时，向 projectionPolicy 注入保底效果（damage / shield / apply_buff）
 * 仅在 projectionPolicy 已由 ProjectionRules 构建后生效
 */
/*
 * FallbackOutcomeRules: 在 CompositionRuleSet 中作为保险规则，
 * 当上游规则未能生成有效 projectionPolicy 或 name 时提供合理默认，并记录 diagnostics。
 */
export class FallbackOutcomeRules
  implements Rule<CompositionFacts, CompositionDecision>
{
  readonly id = 'composition.fallback_outcome';

  constructor(
    private readonly registry: AffixRegistry,
    private readonly translator: AffixEffectTranslator,
  ) {}

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    if (decision.projectionPolicy === undefined) return;
    if (facts.affixes.length > 0) return;

    const policy = decision.projectionPolicy;

    if (policy.kind === 'active_skill') {
      const fallback =
        this.skillCoreFallback(facts) ?? this.skillFallback(facts);
      decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.skillDamageFallback);
      (decision.projectionPolicy as SkillProjectionPolicy).effects = [fallback];
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '注入技能保底 core effect',
      });
      return;
    }

    if (policy.kind === 'artifact_passive') {
      const fallbackModifiers = this.artifactCoreFallback(facts);

      if (fallbackModifiers.length > 0) {
        decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.artifactCoreFallback);
        (decision.projectionPolicy as PassiveProjectionPolicy).listeners = [];
        (decision.projectionPolicy as PassiveProjectionPolicy).modifiers = fallbackModifiers;
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'applied',
          message: '注入法宝保底 core modifiers',
          details: {
            slotBias: facts.intent.slotBias ?? 'weapon',
            modifierCount: fallbackModifiers.length,
          },
        });
        return;
      }

      const fallback = this.artifactShieldFallback(facts);
      decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.artifactShieldFallback);
      (decision.projectionPolicy as PassiveProjectionPolicy).listeners = [
        {
          eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
          scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
          priority: CREATION_LISTENER_PRIORITIES.damageTaken,
          effects: [fallback],
        },
      ];
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '注入法宝保底护盾 listener',
      });
      return;
    }

    if (policy.kind === 'gongfa_passive') {
      const fallbackModifiers = this.gongfaCoreFallback(facts);

      if (fallbackModifiers.length > 0) {
        decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.gongfaSpiritFallback);
        (decision.projectionPolicy as PassiveProjectionPolicy).listeners = [];
        (decision.projectionPolicy as PassiveProjectionPolicy).modifiers = fallbackModifiers;
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'applied',
          message: '注入功法保底 core modifiers',
          details: {
            modifierCount: fallbackModifiers.length,
          },
        });
        return;
      }

      const fallback = this.gongfaFallback();
      decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.gongfaSpiritFallback);
      (decision.projectionPolicy as PassiveProjectionPolicy).listeners = [
        {
          eventType: CreationTags.BATTLE_EVENT.ACTION_PRE,
          scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR,
          priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
          effects: [fallback],
        },
      ];
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '注入功法保底灵力 buff',
      });
    }
  }

  private skillCoreFallback(facts: CompositionFacts): EffectConfig | undefined {
    const fallbackDef = this.registry.queryById(
      CREATION_FALLBACK_CORE_AFFIX.skill,
    );

    if (!fallbackDef || fallbackDef.effectTemplate.type === 'attribute_modifier') {
      return undefined;
    }

    return this.translator.translate(
      fallbackDef,
      facts.materialQualityProfile.weightedAverageQuality,
    );
  }

  private skillFallback(facts: CompositionFacts): EffectConfig {
    const startingAffixEnergy = facts.energySummary.startingAffixEnergy;

    return {
      type: 'damage',
      params: {
        value: {
          base: Math.max(
            CREATION_SKILL_DEFAULTS.minDamageBase,
            startingAffixEnergy,
          ),
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0,
        },
      },
    };
  }

  private artifactCoreFallback(
    facts: CompositionFacts,
  ): AttributeModifierConfig[] {
    const slotBias: EquipmentSlot = facts.intent.slotBias ?? 'weapon';
    const fallbackAffixId = CREATION_FALLBACK_ARTIFACT_CORE_AFFIX[slotBias];
    const fallbackDef = this.registry.queryById(fallbackAffixId);

    if (!fallbackDef || fallbackDef.effectTemplate.type !== 'attribute_modifier') {
      return [];
    }

    const modifierEntries = this.normalizeAttributeModifierEntries(
      fallbackDef.effectTemplate.params,
    );

    return modifierEntries.map((modifierEntry) => ({
      attrType: modifierEntry.attrType,
      type: modifierEntry.modType,
      value: this.translator.resolveParam(
        modifierEntry.value,
        facts.materialQualityProfile.weightedAverageOrder,
      ),
    }));
  }

  private normalizeAttributeModifierEntries(
    params: {
      attrType: AffixAttributeModifierTemplate['attrType'];
      modType: AffixAttributeModifierTemplate['modType'];
      value: AffixAttributeModifierTemplate['value'];
    } | {
      modifiers: AffixAttributeModifierTemplate[];
    },
  ): AffixAttributeModifierTemplate[] {
    if ('modifiers' in params) {
      return params.modifiers;
    }

    return [
      {
        attrType: params.attrType,
        modType: params.modType,
        value: params.value,
      },
    ];
  }

  private artifactShieldFallback(facts: CompositionFacts): EffectConfig {
    const startingAffixEnergy = facts.energySummary.startingAffixEnergy;

    return {
      type: 'shield',
      params: {
        value: {
          base: Math.max(
            CREATION_PASSIVE_DEFAULTS.minArtifactShieldBase,
            Math.round(
              startingAffixEnergy /
                CREATION_PROJECTION_BALANCE.artifactShieldBaseDivisor,
            ),
          ),
        },
      },
    };
  }

  private gongfaCoreFallback(
    facts: CompositionFacts,
  ): AttributeModifierConfig[] {
    const fallbackDef = this.registry.queryById(
      CREATION_FALLBACK_CORE_AFFIX.gongfa,
    );

    if (!fallbackDef || fallbackDef.effectTemplate.type !== 'attribute_modifier') {
      return [];
    }

    const modifierEntries = this.normalizeAttributeModifierEntries(
      fallbackDef.effectTemplate.params,
    );

    return modifierEntries.map((modifierEntry) => ({
      attrType: modifierEntry.attrType,
      type: modifierEntry.modType,
      value: this.translator.resolveParam(
        modifierEntry.value,
        facts.materialQualityProfile.weightedAverageOrder,
      ),
    }));
  }

  private gongfaFallback(): EffectConfig {
    return {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: CREATION_FALLBACK_GONGFA_BUFF.id,
          name: CREATION_FALLBACK_GONGFA_BUFF.name,
          type: BuffType.BUFF,
          duration: CREATION_PROJECTION_BALANCE.permanentBuffDuration,
          stackRule: StackRule.IGNORE,
          modifiers: [
            {
              attrType: CREATION_FALLBACK_GONGFA_BUFF.attrType,
              type: CREATION_FALLBACK_GONGFA_BUFF.modifierType,
              value: CREATION_PROJECTION_BALANCE.gongfaSpiritBuffBase,
            },
          ],
        },
      },
    };
  }
}

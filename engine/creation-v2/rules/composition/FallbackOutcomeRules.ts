import type { EffectConfig } from '../../contracts/battle';
import { CreationTags } from '../../core/GameplayTags';
import { BuffType, StackRule } from '../../contracts/battle';
import {
  CREATION_LISTENER_PRIORITIES,
  CREATION_PASSIVE_DEFAULTS,
  CREATION_PROJECTION_BALANCE,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import {
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

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    if (decision.projectionPolicy === undefined) return;
    if (facts.affixes.length > 0) return;

    const policy = decision.projectionPolicy;

    if (policy.kind === 'active_skill') {
      const fallback = this.skillFallback(facts);
      decision.defaultsApplied.push(CREATION_FALLBACK_MARKERS.skillDamageFallback);
      (decision.projectionPolicy as SkillProjectionPolicy).effects = [fallback];
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '注入技能保底伤害效果',
      });
      return;
    }

    if (policy.kind === 'artifact_passive') {
      const fallback = this.artifactFallback(facts);
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
        },
      },
    };
  }

  private artifactFallback(facts: CompositionFacts): EffectConfig {
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

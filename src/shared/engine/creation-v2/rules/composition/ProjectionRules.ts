import { AffixEffectTranslator } from '../../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../../affixes/AffixRegistry';
import type { AffixListenerSpec } from '../../affixes/types';
import {
  buildCreationListenerGuard,
  buildGroupedListeners,
} from '../../composers/shared';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import type {
  AttributeModifierConfig,
  EffectConfig,
  ListenerConfig,
} from '../../contracts/battle';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  getArtifactRealmGrowthFactor,
  isArtifactMainPanelFixedModifier,
} from '@shared/engine/shared/artifactRealmScaling';
import type { AttributeType, ModifierType } from '../../contracts/battle';
import { RolledAffix } from '../../types';
import {
  CompositionDecision,
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import { assembleAbilityTags } from './AbilityTagAssembler';
import { CreationError } from '../../errors';
import { resolveSkillResourceAndCooldown } from './SkillPacingRules';

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

  apply({ facts, decision }: RuleContext<CompositionFacts, CompositionDecision>): void {
    const { productType } = facts;

    if (productType === 'skill') {
      decision.projectionPolicy = this.buildSkillPolicy(
        facts,
        decision,
      );
    } else {
      decision.projectionPolicy = this.buildPassivePolicy(facts);
    }

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `构建 projectionPolicy: ${decision.projectionPolicy.kind}`,
    });
  }

  private buildSkillPolicy(
    facts: CompositionFacts,
    decision: CompositionDecision,
  ): SkillProjectionPolicy {
    const { intent, affixes, projectionQualityProfile } = facts;
    const projectionQuality = projectionQualityProfile.quality;

    const directEffects: EffectConfig[] = [];
    const extraListeners: ListenerConfig[] = [];

    for (const rolled of affixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      // 核心改动：将整个 rolled 对象传递给 translator，应用 finalMultiplier
      const effect = this.translator.translate(rolled, projectionQuality);
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

    const coreAffix = affixes.find((affix) => affix.slot === 'core');
    const coreDef = coreAffix
      ? this.registry.queryById(coreAffix.id)
      : undefined;

    if (!coreDef) {
      throw new CreationError(
        'Composition',
        'NO_CORE_AFFIX',
        `无法投影技能：找不到核心词缀定义 (coreAffixId=${coreAffix?.id ?? 'none'})`,
        { affixes }
      );
    }

    const coreType = coreDef.effectTemplate.type;

    // EnergyConversionRules must have already populated priority metadata
    // (it runs before ProjectionRules in CompositionRuleSet).
    if (!decision.energyConversion) {
      throw new Error(
        '[ProjectionRules] energyConversion not populated — EnergyConversionRules must run first',
      );
    }

    const coreTargetPolicy = coreDef.targetPolicyConstraint;
    const targetPolicy = {
      team:
        coreTargetPolicy?.team ??
        intent.targetPolicyBias?.team ??
        (coreType === 'heal' ? ('self' as const) : ('enemy' as const)),
      scope:
        coreTargetPolicy?.scope ??
        intent.targetPolicyBias?.scope ??
        ('single' as const),
    };

    const abilityTags = assembleAbilityTags({
      productType: 'skill',
      rolledAffixes: affixes,
      elementBias: intent.elementBias,
    });
    const pacing = resolveSkillResourceAndCooldown({
      coreType,
      abilityTags,
      effects: directEffects,
      ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
      affixes,
      projectionQualityProfile,
      ...(facts.projectionContext
        ? { projectionContext: facts.projectionContext }
        : {}),
    });

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: pacing.traceMessage,
    });

    return {
      kind: 'active_skill',
      cooldown: pacing.cooldown,
      mpCost: pacing.mpCost,
      priority: pacing.priority,
      abilityTags,
      targetPolicy,
      effects: directEffects,
      ...(extraListeners.length > 0 ? { listeners: extraListeners } : {}),
    };
  }

  private buildPassivePolicy(facts: CompositionFacts): PassiveProjectionPolicy {
    const {
      productType,
      intent,
      affixes,
      projectionQualityProfile,
      anchorRealm,
      anchorRealmStage,
    } = facts;
    const qualityOrder = projectionQualityProfile.qualityOrder;
    const projectionQuality = projectionQualityProfile.quality;
    const anchorFactor = this.getAnchorGrowthFactor(
      productType,
      anchorRealm,
      anchorRealmStage,
    );

    // Partition affixes: attribute_modifier / random_attribute_modifier → direct AbilityConfig.modifiers
    // everything else → listener-wrapped effects
    const modifiers: AttributeModifierConfig[] = [];
    const rolledListeners: RolledAffix[] = [];

    for (const rolled of affixes) {
      const def = this.registry.queryById(rolled.id);
      if (!def) continue;
      rolled.modifierSelections = undefined;
      rolled.resolvedModifiers = undefined;
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
          const baseValue = this.translator.resolveParam(
            modifierEntry.value,
            qualityOrder,
          );
          const grownValue = this.applyArtifactAnchorGrowth(
            productType,
            modifierEntry.attrType,
            modifierEntry.modType,
            baseValue,
            anchorFactor,
          );
          // 核心改动：被动属性修正也应用随机倍率
          const modifier = {
            attrType: modifierEntry.attrType,
            type: modifierEntry.modType,
            value: grownValue * rolled.finalMultiplier,
          };
          modifiers.push(modifier);
        }
      } else if (def.effectTemplate.type === 'random_attribute_modifier') {
        const { pool, pickCount } = def.effectTemplate.params;
        // 造物时随机抽取，结果固化在此次投影中
        const picked = pickRandom(pool, pickCount).sort(
          (left, right) => pool.indexOf(left) - pool.indexOf(right),
        );
        rolled.modifierSelections = picked.map((entry) => ({
          attrType: entry.attrType,
          type: entry.modType,
        }));
        for (const entry of picked) {
          const baseValue = this.translator.resolveParam(
            entry.value,
            qualityOrder,
          );
          const grownValue = this.applyArtifactAnchorGrowth(
            productType,
            entry.attrType,
            entry.modType,
            baseValue,
            anchorFactor,
          );
          const modifier = {
            attrType: entry.attrType,
            type: entry.modType,
            value: grownValue * rolled.finalMultiplier,
          };
          modifiers.push(modifier);
        }
      } else {
        rolledListeners.push(rolled);
      }
    }

    const defaultListenerSpec = this.resolveDefaultListenerSpec(
      productType as 'artifact' | 'gongfa',
    );
    const listeners = buildGroupedListeners({
      registry: this.registry,
      translator: this.translator,
      rolledAffixes: rolledListeners,
      quality: projectionQuality,
      defaultListenerSpec,
    });

    const abilityTags = assembleAbilityTags({
      productType,
      rolledAffixes: affixes,
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
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      };
    }
    return {
      eventType: GameplayTags.EVENT.ACTION_PRE,
      scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
      priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
    };
  }

  private getAnchorGrowthFactor(
    productType: 'skill' | 'artifact' | 'gongfa',
    ...anchor: Parameters<typeof getArtifactRealmGrowthFactor>
  ): number {
    if (productType !== 'artifact') {
      return 1;
    }
    return getArtifactRealmGrowthFactor(...anchor);
  }

  private applyArtifactAnchorGrowth(
    productType: 'skill' | 'artifact' | 'gongfa',
    attrType: AttributeType,
    modType: ModifierType,
    baseValue: number,
    anchorFactor: number,
  ): number {
    if (
      productType !== 'artifact' ||
      !isArtifactMainPanelFixedModifier({ attrType, type: modType })
    ) {
      return baseValue;
    }
    return baseValue * anchorFactor;
  }
}

/**
 * 从数组中随机不重复地抽取 count 个元素（Fisher-Yates partial shuffle）。
 * 若 count >= arr.length，返回原数组的完整副本（随机顺序）。
 */
function pickRandom<T>(arr: readonly T[], count: number): T[] {
  const copy = arr.slice();
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

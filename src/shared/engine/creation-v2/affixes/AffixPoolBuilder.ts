import { CreationSession } from '../CreationSession';
import { buildCreationTagSignalScoreMap } from '../analysis/CreationTagSignalBuilder';
import { AffixPoolRuleSet } from '../rules/affix/AffixPoolRuleSet';
import { AffixEligibilityFacts, AffixPoolDecision } from '../rules/contracts';
import {
  AFFIX_STOP_REASONS,
  AffixRarity,
  AffixCandidate,
  createEmptyEnergyBudget,
} from '../types';
import { resolveUnlockedAffixRarities } from '../config/CreationBalance';
import { AffixRegistry } from './AffixRegistry';
import { AffixDefinition, flattenAffixMatcherTags } from './types';

/**
 * 词缀候选池构建器
 * 根据 session 当前状态（inputTags、解锁类别、产物类型）
 * 从 AffixRegistry 查询并生成 AffixCandidate[]
 */
export class AffixPoolBuilder {
  constructor(private readonly ruleSet = new AffixPoolRuleSet()) {}

  build(registry: AffixRegistry, session: CreationSession): AffixCandidate[] {
    return this.buildDecision(registry, session).candidates;
  }

  buildDecision(
    registry: AffixRegistry,
    session: CreationSession,
  ): AffixPoolDecision {
    const {
      inputTagSignals,
      inputTags,
      recipeMatch,
      input,
    } = session.state;
    if (!recipeMatch) {
      return {
        candidates: [],
        rejectedCandidates: [],
        exhaustionReason: AFFIX_STOP_REASONS.POOL_EXHAUSTED,
        reasons: [],
        warnings: [],
        trace: [],
      };
    }

    if (inputTagSignals.length === 0) {
      return {
        candidates: [],
        rejectedCandidates: [],
        exhaustionReason: AFFIX_STOP_REASONS.POOL_EXHAUSTED,
        reasons: [
          {
            code: 'affix_pool_empty_tags',
            message:
              'session.inputTagSignals 为空，无法匹配任何词缀候选，词缀池为零',
          },
        ],
        warnings: [],
        trace: [
          {
            ruleId: 'affix.pool.builder',
            outcome: 'blocked',
            message: 'session.inputTagSignals 为空，跳过词缀池构建',
          },
        ],
      };
    }

    const energyBudget = session.state.energyBudget ?? createEmptyEnergyBudget();
    const unlockedRarities = resolveUnlockedAffixRarities(
      energyBudget.effectiveTotal,
    );
    const matching = this.filterCandidatesForProductContext(
      registry.queryBySignals(
        inputTagSignals,
        input.productType,
      ),
      session,
    )
      .filter((def) => this.isRarityUnlocked(def.rarity, unlockedRarities))
      .map((def) => this.toCandidate(def));

    const facts: AffixEligibilityFacts = {
      productType: input.productType,
      recipeMatch,
      energyBudget,
      candidatePool: matching,
      unlockedRarities,
      inputTagSignals,
      inputTags,
      tagSignalScores: buildCreationTagSignalScoreMap(inputTagSignals),
      negativeTagBiases: session.state.intent?.negativeTagBiases ?? [],
    };

    const decision = this.ruleSet.evaluate(facts);
    decision.trace.unshift({
      ruleId: 'affix.pool.rarity-unlock',
      outcome: 'applied',
      message: '已根据有效总预算过滤词缀稀有度',
      details: {
        effectiveTotal: energyBudget.effectiveTotal,
        unlockedRarities,
      },
    });
    return decision;
  }

  private filterCandidatesForProductContext(
    defs: AffixDefinition[],
    session: CreationSession,
  ): AffixDefinition[] {
    const { productType } = session.state.input;
    const { intent } = session.state;

    return defs.filter((def) => {
      // --- 1. 通用环境约束过滤 (Universal Context Filtering) ---

      // 法宝：检查装备槽位约束
      if (productType === 'artifact' && def.applicableArtifactSlots) {
        const slotBias =
          intent?.slotBias ?? session.state.input.requestedSlot;
        if (slotBias && !def.applicableArtifactSlots.includes(slotBias)) {
          return false;
        }
      }

      // 神通：检查目标策略约束
      if (productType === 'skill' && def.targetPolicyConstraint) {
        const bias = intent?.targetPolicyBias;
        if (bias) {
          const constraint = def.targetPolicyConstraint;
          if (constraint.team && constraint.team !== bias.team) {
            return false;
          }
          if (constraint.scope && constraint.scope !== bias.scope) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private isRarityUnlocked(
    rarity: AffixRarity,
    unlockedRarities: AffixRarity[],
  ): boolean {
    return unlockedRarities.includes(rarity);
  }

  private toCandidate(def: AffixDefinition): AffixCandidate {
    return {
      id: def.id,
      name: def.displayName,
      description: def.displayDescription,
      slot: def.slot,
      rarity: def.rarity,
      match: def.match,
      tags: flattenAffixMatcherTags(def.match),
      grantedAbilityTags: def.grantedAbilityTags,
      weight: def.weight,
      energyCost: def.energyCost,
      exclusiveGroup: def.exclusiveGroup,
      applicableArtifactSlots: def.applicableArtifactSlots,
      targetPolicyConstraint: def.targetPolicyConstraint,
      selectionMeta: def.selectionMeta,
      effectTemplate: def.effectTemplate,
    };
  }
}

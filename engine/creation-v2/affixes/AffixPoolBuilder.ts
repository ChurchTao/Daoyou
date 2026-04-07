import { CreationSession } from '../CreationSession';
import { buildMaterialQualityProfile } from '../analysis/MaterialBalanceProfile';
import { CREATION_AFFIX_POOL_SCORING } from '../config/CreationBalance';
import { CREATION_FALLBACK_CORE_AFFIX } from '../config/CreationFallbackPolicy';
import { AffixCandidate, AFFIX_STOP_REASONS, createEmptyEnergyBudget } from '../types';
import { AffixEligibilityFacts, AffixPoolDecision } from '../rules/contracts';
import { AffixPoolRuleSet } from '../rules/affix/AffixPoolRuleSet';
import { AffixDefinition } from './types';
import { AffixRegistry } from './AffixRegistry';

/**
 * 词缀候选池构建器
 * 根据 session 当前状态（tags、品质上限、解锁类别、产物类型）
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
    const { tags, materialFingerprints, recipeMatch, input } = session.state;
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

    const maxQualityOrder = buildMaterialQualityProfile(
      materialFingerprints,
    ).weightedAverageOrder;

    if (tags.length === 0) {
      return {
        candidates: [],
        rejectedCandidates: [],
        exhaustionReason: AFFIX_STOP_REASONS.POOL_EXHAUSTED,
        reasons: [
          {
            code: 'affix_pool_empty_tags',
            message: 'session.tags 为空，无法匹配任何词缀候选，词缀池为零',
          },
        ],
        warnings: [],
        trace: [
          {
            ruleId: 'affix.pool.builder',
            outcome: 'blocked',
            message: 'session.tags 为空，跳过词缀池构建',
          },
        ],
      };
    }

    const matching = registry
      .queryByTags(tags, recipeMatch.unlockedAffixCategories, input.productType)
      .map((def) => this.toCandidate(def));

    const facts: AffixEligibilityFacts = {
      productType: input.productType,
      recipeMatch,
      energyBudget: session.state.energyBudget ?? createEmptyEnergyBudget(),
      candidatePool: matching,
      allowedCategories: recipeMatch.unlockedAffixCategories,
      sessionTags: tags,
      tagSignalScores: this.buildTagSignalScores(session),
      maxQualityOrder,
    };

    const decision = this.ruleSet.evaluate(facts);
    return this.ensureCoreFallbackCandidate(registry, session, decision);
  }

  private ensureCoreFallbackCandidate(
    registry: AffixRegistry,
    session: CreationSession,
    decision: AffixPoolDecision,
  ): AffixPoolDecision {
    const hasCoreCandidate = decision.candidates.some((c) => c.category === 'core');
    if (hasCoreCandidate) {
      return decision;
    }

    const fallbackId = CREATION_FALLBACK_CORE_AFFIX[session.state.input.productType];
    const fallbackDef = registry.queryById(fallbackId);

    if (!fallbackDef) {
      return decision;
    }

    const fallbackCandidate = this.toCandidate(fallbackDef);

    return {
      ...decision,
      candidates: [...decision.candidates, fallbackCandidate],
      warnings: [
        ...decision.warnings,
        {
          code: 'affix_core_fallback_injected',
          message: '词缀池缺少 core，已注入保底 core 候选',
          details: {
            fallbackAffixId: fallbackId,
            productType: session.state.input.productType,
          },
        },
      ],
    };
  }

  private toCandidate(def: AffixDefinition): AffixCandidate {
    return {
      id: def.id,
      name: def.displayName,
      category: def.category,
      tags: def.tagQuery,
      weight: def.weight,
      energyCost: def.energyCost,
      exclusiveGroup: def.exclusiveGroup,
      minQuality: def.minQuality,
      maxQuality: def.maxQuality,
    };
  }

  private buildTagSignalScores(session: CreationSession): Record<string, number> {
    const scores = new Map<string, number>();
    const signalWeights = CREATION_AFFIX_POOL_SCORING.tagSignalWeights;
    const maxSignalScore = CREATION_AFFIX_POOL_SCORING.maxSignalScorePerTag;
    const accumulate = (tags: string[], weight: number) => {
      for (const tag of new Set(tags)) {
        scores.set(tag, Math.min(maxSignalScore, (scores.get(tag) ?? 0) + weight));
      }
    };

    for (const fingerprint of session.state.materialFingerprints) {
      accumulate(fingerprint.explicitTags, signalWeights.explicitMaterial);
      accumulate(fingerprint.recipeTags, signalWeights.recipeMaterial);
      accumulate(fingerprint.semanticTags, signalWeights.semanticMaterial);
    }

    accumulate(session.state.intent?.dominantTags ?? [], signalWeights.dominantIntent);
    accumulate(session.state.intent?.requestedTags ?? [], signalWeights.requestedIntent);
    accumulate(session.state.recipeMatch?.matchedTags ?? [], signalWeights.matchedRecipe);

    return Object.fromEntries(scores.entries());
  }
}

import { QUALITY_ORDER } from '@/types/constants';
import { CreationSession } from '../CreationSession';
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

    const maxQualityOrder = materialFingerprints.reduce(
      (max, fp) => Math.max(max, QUALITY_ORDER[fp.rank]),
      0,
    );

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
      maxQualityOrder,
    };

    return this.ruleSet.evaluate(facts);
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
}

import { CreationSession } from '../CreationSession';
import { buildCreationTagSignalScoreMap } from '../analysis/CreationTagSignalBuilder';
import { buildMaterialQualityProfile } from '../analysis/MaterialBalanceProfile';
import { AffixPoolRuleSet } from '../rules/affix/AffixPoolRuleSet';
import { AffixEligibilityFacts, AffixPoolDecision } from '../rules/contracts';
import {
  AFFIX_STOP_REASONS,
  AffixCandidate,
  createEmptyEnergyBudget,
} from '../types';
import { AffixRegistry } from './AffixRegistry';
import { AffixDefinition, flattenAffixMatcherTags } from './types';

/**
 * 词缀候选池构建器
 * 根据 session 当前状态（inputTags、品质上限、解锁类别、产物类型）
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
      materialFingerprints,
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

    const maxQualityOrder =
      buildMaterialQualityProfile(materialFingerprints).weightedAverageOrder;

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

    const matching = this.filterCandidatesForProductContext(
      registry.queryBySignals(
        inputTagSignals,
        recipeMatch.unlockedAffixCategories,
        input.productType,
      ),
      session,
    ).map((def) => this.toCandidate(def));

    const facts: AffixEligibilityFacts = {
      productType: input.productType,
      recipeMatch,
      energyBudget: session.state.energyBudget ?? createEmptyEnergyBudget(),
      candidatePool: matching,
      allowedCategories: recipeMatch.unlockedAffixCategories,
      inputTagSignals,
      inputTags,
      tagSignalScores: buildCreationTagSignalScoreMap(inputTagSignals),
      maxQualityOrder,
    };

    return this.ruleSet.evaluate(facts);
  }

  private filterCandidatesForProductContext(
    defs: AffixDefinition[],
    session: CreationSession,
  ): AffixDefinition[] {
    return defs.filter((def) => {
      if (
        !['skill_core', 'gongfa_foundation', 'artifact_core'].includes(
          def.category,
        )
      ) {
        return true;
      }

      switch (session.state.input.productType) {
        case 'artifact': {
          const slotBias =
            session.state.intent?.slotBias ?? session.state.input.requestedSlot;
          if (!slotBias) {
            return def.applicableArtifactSlots === undefined;
          }

          return def.applicableArtifactSlots?.includes(slotBias) ?? false;
        }

        case 'skill':
          return this.isSkillCoreCandidate(def);

        case 'gongfa':
          return this.isGongfaCoreCandidate(def);

        default:
          return true;
      }
    });
  }

  private isSkillCoreCandidate(def: AffixDefinition): boolean {
    if (def.category === 'skill_core') {
      return true;
    }
    return false;
  }

  private isGongfaCoreCandidate(def: AffixDefinition): boolean {
    if (def.category === 'gongfa_foundation') {
      return true;
    }
    return false;
  }

  private toCandidate(def: AffixDefinition): AffixCandidate {
    return {
      id: def.id,
      name: def.displayName,
      description: def.displayDescription,
      category: def.category,
      match: def.match,
      tags: flattenAffixMatcherTags(def.match),
      grantedAbilityTags: def.grantedAbilityTags,
      weight: def.weight,
      energyCost: def.energyCost,
      exclusiveGroup: def.exclusiveGroup,
      minQuality: def.minQuality,
      maxQuality: def.maxQuality,
      effectTemplate: def.effectTemplate,
    };
  }
}

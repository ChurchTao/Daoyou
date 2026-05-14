import { CreationSession } from '../CreationSession';
import { buildCreationTagSignalScoreMap } from '../analysis/CreationTagSignalBuilder';
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
      negativeTagBiases: session.state.intent?.negativeTagBiases ?? [],
    };

    return this.ruleSet.evaluate(facts);
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

      // --- 2. 核心池特定内容校验 (Category-specific Content Validation) ---
      // 注意：这里保留对核心池词缀的本质属性校验（如果有的话）
      const isCore = [
        'skill_core',
        'gongfa_foundation',
        'artifact_core',
      ].includes(def.category);

      if (isCore) {
        switch (productType) {
          case 'skill':
            return this.isSkillCoreCandidate(def);
          case 'gongfa':
            return this.isGongfaCoreCandidate(def);
        }
      }

      return true;
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
      applicableArtifactSlots: def.applicableArtifactSlots,
      targetPolicyConstraint: def.targetPolicyConstraint,
      effectTemplate: def.effectTemplate,
    };
  }
}

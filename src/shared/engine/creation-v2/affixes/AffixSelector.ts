import {
  AFFIX_STOP_REASONS,
  AffixCandidate,
  AffixSelectionAudit,
  CreationIntent,
  EnergyBudget,
  RolledAffix,
} from '../types';
import { AffixSelectionDecision, AffixSelectionFacts } from '../rules/contracts';
import { AffixSelectionRuleSet } from '../rules/affix/AffixSelectionRuleSet';
import { AffixPicker } from './AffixPicker';
import { AffixRollEngine } from './AffixRollEngine';
import { CREATION_PROJECTION_BALANCE } from '../config/CreationBalance';
import {
  AffixSlotLayoutStep,
  resolveAffixSlotLayout,
} from '../config/AffixSelectionConstraints';
import type { ElementType } from '@shared/types/constants';

export interface AffixSelectionResult {
  audit: AffixSelectionAudit;
}

export class AffixSelector {
  constructor(
    private readonly ruleSet = new AffixSelectionRuleSet(),
    private readonly picker = new AffixPicker(),
    private readonly rollEngine = new AffixRollEngine(),
  ) {}

  select(
    pool: AffixCandidate[],
    budget: EnergyBudget,
    intent: CreationIntent,
    maxCount: number = CREATION_PROJECTION_BALANCE.defaultMaxAffixCount,
  ): AffixSelectionAudit {
    return this.selectWithDecision(pool, budget, intent, maxCount).audit;
  }

  selectWithDecision(
    pool: AffixCandidate[],
    budget: EnergyBudget,
    intent: CreationIntent,
    maxCount: number = CREATION_PROJECTION_BALANCE.defaultMaxAffixCount,
  ): AffixSelectionResult {
    const result: RolledAffix[] = [];
    const pickedGroups = new Set<string>();
    const allocations: AffixSelectionAudit['allocations'] = [];
    const rejections: AffixSelectionAudit['rejections'] = [];
    const rounds: AffixSelectionAudit['rounds'] = [];
    const selectedAffixIds: string[] = [];
    let remaining = budget.remaining;
    let available = [...pool];
    let exhaustionReason: AffixSelectionAudit['exhaustionReason'];
    let finalDecision: AffixSelectionDecision | undefined;
    let selectedSkillTargetConstraint: AffixCandidate['targetPolicyConstraint'];
    let selectedArtifactSlots: AffixCandidate['applicableArtifactSlots'];

    const layout = resolveAffixSlotLayout(intent.productType, maxCount);

    const runSelectionRound = (
      candidates: AffixCandidate[],
      currentSlot: AffixSlotLayoutStep,
    ): boolean => {
      const remainingBefore = remaining;
      const facts: AffixSelectionFacts = {
        productType: intent.productType,
        candidates,
        remainingEnergy: remaining,
        inputTags: intent.dominantTags,
        maxSelections: maxCount,
        selectionCount: result.length,
        selectedAffixIds,
        selectedExclusiveGroups: Array.from(pickedGroups),
        selectedAbilityTags: this.buildSelectedAbilityTags(result),
        selectedSlots: result.map((affix) => affix.slot),
        currentSlot,
        elementBias: intent.elementBias,
        selectedGongfaSchoolPlan: this.buildSelectedGongfaSchoolPlan(result),
      };
      const decision = this.ruleSet.evaluate(facts);
      finalDecision = decision;

      this.mergeUniqueRejections(rejections, decision.rejections);

      if (decision.candidatePool.length === 0) {
        exhaustionReason = decision.exhaustionReason;
        rounds.push({
          round: rounds.length + 1,
          remainingBefore,
          remainingAfter: remainingBefore,
          inputCandidates: [...candidates],
          decision,
        });
        return false;
      }

      const picked = this.picker.pick(decision.candidatePool);
      const chosen = this.rollEngine.roll(
        picked.candidate,
        budget,
        picked.rollScore,
      );

      result.push(chosen);
      remaining -= chosen.energyCost;
      allocations.push({ affixId: chosen.id, amount: chosen.energyCost });
      selectedAffixIds.push(chosen.id);

      if (intent.productType === 'skill' && chosen.slot === 'core') {
        selectedSkillTargetConstraint = chosen.targetPolicyConstraint;
      }

      if (intent.productType === 'artifact' && chosen.slot === 'core') {
        selectedArtifactSlots = chosen.applicableArtifactSlots;
      }

      if (chosen.exclusiveGroup) pickedGroups.add(chosen.exclusiveGroup);

      rounds.push({
        round: rounds.length + 1,
        remainingBefore,
        remainingAfter: remaining,
        inputCandidates: [...candidates],
        decision,
        pickedAffix: chosen,
      });

      available = available.filter((candidate) => candidate.id !== chosen.id);
      return true;
    };

    for (const slotStep of layout) {
      if (available.length === 0 || result.length >= maxCount) {
        break;
      }

      const slotCandidates = available.filter((candidate) => {
        if (!slotStep.slots.includes(candidate.slot)) {
          return false;
        }

        if (
          intent.productType === 'skill' &&
          !this.isSkillTargetPolicyCompatible(
            selectedSkillTargetConstraint,
            candidate.targetPolicyConstraint,
          )
        ) {
          return false;
        }

        if (
          intent.productType === 'artifact' &&
          !this.isArtifactSlotCompatible(
            selectedArtifactSlots,
            candidate.applicableArtifactSlots,
          )
        ) {
          return false;
        }

        return true;
      });

      if (slotCandidates.length === 0) {
        if (slotStep.required) {
          exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
          const decision: AffixSelectionDecision = {
            candidatePool: [],
            rejections: [],
            exhaustionReason,
            reasons: [
              {
                code: 'required_slot_empty',
                message: '必选 slot 没有可用词缀候选',
                details: {
                  slotIndex: slotStep.index,
                  allowedSlots: slotStep.slots,
                },
              },
            ],
            warnings: [],
            trace: [
              {
                ruleId: 'affix.selection.required-slot',
                outcome: 'blocked',
                message: '必选 slot 没有可用词缀候选，停止词缀抽选',
                details: {
                  slotIndex: slotStep.index,
                  allowedSlots: slotStep.slots,
                  availableCandidates: available.length,
                },
              },
            ],
          };
          finalDecision = decision;
          rounds.push({
            round: rounds.length + 1,
            remainingBefore: remaining,
            remainingAfter: remaining,
            inputCandidates: [],
            decision,
          });
          break;
        }
        continue;
      }

      const picked = runSelectionRound(slotCandidates, slotStep);
      if (!picked && slotStep.required) {
        break;
      }
    }

    if (result.length >= maxCount) {
      exhaustionReason = AFFIX_STOP_REASONS.MAX_COUNT_REACHED;
    } else if (!exhaustionReason && available.length === 0) {
      exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
    }

    const audit: AffixSelectionAudit = {
      rounds,
      affixes: result,
      spent: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      remaining,
      allocations,
      rejections,
      exhaustionReason,
      ...(finalDecision ? { finalDecision } : {}),
    };

    return { audit };
  }

  private mergeUniqueRejections(
    target: AffixSelectionAudit['rejections'],
    incoming: AffixSelectionAudit['rejections'],
  ): void {
    const existing = new Set(
      target.map((rejection) => this.buildRejectionKey(rejection)),
    );

    for (const rejection of incoming) {
      const key = this.buildRejectionKey(rejection);
      if (existing.has(key)) {
        continue;
      }

      target.push(rejection);
      existing.add(key);
    }
  }

  private buildRejectionKey(rejection: AffixSelectionAudit['rejections'][number]): string {
    return [
      rejection.affixId,
      rejection.reason,
      rejection.exclusiveGroup ?? '',
      String(rejection.amount),
    ].join('||');
  }

  private isSkillTargetPolicyCompatible(
    coreConstraint?: AffixCandidate['targetPolicyConstraint'],
    candidateConstraint?: AffixCandidate['targetPolicyConstraint'],
  ): boolean {
    if (!coreConstraint || !candidateConstraint) {
      return true;
    }

    if (
      coreConstraint.team &&
      candidateConstraint.team &&
      coreConstraint.team !== candidateConstraint.team
    ) {
      return false;
    }

    if (
      coreConstraint.scope &&
      candidateConstraint.scope &&
      coreConstraint.scope !== candidateConstraint.scope
    ) {
      return false;
    }

    return true;
  }

  private isArtifactSlotCompatible(
    coreSlots?: AffixCandidate['applicableArtifactSlots'],
    candidateSlots?: AffixCandidate['applicableArtifactSlots'],
  ): boolean {
    if (!coreSlots || coreSlots.length === 0 || !candidateSlots || candidateSlots.length === 0) {
      return true;
    }

    return coreSlots.some((slot) => candidateSlots.includes(slot));
  }

  private buildSelectedAbilityTags(selected: RolledAffix[]): string[] {
    return Array.from(
      new Set(
        selected.flatMap((affix) => affix.grantedAbilityTags ?? []),
      ),
    );
  }

  private buildSelectedGongfaSchoolPlan(
    selected: RolledAffix[],
  ): AffixSelectionFacts['selectedGongfaSchoolPlan'] {
    let primaryElement: ElementType | undefined;
    let primarySelected = false;
    let resonanceCount = 0;
    let supportCount = 0;

    for (const affix of selected) {
      const meta = affix.selectionMeta?.gongfa;
      if (!meta) {
        continue;
      }

      if (affix.slot === 'identity') {
        primarySelected = true;
        primaryElement = meta.element;
      } else if (affix.slot === 'resonance') {
        resonanceCount += 1;
      } else if (meta.role === 'support') {
        supportCount += 1;
      }
    }

    return {
      primarySelected,
      ...(primaryElement ? { primaryElement } : {}),
      resonanceCount,
      supportCount,
    };
  }
}

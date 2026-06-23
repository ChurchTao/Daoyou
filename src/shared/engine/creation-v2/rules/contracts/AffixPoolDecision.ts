import { AffixCandidate, AffixSlot } from '../../types';
import { RuleDecisionMeta } from '../core';

export interface AffixPoolDecision extends RuleDecisionMeta {
  candidates: AffixCandidate[];
  rejectedCandidates: Array<{
    affixId: string;
    reason: string;
    slot?: AffixSlot;
    score?: number;
    threshold?: number;
  }>;
  exhaustionReason?: string;
}

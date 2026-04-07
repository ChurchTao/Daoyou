import { AffixCandidate, AffixCategory } from '../../types';
import { RuleDecisionMeta } from '../core';

export interface AffixPoolDecision extends RuleDecisionMeta {
  candidates: AffixCandidate[];
  rejectedCandidates: Array<{
    affixId: string;
    reason: string;
    category?: AffixCategory;
    score?: number;
    threshold?: number;
  }>;
  exhaustionReason?: string;
}
import {
  AffixCandidate,
  AffixAllocation,
  AffixRejection,
  AffixSelectionStopReason,
  RolledAffix,
} from '../../types';
import { RuleDecisionMeta } from '../core';

export interface AffixSelectionDecision extends RuleDecisionMeta {
  candidatePool: AffixCandidate[];
  affixes: RolledAffix[];
  spent: number;
  remaining: number;
  allocations: AffixAllocation[];
  rejections: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
}
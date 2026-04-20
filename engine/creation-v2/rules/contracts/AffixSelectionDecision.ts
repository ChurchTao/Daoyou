import {
  AffixCandidate,
  AffixRejection,
  AffixSelectionStopReason,
} from '../../types';
import { RuleDecisionMeta } from '../core';

export interface AffixSelectionDecision extends RuleDecisionMeta {
  candidatePool: AffixCandidate[];
  rejections: AffixRejection[];
  exhaustionReason?: AffixSelectionStopReason;
}